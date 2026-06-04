/**
 * Minimal smoke: core APIs return 200 and each main section renders without error.
 */
describe('Debezium Platform - Smoke Test', () => {
  const apiUrl = () => Cypress.env('apiUrl');

  const CORE_API_PATHS = [
    '/api/pipelines',
    '/api/catalog',
    '/api/sources',
    '/api/destinations',
    '/api/connections',
    '/api/transforms',
  ] as const;

  const MAIN_PAGES = [
    {
      name: 'Pipeline home',
      path: '/',
      title: /Stage \| Pipeline/i,
      api: /\/api\/pipelines\/?$/,
      assertReady: () => {
        cy.get('body').then(($body) => {
          const hasContent =
            $body.find('[data-tour="add-pipeline"]').length > 0 ||
            $body.text().includes('Welcome to Stage') ||
            $body.find('table').length > 0;
          void expect(hasContent, 'pipeline list, welcome, or add action').to.be.true;
        });
      },
    },
    {
      name: 'Sources',
      path: '/source',
      title: /Stage \| Source/i,
      api: /\/api\/sources\/?$/,
      assertReady: () => {
        cy.get('[data-tour="add-source"], table[aria-label="source table"]', {
          timeout: 30000,
        }).should('exist');
      },
    },
    {
      name: 'Destinations',
      path: '/destination',
      title: /Stage \| Destination/i,
      api: /\/api\/destinations\/?$/,
      assertReady: () => {
        cy.get('[data-tour="add-destination"], table[aria-label="destination table"]', {
          timeout: 30000,
        }).should('exist');
      },
    },
    {
      name: 'Transforms',
      path: '/transform',
      title: /Stage \| Transform/i,
      api: /\/api\/transforms\/?$/,
      assertReady: () => {
        cy.get('body', { timeout: 30000 }).should(($body) => {
          const ready =
            $body.text().includes('No transform available') ||
            $body.find('table').length > 0;
          void expect(ready, 'transform empty state or table').to.be.true;
        });
      },
    },
    {
      name: 'Connections',
      path: '/connections',
      title: /Stage \| Connections/i,
      api: /\/api\/connections\/?$/,
      assertReady: () => {
        cy.get('[data-tour="connection-page"]', { timeout: 30000 }).should('exist');
        cy.get('body').should(($body) => {
          const ready =
            $body.text().includes('No Connection available') ||
            $body.text().includes('Connection');
          void expect(ready, 'connections empty state or list').to.be.true;
        });
      },
    },
    {
      name: 'Vaults',
      path: '/vaults',
      title: /Stage \| Vaults/i,
      api: null,
      assertReady: () => {
        cy.contains('No vault available', { timeout: 30000 }).should('exist');
      },
    },
  ] as const;

  /** Avoid matching incidental "404" substrings (e.g. table_0404) in list data. */
  const assertNotOn404Page = () => {
    cy.contains('404: Page Not Found').should('not.exist');
  };

  beforeEach(() => {
    cy.waitForBackend();
  });

  it('should return 200 for core backend APIs', () => {
    CORE_API_PATHS.forEach((path) => {
      cy.request(`${apiUrl()}${path}`).its('status').should('eq', 200);
    });
    cy.request(`${apiUrl()}/api/catalog`)
      .its('body.components')
      .should('have.property', 'server-sink');
  });

  it('should load application shell with primary navigation', () => {
    cy.intercept('GET', /\/api\/pipelines\/?$/).as('getPipelines');
    cy.visitWithTourDisabled('/');
    cy.wait('@getPipelines').its('response.statusCode').should('eq', 200);

    cy.get('#root').should('be.visible');
    cy.get('[data-tour="sidebar-nav"]').should('be.visible');
    cy.get('[data-tour="nav-pipeline"]').should('be.visible');
    cy.get('[data-tour="nav-source"]').should('be.visible');
    cy.get('[data-tour="nav-destination"]').should('be.visible');
    cy.get('[data-tour="nav-connections"]').should('be.visible');
    cy.get('[data-tour="nav-vaults"]').should('be.visible');
    assertNotOn404Page();
  });

  MAIN_PAGES.forEach(({ name, path, title, api, assertReady }) => {
    it(`should load ${name} page`, () => {
      if (api) {
        cy.intercept('GET', api).as('pageApi');
      }
      cy.visitWithTourDisabled(path);
      if (api) {
        cy.wait('@pageApi').its('response.statusCode').should('eq', 200);
      }
      if (path !== '/') {
        cy.url().should('include', path);
      }
      cy.title().should('match', title);
      assertNotOn404Page();
      assertReady();
    });
  });
});
