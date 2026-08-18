import {
  PageSidebar,
  PageSidebarBody,
  Nav,
  NavList,
  NavItem,
  NavExpandable,
  Tooltip,
} from "@patternfly/react-core";
import React, {  } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { IAppRoute, IAppRouteGroup, isNavRouteVisible, isRouteGroup, routes } from "../route";

interface AppSideNavigationProps {
  isSidebarOpen: boolean;
}

const AppSideNavigation: React.FC<AppSideNavigationProps> = ({
  isSidebarOpen,
}) => {
  const location = useLocation();

  // A group is only worth showing in the sidebar if at least one of its
  // children is visible; otherwise it would render as an empty, dead-end expandable.
  const visibleRoutes = routes.filter((route) =>
    isRouteGroup(route)
      ? route.routes.some((child) => isNavRouteVisible(child))
      : isNavRouteVisible(route)
  );

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
        {/* {route.icon} */}
      </NavLink>
    </NavItem>
  );

  const isGroupActive = (group: IAppRouteGroup) =>
    group.routes.some((route) => location.pathname.includes(route.navSection));

  const renderNavGroup = (group: IAppRouteGroup, groupIndex: number) => (
    <NavExpandable
      key={`${group.label}-${groupIndex}`}
      id={`${group.label}-${groupIndex}`}
      title={group.label}
      icon={group.icon}
      isActive={isGroupActive(group)}
      isExpanded={isGroupActive(group)}
    >
      {group.routes.map(
        (route, idx) =>
          isNavRouteVisible(route) && renderNavItem(route, idx, true)
      )}
    </NavExpandable>
  );

  // The custom collapsed/icon-rail sidebar has no room for an expandable list, so
  // collapse the group down to a single icon that links to its first visible child.
  const renderNavGroupIcon = (group: IAppRouteGroup, groupIndex: number) => {
    const firstVisibleRoute = group.routes.find(isNavRouteVisible);
    if (!firstVisibleRoute) return null;
    return (
      <NavItem
        key={`${group.label}-${groupIndex}`}
        id={`${group.label}-${groupIndex}`}
        isActive={isGroupActive(group)}
      >
        <NavLink
          to={firstVisibleRoute.path}
          style={{ fontSize: "20px", flexDirection: "column" }}
        >
          <Tooltip position="right" content={<div>{group.label}</div>}>{group.icon}</Tooltip>
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
