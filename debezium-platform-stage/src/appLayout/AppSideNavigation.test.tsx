import { render, screen } from "@testing-library/react";
import AppSideNavigation from "./AppSideNavigation";
import { expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

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
  render(
    <MemoryRouter>
      <AppSideNavigation isSidebarOpen={true} />
    </MemoryRouter>
  );
  const sideNavItems = screen.getAllByRole("link");
  expect(sideNavItems).toHaveLength(5);

  const expectedTexts = [
    "Pipeline",
    "Source",
    "Transform",
    "Destination",
    "Vaults",
  ];

  const sideNavTexts = sideNavItems.map((item) => item.textContent);

  expectedTexts.forEach((text) => {
    expect(sideNavTexts).toContain(text);
  });

  const darkModeText = screen.getByText("Dark mode");
  expect(darkModeText).toHaveTextContent("Dark mode");
});

test("renders the side navigation Collapsed", () => {
  render(
    <MemoryRouter>
      <AppSideNavigation isSidebarOpen={false} />
    </MemoryRouter>
  );
  const sideNavItems = screen.getAllByRole("link");
  expect(sideNavItems).toHaveLength(5);

  const sideNavTexts = sideNavItems.map((item) => item.textContent);
  expect(sideNavTexts.join("")).equal("");
});
