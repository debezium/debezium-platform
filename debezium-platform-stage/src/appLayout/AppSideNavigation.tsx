import {
  PageSidebar,
  PageSidebarBody,
  Nav,
  NavList,
  NavItem,
  NavExpandable,
} from "@patternfly/react-core";
import React, {  } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { IAppRoute, IAppRouteGroup, routes } from "../route";

interface AppSideNavigationProps {
  isSidebarOpen: boolean;
}

const AppSideNavigation: React.FC<AppSideNavigationProps> = ({
  isSidebarOpen,
}) => {
  const location = useLocation();

  const renderNavItem = (route: IAppRoute, index: number) => (
    <NavItem
      key={`${route.label}-${index}`}
      id={`${route.label}-${index}`}
      isActive={location.pathname.includes(route.navSection)}
    >
      <NavLink to={route.path}>
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
        {/* <Tooltip content={<div>{route.label}</div>}>{route.icon}</Tooltip> */}
        {route.icon}
      </NavLink>
    </NavItem>
  );

  const renderNavGroup = (group: IAppRouteGroup, groupIndex: number) => (
    <NavExpandable
      key={`${group.label}-${groupIndex}`}
      id={`${group.label}-${groupIndex}`}
      title={group.label}
      isActive={group.routes.some((route) => route.path === location.pathname)}
    >
      {group.routes.map(
        (route, idx) => route.label && renderNavItem(route, idx)
      )}
    </NavExpandable>
  );

  const Navigation = (
    <Nav id="nav-primary-simple">
      <NavList id="nav-list-simple">
        {routes.map(
          (route, idx) =>
            route.label &&
            (!route.routes
              ? renderNavItem(route, idx)
              : renderNavGroup(route, idx))
        )}
      </NavList>
    </Nav>
  );

  const NavigationClosed = (
    <Nav id="nav-primary-simple">
      <NavList id="nav-list-simple">
        {routes.map(
          (route, idx) =>
            route.label &&
            (!route.routes
              ? renderNavIcon(route, idx)
              : renderNavGroup(route, idx))
        )}
      </NavList>
    </Nav>
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
