import {
  AlertGroup,
  NotificationBadgeVariant,
  Page,
} from "@patternfly/react-core";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppBreadcrumb, { getBreadcrumbTrail } from "./AppBreadcrumb";
import "./AppLayout.css";
import AppHeader from "./AppHeader";
import AppSideNavigation from "./AppSideNavigation";
import GroupSubNav, { useActiveGroupSubNav } from "./GroupSubNav";
import { useLocation } from "react-router-dom";
import { useData } from "./AppContext";
import { useNotification } from "./AppNotificationContext";
import AppNotification from "./AppNotification";
import { useSetAtom } from "jotai";
import {
  selectedSourceAtom,
  selectedDestinationAtom,
  selectedTransformAtom,
} from "../pages/Pipeline/PipelineDesigner";
import GuidedTour from "../components/GuidedTour";
import { useGuidedTour } from "../components/GuidedTourContext";
import DocHelpDrawer from "../components/DocHelpDrawer";

interface IAppLayout {
  children: React.ReactNode;
}

// Below this width (1200px) the side navigation is always shown in compact mode.
const NARROW_QUERY = "(max-width: 1199px)";
const isNarrowScreen = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia(NARROW_QUERY).matches;

const AppLayout: React.FunctionComponent<IAppLayout> = ({ children }) => {
  const location = useLocation();
  const pageId = "primary-app-container";

  const { isTourActive } = useGuidedTour();

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // On reduced screens always start with the compact navigation
    if (isNarrowScreen()) return false;
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

  const { updateNavigationCollapsed } = useData();

  const activeGroupSubNav = useActiveGroupSubNav();
  const hasBreadcrumb = getBreadcrumbTrail(location.pathname).length > 0;

  const setSelectedSource = useSetAtom(selectedSourceAtom);
  const setSelectedDestination = useSetAtom(selectedDestinationAtom);
  const setSelectedTransform = useSetAtom(selectedTransformAtom);

  const toggleSidebar = useCallback(() => {
    // The navigation stays compact on reduced screens, so ignore the toggle there
    if (isNarrowScreen()) return;
    setSidebarOpen(!sidebarOpen);
    updateNavigationCollapsed(sidebarOpen);
  }, [updateNavigationCollapsed, sidebarOpen]);

  // Auto-collapse the extended nav to the compact nav on narrow screens.
  // Intentionally calls setSidebarOpen directly (not toggleSidebar) so the
  // user's saved preference is not overwritten by an automatic collapse.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return; // e.g. jsdom in tests
    const mq = window.matchMedia(NARROW_QUERY);
    const collapseIfNarrow = () => {
      if (mq.matches) {
        setSidebarOpen(false);
      }
    };
    collapseIfNarrow();
    mq.addEventListener("change", collapseIfNarrow);
    return () => mq.removeEventListener("change", collapseIfNarrow);
  }, []);

  const overflowMessage = useMemo(() => {
    const overflow = alerts.length - 3;
    if (overflow > 0 && 3 > 0) {
      return `View ${overflow} more notification(s) in notification drawer`;
    }
    return "";
  }, [alerts]);

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

  // Clear pipeline atoms when navigating away from pipeline designer
  useEffect(() => {
    const isPipelineDesignerPage = 
      location.pathname.startsWith("/pipeline/pipeline_designer");

    if (!isPipelineDesignerPage) {
      setSelectedSource(undefined);
      setSelectedDestination(undefined);
      setSelectedTransform([]);
    }
  }, [location.pathname, setSelectedSource, setSelectedDestination, setSelectedTransform]);

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
    <DocHelpDrawer>
      {isTourActive && <GuidedTour />}
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
        horizontalSubnav={activeGroupSubNav ? <GroupSubNav /> : undefined}
        isHorizontalSubnavWidthLimited
        breadcrumb={hasBreadcrumb ? <AppBreadcrumb /> : undefined}
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
    </DocHelpDrawer>
  );
};

export { AppLayout };