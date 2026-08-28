import { screen, fireEvent } from "@testing-library/react";
import { expect, test, vi, describe, beforeEach } from "vitest";
import { render } from "../__test__/unit/test-utils";

const mockNavigate = vi.fn();
const mockToggleSidebar = vi.fn();
const mockHandleNotificationBadgeClick = vi.fn();
const mockGetNotificationBadgeVariant = vi.fn();
const mockAddNotification = vi.fn();

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

vi.mock("@utils/featureFlag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@utils/featureFlag")>();
  return {
    ...actual,
    isFeatureEnabled: vi.fn(actual.isFeatureEnabled),
  };
});

import AppHeader from "./AppHeader";
import { useData } from "./AppContext";
import { isFeatureEnabled } from "@utils/featureFlag";

const renderAppHeader = (darkMode = false) => {
  vi.mocked(useData).mockReturnValue({
    navigationCollapsed: false,
    darkMode,
    setDarkMode: vi.fn(),
    glassMode: false,
    setGlassMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  });

  render(
    <AppHeader
      toggleSidebar={mockToggleSidebar}
      handleNotificationBadgeClick={mockHandleNotificationBadgeClick}
      getNotificationBadgeVariant={mockGetNotificationBadgeVariant}
      addNotification={mockAddNotification}
    />,
  );
};

describe("AppHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
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

  test("does not render the notification badge when the Alerts feature is enabled", () => {
    renderAppHeader();

    expect(screen.queryByLabelText("Notifications")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/firing alerts/)).not.toBeInTheDocument();
  });

  test("opens the notification drawer when the Alerts feature is disabled", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);

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
