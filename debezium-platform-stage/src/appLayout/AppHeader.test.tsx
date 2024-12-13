import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi, describe, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

// Mocking modules
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("./AppContext", () => ({
  useData: vi.fn(),
}));

// Mock functions
const mockNavigate = vi.fn();
const mockToggleSidebar = vi.fn();
const mockHandleNotificationBadgeClick = vi.fn();
const mockGetNotificationBadgeVariant = vi.fn();
const mockAddNotification = vi.fn();

// Import AppHeader after mocking dependencies
import AppHeader from "./AppHeader";
import { useData } from "./AppContext";

// Helper function to render AppHeader
const renderAppHeader = (darkMode = false) => {
  vi.mocked(useData).mockReturnValue({
    navigationCollapsed: false,
    darkMode,
    setDarkMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  });

  render(
    <MemoryRouter initialEntries={["/"]}>
      <AppHeader
        toggleSidebar={mockToggleSidebar}
        handleNotificationBadgeClick={mockHandleNotificationBadgeClick}
        getNotificationBadgeVariant={mockGetNotificationBadgeVariant}
        addNotification={mockAddNotification}
      />
    </MemoryRouter>
  );
};

describe("AppHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders the AppHeader component with logo", () => {
    renderAppHeader();
    const logoImage = screen.getByAltText("Debezium Logo");
    expect(logoImage).toBeInTheDocument();
  });

  test("toggles sidebar when button is clicked", () => {
    renderAppHeader();
    const toggleButton = screen.getByLabelText("Global navigation");
    fireEvent.click(toggleButton);
    expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
  });

  test("handles notification badge click", () => {
    renderAppHeader();
    const notificationBadge = screen.getByLabelText("Notifications");
    fireEvent.click(notificationBadge);
    expect(mockHandleNotificationBadgeClick).toHaveBeenCalledTimes(1);
  });

  test("navigates to home page when logo is clicked", () => {
    renderAppHeader();
    const logoImage = screen.getByAltText("Debezium Logo");
    fireEvent.click(logoImage);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});