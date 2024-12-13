import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AppNotification from "./AppNotification";
import { NotificationProps } from "./AppNotificationContext";

// Mock notifications
const mockNotifications: NotificationProps[] = [
  {
    key: "1",
    variant: "info",
    title: "Test Notification 1",
    srTitle: "Screen Reader Title 1",
    description: "This is a test notification",
    timestamp: "5 minutes ago",
    isNotificationRead: false,
  },
  {
    key: "2",
    variant: "success",
    title: "Test Notification 2",
    srTitle: "Screen Reader Title 2",
    description: "This is another test notification",
    timestamp: "10 minutes ago",
    isNotificationRead: true,
  },
];

describe("AppNotification", () => {
  const mockSetNotifications = vi.fn();
  const mockSetDrawerExpanded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly with notifications", () => {
    render(
      <AppNotification
        notifications={mockNotifications}
        setNotifications={mockSetNotifications}
        setDrawerExpanded={mockSetDrawerExpanded}
      />
    );

    expect(screen.getByText("Test Notification 1")).toBeDefined();
    expect(screen.getByText("Test Notification 2")).toBeDefined();
    expect(screen.getByText("This is a test notification")).toBeDefined();
    expect(screen.getByText("This is another test notification")).toBeDefined();
  });

  it("displays correct unread notification count", () => {
    render(
      <AppNotification
        notifications={mockNotifications}
        setNotifications={mockSetNotifications}
        setDrawerExpanded={mockSetDrawerExpanded}
      />
    );

    expect(screen.getByText("1 unread")).toBeDefined();
  });

  it("marks a notification as read when clicked", () => {
    const setNotifications = vi.fn((updater) => {
      const updatedNotifications = updater(mockNotifications);
      render(
        <AppNotification
          notifications={updatedNotifications}
          setNotifications={setNotifications}
          setDrawerExpanded={mockSetDrawerExpanded}
        />
      );
    });

    render(
      <AppNotification
        notifications={mockNotifications}
        setNotifications={setNotifications}
        setDrawerExpanded={mockSetDrawerExpanded}
      />
    );

    expect(screen.getByText("1 unread")).toBeDefined();

    fireEvent.click(screen.getByText("Test Notification 1"));

    expect(setNotifications).toHaveBeenCalled();
    expect(screen.getByText("0 unread")).toBeDefined();
  });

  it('removes a notification when "Clear" is clicked', async () => {
    let currentNotifications = [...mockNotifications];
    const setNotifications = vi.fn((updater) => {
      currentNotifications = updater(currentNotifications);
      rerender(
        <AppNotification
          notifications={currentNotifications}
          setNotifications={setNotifications}
          setDrawerExpanded={mockSetDrawerExpanded}
        />
      );
    });

    const { rerender } = render(
      <AppNotification
        notifications={currentNotifications}
        setNotifications={setNotifications}
        setDrawerExpanded={mockSetDrawerExpanded}
      />
    );

    expect(screen.getByText("Test Notification 1")).toBeInTheDocument();

    // Open the dropdown for the first notification
    await act(async () => {
      fireEvent.click(screen.getAllByLabelText(/Notification \d+ actions/)[0]);
    });

    // Click the "Clear" option
    await act(async () => {
      fireEvent.click(screen.getByText("Clear"));
    });

    expect(setNotifications).toHaveBeenCalled();

    // Wait for the component to update
    await waitFor(() => {
      expect(screen.queryByText("Test Notification 1")).not.toBeInTheDocument();
    });
  });

  it('marks all notifications as read when "Mark all read" is clicked', async () => {
    let currentNotifications = [...mockNotifications];
    const setNotifications = vi.fn((updater) => {
      currentNotifications = updater(currentNotifications);
      rerender(
        <AppNotification
          notifications={currentNotifications}
          setNotifications={setNotifications}
          setDrawerExpanded={mockSetDrawerExpanded}
        />
      );
    });

    const { rerender } = render(
      <AppNotification
        notifications={currentNotifications}
        setNotifications={setNotifications}
        setDrawerExpanded={mockSetDrawerExpanded}
      />
    );

    // Open the main dropdown
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Notification drawer actions"));
    });

    // Wait for any pending updates
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Mark all read"));
    });

    expect(setNotifications).toHaveBeenCalled();
    expect(screen.getByText("0 unread")).toBeDefined();
    expect(screen.getByText("Test Notification 1")).toBeDefined();
    expect(screen.getByText("Test Notification 2")).toBeDefined();
  });

  it('clears all notifications when "Clear all" is clicked', async () => {
    let currentNotifications = [...mockNotifications];
    const setNotifications = vi.fn((newNotificationsOrUpdater) => {
      if (typeof newNotificationsOrUpdater === "function") {
        currentNotifications = newNotificationsOrUpdater(currentNotifications);
      } else {
        currentNotifications = newNotificationsOrUpdater;
      }
      rerender(
        <AppNotification
          notifications={currentNotifications}
          setNotifications={setNotifications}
          setDrawerExpanded={mockSetDrawerExpanded}
        />
      );
    });

    const { rerender } = render(
      <AppNotification
        notifications={currentNotifications}
        setNotifications={setNotifications}
        setDrawerExpanded={mockSetDrawerExpanded}
      />
    );

    expect(screen.getByText("1 unread")).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Notification drawer actions"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Clear all"));
    });

    expect(setNotifications).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("0 unread")).toBeDefined();
      expect(screen.getByText("No notifications found")).toBeDefined();
      expect(
        screen.getByText("There are currently no notifications.")
      ).toBeDefined();
    });
  });

  it("renders empty state when there are no notifications", () => {
    render(
      <AppNotification
        notifications={[]}
        setNotifications={mockSetNotifications}
        setDrawerExpanded={mockSetDrawerExpanded}
      />
    );

    expect(screen.getByText("No notifications found")).toBeDefined();
    expect(
      screen.getByText("There are currently no notifications.")
    ).toBeDefined();
  });
});
