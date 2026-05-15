import { screen } from "@testing-library/react";
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
});

test("renders the side navigation Collapsed", () => {
  render(<AppSideNavigation isSidebarOpen={false} />);
  const sideNavItems = screen.getAllByRole("link");
  expect(sideNavItems).toHaveLength(6);

  const sideNavTexts = sideNavItems.map((item) => item.textContent);
  expect(sideNavTexts.join("")).toBe("");
});
