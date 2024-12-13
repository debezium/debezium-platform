import {
  AlertGroup,
  NotificationBadgeVariant,
  Page,
} from "@patternfly/react-core";
import { useCallback, useEffect, useState } from "react";
import AppBreadcrumb from "./AppBreadcrumb";
import "./AppLayout.css";
import AppHeader from "./AppHeader";
import AppSideNavigation from "./AppSideNavigation";
import { useLocation } from "react-router-dom";
import { useData } from "./AppContext";
// import AppNotification from "./AppNotification";
import { useNotification } from "./AppNotificationContext";
import AppNotification from "./AppNotification";

interface IAppLayout {
  children: React.ReactNode;
}

const AppLayout: React.FunctionComponent<IAppLayout> = ({ children }) => {
  const location = useLocation();
  const pageId = "primary-app-container";

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const savedPreference = localStorage.getItem("side-nav-collapsed");
    return savedPreference ? !JSON.parse(savedPreference) : true;
  });

  const {
    notifications,
    alerts,
    isDrawerExpanded,
    addNotification,
    setDrawerExpanded,
    setAlerts,
    setNotifications,
  } = useNotification();

  const [overflowMessage, setOverflowMessage] = useState<string>("");
  const { updateNavigationCollapsed } = useData();

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
    updateNavigationCollapsed(sidebarOpen);
  }, [updateNavigationCollapsed, sidebarOpen]);

  const buildOverflowMessage = () => {
    const overflow = alerts.length - 3;
    if (overflow > 0 && 3 > 0) {
      return `View ${overflow} more notification(s) in notification drawer`;
    }
    return "";
  };

  const getUnreadNotificationsNumber = () =>
    notifications.filter(
      (notification) => notification.isNotificationRead === false
    ).length;

  const containsUnreadAlertNotification = () =>
    notifications.filter(
      (notification) =>
        notification.isNotificationRead === false &&
        notification.variant === "danger"
    ).length > 0;

  const getNotificationBadgeVariant = () => {
    if (getUnreadNotificationsNumber() === 0) {
      return NotificationBadgeVariant.read;
    }
    if (containsUnreadAlertNotification()) {
      return NotificationBadgeVariant.attention;
    }
    return NotificationBadgeVariant.unread;
  };

  useEffect(() => {
    setOverflowMessage(buildOverflowMessage());
  }, [notifications, alerts]);

  const removeAllAlerts = () => {
    setAlerts([]);
  };

  const onAlertGroupOverflowClick = () => {
    removeAllAlerts();
    setDrawerExpanded(true);
  };

  const onNotificationBadgeClick = () => {
    removeAllAlerts();
    setDrawerExpanded(!isDrawerExpanded);
  };

  return (
    <>
      <Page
        className={sidebarOpen ? "" : "custom-app-page"}
        mainContainerId={pageId}
        masthead={
          <AppHeader
            toggleSidebar={toggleSidebar}
            handleNotificationBadgeClick={onNotificationBadgeClick}
            getNotificationBadgeVariant={getNotificationBadgeVariant}
            addNotification={addNotification}
          />
        }
        sidebar={<AppSideNavigation isSidebarOpen={sidebarOpen} />}
        isManagedSidebar
        isContentFilled
        breadcrumb={
          location.pathname.split("/").length <= 2 ? undefined : (
            <AppBreadcrumb />
          )
        }
        groupProps={{
          stickyOnBreakpoint: { default: "top" },
        }}
        notificationDrawer={
          <AppNotification
            notifications={notifications}
            setNotifications={setNotifications}
            setDrawerExpanded={setDrawerExpanded}
          />
        }
        isNotificationDrawerExpanded={isDrawerExpanded}
      >
        {children}
      </Page>
      <AlertGroup
        isToast
        isLiveRegion
        onOverflowClick={onAlertGroupOverflowClick}
        overflowMessage={overflowMessage}
      >
        {alerts.slice(0, 3)}
      </AlertGroup>
    </>
  );
};

export { AppLayout };
