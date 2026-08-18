import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppSideNavigation from "./AppSideNavigation";
import { expect, test, vi } from "vitest";
import { render } from "../__test__/unit/test-utils";

// Partial mock of the AppContext module
vi.mock("./AppContext", async () => {
  // Import the actual module
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

test("renders the side navigation Expanded", () => {
  render(<AppSideNavigation isSidebarOpen={true} />);

  // "Alerts" is a collapsed NavExpandable group (not a link) when the current
  // route isn't inside it, so its children aren't part of the visible link list.
  const sideNavItems = screen.getAllByRole("link");
  expect(sideNavItems).toHaveLength(6);

  const expectedTexts = [
    "Pipelines",
    "Sources",
    "Transforms",
    "Destinations",
    "Connections",
    "Vaults",
  ];

  const sideNavTexts = sideNavItems.map((item) => item.textContent);

  expectedTexts.forEach((text) => {
    expect(sideNavTexts).toContain(text);
  });

  expect(screen.getByRole("button", { name: /alerts/i })).toBeInTheDocument();
});

test("expands the Alerts nav group and reveals its sub-navigation on click", async () => {
  render(<AppSideNavigation isSidebarOpen={true} />);

  await userEvent.click(screen.getByRole("button", { name: /alerts/i }));

  ["Rules", "Channels", "History"].forEach((text) => {
    expect(screen.getByRole("link", { name: text })).toBeInTheDocument();
  });
});

test("only highlights the current Alerts sub-item, not its siblings", () => {
  render(<AppSideNavigation isSidebarOpen={true} />, {
    initialEntries: ["/alerts/channels"],
  });

  const rulesLink = screen.getByRole("link", { name: "Rules" });
  const channelsLink = screen.getByRole("link", { name: "Channels" });
  const historyLink = screen.getByRole("link", { name: "History" });

  expect(rulesLink).not.toHaveClass("pf-m-current");
  expect(channelsLink).toHaveClass("pf-m-current");
  expect(historyLink).not.toHaveClass("pf-m-current");
});

test("renders the side navigation Collapsed", () => {
  render(<AppSideNavigation isSidebarOpen={false} />);
  const sideNavItems = screen.getAllByRole("link");
  expect(sideNavItems).toHaveLength(7);

  const sideNavTexts = sideNavItems.map((item) => item.textContent);
  expect(sideNavTexts.join("")).toBe("");
});

test("shows the group label as a tooltip on the collapsed Alerts icon", async () => {
  const { container } = render(<AppSideNavigation isSidebarOpen={false} />);

  // The collapsed rail has no visible text, so the group's `label` (e.g. "Alerts")
  // must still be reachable via a tooltip on its icon link. The icon links to the
  // group's first visible child route, so target it by href rather than accessible name.
  const alertsIcon = container.querySelector('a[href="/alerts/history"] svg');
  expect(alertsIcon).not.toBeNull();
  await userEvent.hover(alertsIcon as Element);

  expect(await screen.findByText("Alerts")).toBeInTheDocument();
});
