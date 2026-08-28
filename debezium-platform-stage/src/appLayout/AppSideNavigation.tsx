import {
  PageSidebar,
  PageSidebarBody,
  Nav,
  NavList,
  NavItem,
  NavExpandable,
  Tooltip,
  Label,
} from "@patternfly/react-core";
import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  getGroupDefaultPath,
  IAppRoute,
  IAppRouteGroup,
  isNavRouteVisible,
  isRouteGroup,
  routes,
} from "../route";
import { useAlertBadge } from "../pages/Alerts/useAlertBadge";
import "./AppSideNavigation.css";

interface AppSideNavigationProps {
  isSidebarOpen: boolean;
}

const isAlertsGroup = (group: IAppRouteGroup) =>
  group.routes.some((route) => route.featureFlag === "Alerts");

const AppSideNavigation: React.FC<AppSideNavigationProps> = ({
  isSidebarOpen,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const alertBadge = useAlertBadge();

  // A group is only worth showing in the sidebar if at least one of its
  // children is visible; otherwise it would render as an empty, dead-end expandable.
  const visibleRoutes = routes.filter((route) =>
    isRouteGroup(route)
      ? route.routes.some((child) => isNavRouteVisible(child))
      : isNavRouteVisible(route)
  );

  const renderAlertBadge = () => {
    if (!alertBadge.enabled || !alertBadge.labelStatus) {
      return null;
    }
    return (
      <Label
        isCompact
        status={alertBadge.labelStatus}
        className="alert-nav-badge"
        aria-label={alertBadge.ariaLabel}
      >
        {alertBadge.count > 0 ? alertBadge.count : ""}
      </Label>
    );
  };

  const getGroupNavPath = (group: IAppRouteGroup) => {
    if (isAlertsGroup(group) && alertBadge.enabled) {
      return alertBadge.navPath;
    }
    return getGroupDefaultPath(group);
  };

  const renderNavItem = (
    route: IAppRoute,
    index: number,
    isGroupChild = false
  ) => (
    <NavItem
      key={`${route.label}-${index}`}
      id={`${route.label}-${index}`}
      isActive={
        isGroupChild
          ? location.pathname.startsWith(route.path)
          : location.pathname.includes(route.navSection)
      }
    >
      <NavLink to={route.path} data-tour={`nav-${route.navSection}`}>
        {route.icon}
        {route.label}
      </NavLink>
    </NavItem>
  );

  const renderNavIcon = (route: IAppRoute, index: number) => (
    <NavItem
      key={`${route.label}-${index}`}
      id={`${route.label}-${index}`}
      isActive={location.pathname.includes(route.navSection)}
    >
      <NavLink
        to={route.path}
        style={{ fontSize: "20px", flexDirection: "column" }}
      >
        <Tooltip position="right" content={<div>{route.label}</div>}>{route.icon}</Tooltip>
      </NavLink>
    </NavItem>
  );

  const isGroupActive = (group: IAppRouteGroup) =>
    group.routes.some((route) => location.pathname.includes(route.navSection));

  const renderNavGroup = (group: IAppRouteGroup, groupIndex: number) => {
    const groupPath = getGroupNavPath(group);
    const showAlertsBadge = isAlertsGroup(group);
    const title = showAlertsBadge ? (
      <span className="alert-nav-group-title">
        {group.label}
        {renderAlertBadge()}
      </span>
    ) : (
      group.label
    );

    return (
      <NavExpandable
        key={`${group.label}-${groupIndex}`}
        id={`${group.label}-${groupIndex}`}
        className={showAlertsBadge ? "alert-nav-group" : undefined}
        title={title}
        icon={group.icon}
        isActive={isGroupActive(group)}
        isExpanded={isGroupActive(group)}
        {...(groupPath
          ? {
              onExpand: () => {
                navigate(groupPath);
              },
            }
          : {})}
      >
        {group.routes.map(
          (route, idx) =>
            isNavRouteVisible(route) && renderNavItem(route, idx, true)
        )}
      </NavExpandable>
    );
  };

  // The custom collapsed/icon-rail sidebar has no room for an expandable list, so
  // collapse the group down to a single icon that links to its default child.
  const renderNavGroupIcon = (group: IAppRouteGroup, groupIndex: number) => {
    const groupPath = getGroupNavPath(group);
    if (!groupPath) return null;
    const badge = isAlertsGroup(group) ? renderAlertBadge() : null;
    return (
      <NavItem
        key={`${group.label}-${groupIndex}`}
        id={`${group.label}-${groupIndex}`}
        isActive={isGroupActive(group)}
      >
        <NavLink
          to={groupPath}
          style={{ fontSize: "20px", flexDirection: "column" }}
        >
          <Tooltip position="right" content={<div>{group.label}</div>}>
            <span className="alert-nav-icon-wrap">
              {group.icon}
              {badge ? <span className="alert-nav-icon-badge">{badge}</span> : null}
            </span>
          </Tooltip>
        </NavLink>
      </NavItem>
    );
  };

  const Navigation = (
    <div data-tour="sidebar-nav">
    <Nav id="nav-primary-simple">
      <NavList id="nav-list-simple">
        {visibleRoutes.map(
          (route, idx) =>
            isRouteGroup(route)
              ? renderNavGroup(route, idx)
              : renderNavItem(route, idx)
        )}
      </NavList>
    </Nav>
    </div>
  );

  const NavigationClosed = (
    <div data-tour="sidebar-nav">
    <Nav id="nav-primary-simple">
      <NavList id="nav-list-simple">
        {visibleRoutes.map(
          (route, idx) =>
            isRouteGroup(route)
              ? renderNavGroupIcon(route, idx)
              : renderNavIcon(route, idx)
        )}
      </NavList>
    </Nav>
    </div>
  );

  return (
    <PageSidebar style={isSidebarOpen ? {} : { width: "fit-content", maxWidth: "fit-content" }}>
      <PageSidebarBody isFilled={true} className="custom-app-page__sidebar-body">
        {isSidebarOpen ? Navigation : NavigationClosed}
      </PageSidebarBody>
    </PageSidebar>
  );
};

export default AppSideNavigation;
