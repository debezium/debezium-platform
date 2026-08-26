/**
 * Minimal smoke: core APIs return 200 and each main section renders without error.
 * Page and nav assertions follow the live feature-flag config.
 */
import {
  FLAGGED_NAV_TOURS,
  getFeaturePageAccess,
  isRouteNavVisible,
  type FeatureFlag,
} from "../support/featureFlags";

describe("Debezium Platform - Smoke Test", () => {
  const apiUrl = () => Cypress.env("apiUrl");

  const CORE_API_PATHS = [
    "/api/pipelines",
    "/api/catalog",
    "/api/sources",
    "/api/destinations",
    "/api/connections",
    "/api/transforms",
  ] as const;

  type MainPage = {
    name: string;
    path: string;
    title: RegExp;
    api: RegExp | null;
    flag?: FeatureFlag;
    assertReady: () => void;
  };

  const MAIN_PAGES: MainPage[] = [
    {
      name: "Pipeline home",
      path: "/",
      title: /Stage \| Pipeline/i,
      api: /\/api\/pipelines\/?$/,
      assertReady: () => {
        cy.get("body").then(($body) => {
          const hasContent =
            $body.find('[data-tour="add-pipeline"]').length > 0 ||
            $body.text().includes("Welcome to Stage") ||
            $body.find("table").length > 0;
          void expect(hasContent, "pipeline list, welcome, or add action").to.be
            .true;
        });
      },
    },
    {
      name: "Sources",
      path: "/source",
      title: /Stage \| Source/i,
      api: /\/api\/sources\/?$/,
      assertReady: () => {
        cy.get('[data-tour="add-source"], table[aria-label="source table"]', {
          timeout: 30000,
        }).should("exist");
      },
    },
    {
      name: "Destinations",
      path: "/destination",
      title: /Stage \| Destination/i,
      api: /\/api\/destinations\/?$/,
      assertReady: () => {
        cy.get(
          '[data-tour="add-destination"], table[aria-label="destination table"]',
          {
            timeout: 30000,
          }
        ).should("exist");
      },
    },
    {
      name: "Transforms",
      path: "/transform",
      title: /Stage \| Transform/i,
      api: /\/api\/transforms\/?$/,
      flag: "Transforms",
      assertReady: () => {
        cy.get("body", { timeout: 30000 }).should(($body) => {
          const ready =
            $body.text().includes("No transform available") ||
            $body.find("table").length > 0;
          void expect(ready, "transform empty state or table").to.be.true;
        });
      },
    },
    {
      name: "Connections",
      path: "/connections",
      title: /Stage \| Connections/i,
      api: /\/api\/connections\/?$/,
      flag: "Connection",
      assertReady: () => {
        cy.get('[data-tour="connection-page"]', { timeout: 30000 }).should(
          "exist"
        );
        cy.get("body").should(($body) => {
          const ready =
            $body.text().includes("No Connection available") ||
            $body.text().includes("Connection");
          void expect(ready, "connections empty state or list").to.be.true;
        });
      },
    },
    {
      name: "Vaults",
      path: "/vaults",
      title: /Stage \| Vaults/i,
      api: null,
      flag: "Vault",
      assertReady: () => {
        cy.contains("No vault available", { timeout: 30000 }).should("exist");
      },
    },
  ];

  /** Avoid matching incidental "404" substrings (e.g. table_0404) in list data. */
  const assertNotOn404Page = () => {
    cy.contains("404: Page Not Found").should("not.exist");
  };

  beforeEach(() => {
    cy.waitForBackend();
  });

  it("should return 200 for core backend APIs", () => {
    CORE_API_PATHS.forEach((path) => {
      cy.request(`${apiUrl()}${path}`).its("status").should("eq", 200);
    });
    cy.request(`${apiUrl()}/api/catalog`)
      .its("body.components")
      .should("have.property", "server-sink");
  });

  it("should load application shell with primary navigation", () => {
    cy.intercept("GET", /\/api\/pipelines\/?$/).as("getPipelines");
    cy.visitWithTourDisabled("/");
    cy.wait("@getPipelines").its("response.statusCode").should("eq", 200);

    cy.get("#root").should("be.visible");
    cy.get('[data-tour="sidebar-nav"]').should("be.visible");
    cy.get('[data-tour="nav-pipeline"]').should("be.visible");
    cy.get('[data-tour="nav-source"]').should("be.visible");
    cy.get('[data-tour="nav-destination"]').should("be.visible");

    FLAGGED_NAV_TOURS.forEach(({ flag, tour }) => {
      if (isRouteNavVisible(flag)) {
        cy.get(`[data-tour="${tour}"]`).should("be.visible");
      } else {
        cy.get(`[data-tour="${tour}"]`).should("not.exist");
      }
    });

    cy.get('[data-tour="sidebar-nav"]').within(() => {
      if (isRouteNavVisible("Alerts")) {
        cy.contains("Alerts").should("be.visible");
      } else {
        cy.contains("Alerts").should("not.exist");
      }
    });

    assertNotOn404Page();
  });

  MAIN_PAGES.forEach(({ name, path, title, api, flag, assertReady }) => {
    it(`should load ${name} page`, () => {
      if (flag && getFeaturePageAccess(flag) === "unavailable") {
        cy.visitWithTourDisabled(path);
        cy.contains("404: Page Not Found").should("exist");
        return;
      }

      if (api) {
        cy.intercept("GET", api).as("pageApi");
      }
      cy.visitWithTourDisabled(path);
      if (api) {
        cy.wait("@pageApi").its("response.statusCode").should("eq", 200);
      }
      if (path !== "/") {
        cy.url().should("include", path);
      }
      cy.title().should("match", title);
      assertNotOn404Page();
      if (flag && getFeaturePageAccess(flag) === "comingSoon") {
        cy.get('img[alt="Coming Soon"]').should("exist");
      }
      assertReady();
    });
  });
});
