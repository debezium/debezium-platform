import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi, describe, beforeEach } from "vitest";
import { render } from "../__test__/unit/test-utils";
import { AlertStatusResponse } from "../pages/Alerts/alertsTypes";

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

vi.mock("../apis/alerts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../apis/alerts")>();
  return {
    ...actual,
    fetchAlertStatus: vi.fn(),
  };
});

vi.mock("@utils/featureFlag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@utils/featureFlag")>();
  return {
    ...actual,
    isFeatureEnabled: vi.fn(actual.isFeatureEnabled),
  };
});

import AppHeader from "./AppHeader";
import { useData } from "./AppContext";
import { fetchAlertStatus } from "../apis/alerts";
import { isFeatureEnabled } from "@utils/featureFlag";

const statusResponse = (
  firingBySeverity: AlertStatusResponse["firingBySeverity"]
): AlertStatusResponse => ({
  totalFiring:
    firingBySeverity.CRITICAL + firingBySeverity.WARNING + firingBySeverity.INFO,
  totalPending: 0,
  firingBySeverity,
  activeAlerts: [],
});

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
    vi.mocked(fetchAlertStatus).mockResolvedValue(
      statusResponse({ CRITICAL: 0, WARNING: 0, INFO: 0 })
    );
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

  test("disables the notification badge when CRITICAL, WARNING, and INFO are all zero", async () => {
    renderAppHeader();

    const badge = await screen.findByLabelText("No firing critical or warning alerts");
    expect(badge).toBeDisabled();
  });

  test("uses the unread badge when only INFO alerts are firing", async () => {
    vi.mocked(fetchAlertStatus).mockResolvedValue(
      statusResponse({ CRITICAL: 0, WARNING: 0, INFO: 2 })
    );

    renderAppHeader();

    expect(await screen.findByLabelText("Info alerts firing")).toBeInTheDocument();
  });

  test("applies the warning class when only warning alerts are firing", async () => {
    vi.mocked(fetchAlertStatus).mockResolvedValue(
      statusResponse({ CRITICAL: 0, WARNING: 2, INFO: 0 })
    );

    renderAppHeader();

    const badge = await screen.findByLabelText("2 firing alerts");
    expect(badge).toHaveClass("alert-notification-badge--warning");
  });

  test("shows the firing count on the notification badge", async () => {
    vi.mocked(fetchAlertStatus).mockResolvedValue(
      statusResponse({ CRITICAL: 1, WARNING: 2, INFO: 2 })
    );

    renderAppHeader();

    const badge = await screen.findByLabelText("3 firing alerts");
    expect(badge).toHaveTextContent("3");
  });

  test("navigates to the events page filtered to FIRING when the notification badge is clicked", async () => {
    vi.mocked(fetchAlertStatus).mockResolvedValue(
      statusResponse({ CRITICAL: 1, WARNING: 0, INFO: 0 })
    );

    renderAppHeader();

    await userEvent.click(await screen.findByLabelText("1 firing alerts"));
    expect(mockNavigate).toHaveBeenCalledWith("/alerts/history?status=FIRING");
    expect(mockHandleNotificationBadgeClick).not.toHaveBeenCalled();
  });

  test("opens the notification drawer when the Alerts feature is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);

    renderAppHeader();

    const notificationBadge = screen.getByLabelText("Notifications");
    fireEvent.click(notificationBadge);
    expect(mockHandleNotificationBadgeClick).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByLabelText(/firing alerts/)).not.toBeInTheDocument();
    });
  });

  test("navigates to home page when logo is clicked", () => {
    renderAppHeader();
    const logoImage = screen.getByAltText("Debezium Logo");
    fireEvent.click(logoImage);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
