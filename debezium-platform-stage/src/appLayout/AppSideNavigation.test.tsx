import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppSideNavigation from "./AppSideNavigation";
import { expect, test, vi, afterEach } from "vitest";
import { render } from "../__test__/unit/test-utils";
import { featureFlagUi, isRouteNavVisible } from "@utils/featureFlag";
import { isNavRouteVisible, isRouteGroup, routes } from "../route";

vi.mock("./AppContext", async () => {
  const originalModule = await vi.importActual("./AppContext");

  return {
    ...originalModule,
    useData: () => ({
      navigationCollapsed: false,
      darkMode: false,
      setDarkMode: vi.fn(),
      updateNavigationCollapsed: vi.fn(),
    }),
  };
});

const originalHideDisabled = featureFlagUi.hideDisabledFeaturesFromNav;

const visibleLeafLabels = () =>
  routes.flatMap((route) =>
    !isRouteGroup(route) && isNavRouteVisible(route) && route.label
      ? [route.label]
      : []
  );

const visibleGroupLabels = () =>
  routes
    .filter(isRouteGroup)
    .filter((group) => group.routes.some(isNavRouteVisible))
    .map((group) => group.label);

afterEach(() => {
  featureFlagUi.hideDisabledFeaturesFromNav = originalHideDisabled;
});

test("renders the side navigation Expanded according to current feature flags", () => {
  render(<AppSideNavigation isSidebarOpen={true} />);

  const expectedLinks = visibleLeafLabels();
  const expectedGroups = visibleGroupLabels();
  const sideNavItems = screen.getAllByRole("link");
  const sideNavTexts = sideNavItems.map((item) => item.textContent);

  expect(sideNavItems).toHaveLength(expectedLinks.length);
  expectedLinks.forEach((text) => {
    expect(sideNavTexts).toContain(text);
  });

  expectedGroups.forEach((label) => {
    expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
  });

  if (!isRouteNavVisible("Vault")) {
    expect(screen.queryByRole("link", { name: "Vaults" })).not.toBeInTheDocument();
  }
  if (!isRouteNavVisible("Alerts")) {
    expect(screen.queryByRole("button", { name: /alerts/i })).not.toBeInTheDocument();
  }
});

test.skipIf(!isRouteNavVisible("Alerts"))(
  "expands the Alerts nav group and reveals its sub-navigation on click",
  async () => {
    render(<AppSideNavigation isSidebarOpen={true} />);

    await userEvent.click(screen.getByRole("button", { name: /alerts/i }));

    ["Rules", "Channels", "Events"].forEach((text) => {
      expect(screen.getByRole("link", { name: text })).toBeInTheDocument();
    });
  }
);

test.skipIf(!isRouteNavVisible("Alerts"))(
  "only highlights the current Alerts sub-item, not its siblings",
  () => {
    render(<AppSideNavigation isSidebarOpen={true} />, {
      initialEntries: ["/alerts/channels"],
    });

    const rulesLink = screen.getByRole("link", { name: "Rules" });
    const channelsLink = screen.getByRole("link", { name: "Channels" });
    const eventsLink = screen.getByRole("link", { name: "Events" });

    expect(rulesLink).not.toHaveClass("pf-m-current");
    expect(channelsLink).toHaveClass("pf-m-current");
    expect(eventsLink).not.toHaveClass("pf-m-current");
  }
);

test("renders the side navigation Collapsed according to current feature flags", () => {
  render(<AppSideNavigation isSidebarOpen={false} />);
  const sideNavItems = screen.getAllByRole("link");
  expect(sideNavItems).toHaveLength(
    visibleLeafLabels().length + visibleGroupLabels().length
  );

  const sideNavTexts = sideNavItems.map((item) => item.textContent);
  expect(sideNavTexts.join("")).toBe("");
});

test.skipIf(!isRouteNavVisible("Alerts"))(
  "shows the group label as a tooltip on the collapsed Alerts icon",
  async () => {
    const { container } = render(<AppSideNavigation isSidebarOpen={false} />);

    const alertsIcon = container.querySelector('a[href="/alerts/history"] svg');
    expect(alertsIcon).not.toBeNull();
    await userEvent.hover(alertsIcon as Element);

    expect(await screen.findByText("Alerts")).toBeInTheDocument();
  }
);
