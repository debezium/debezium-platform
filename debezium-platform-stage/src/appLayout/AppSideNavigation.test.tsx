import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import AppSideNavigation from "./AppSideNavigation";
import { expect, test, vi, afterEach, beforeEach } from "vitest";
import { render } from "../__test__/unit/test-utils";
import { featureFlagUi, isRouteNavVisible } from "@utils/featureFlag";
import { isNavRouteVisible, isRouteGroup, routes } from "../route";
import { AlertStatusResponse } from "../pages/Alerts/alertsTypes";

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

vi.mock("../apis/alerts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../apis/alerts")>();
  return {
    ...actual,
    fetchAlertStatus: vi.fn(),
  };
});

import { fetchAlertStatus } from "../apis/alerts";

const originalHideDisabled = featureFlagUi.hideDisabledFeaturesFromNav;

const statusResponse = (
  firingBySeverity: AlertStatusResponse["firingBySeverity"]
): AlertStatusResponse => ({
  totalFiring:
    firingBySeverity.CRITICAL + firingBySeverity.WARNING + firingBySeverity.INFO,
  totalPending: 0,
  firingBySeverity,
  activeAlerts: [],
});

const idleStatus = statusResponse({ CRITICAL: 0, WARNING: 0, INFO: 0 });

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

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

beforeEach(() => {
  vi.mocked(fetchAlertStatus).mockResolvedValue(idleStatus);
});

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
  "navigates to Alert events and reveals sub-navigation when the Alerts group is clicked",
  async () => {
    render(
      <>
        <LocationDisplay />
        <AppSideNavigation isSidebarOpen={true} />
      </>
    );

    await userEvent.click(screen.getByRole("button", { name: /alerts/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/alerts/history");
    ["Rules", "Channels", "Events"].forEach((text) => {
      expect(screen.getByRole("link", { name: text })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Events" })).toHaveClass("pf-m-current");
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

test.skipIf(!isRouteNavVisible("Alerts"))(
  "shows a danger badge with the firing count and opens events filtered to FIRING",
  async () => {
    vi.mocked(fetchAlertStatus).mockResolvedValue(
      statusResponse({ CRITICAL: 1, WARNING: 2, INFO: 2 })
    );

    render(
      <>
        <LocationDisplay />
        <AppSideNavigation isSidebarOpen={true} />
      </>
    );

    const badge = await screen.findByLabelText("3 firing alerts");
    expect(badge).toHaveTextContent("3");

    await userEvent.click(screen.getByRole("button", { name: /alerts/i }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/alerts/history?status=firing"
    );
  }
);

test.skipIf(!isRouteNavVisible("Alerts"))(
  "shows a warning badge when only warning alerts are firing",
  async () => {
    vi.mocked(fetchAlertStatus).mockResolvedValue(
      statusResponse({ CRITICAL: 0, WARNING: 4, INFO: 0 })
    );

    render(<AppSideNavigation isSidebarOpen={true} />);

    const badge = await screen.findByLabelText("4 firing alerts");
    expect(badge).toHaveTextContent("4");
  }
);

test.skipIf(!isRouteNavVisible("Alerts"))(
  "does not show a badge when only INFO alerts are firing",
  async () => {
    vi.mocked(fetchAlertStatus).mockResolvedValue(
      statusResponse({ CRITICAL: 0, WARNING: 0, INFO: 5 })
    );

    render(<AppSideNavigation isSidebarOpen={true} />);

    await waitFor(() => expect(fetchAlertStatus).toHaveBeenCalled());
    expect(screen.queryByLabelText(/firing alerts/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Info alerts firing")).not.toBeInTheDocument();
  }
);

test.skipIf(!isRouteNavVisible("Alerts"))(
  "links the collapsed Alerts icon to the FIRING events filter when alerts are firing",
  async () => {
    vi.mocked(fetchAlertStatus).mockResolvedValue(
      statusResponse({ CRITICAL: 2, WARNING: 0, INFO: 0 })
    );

    const { container } = render(<AppSideNavigation isSidebarOpen={false} />);

    expect(await screen.findByLabelText("2 firing alerts")).toBeInTheDocument();
    expect(container.querySelector('a[href="/alerts/history?status=firing"]')).not.toBeNull();
  }
);
