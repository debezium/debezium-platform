import {
  PageSidebar,
  PageSidebarBody,
  Nav,
  NavList,
  NavItem,
  NavExpandable,
} from "@patternfly/react-core";
import { MoonIcon, SunIcon } from "@patternfly/react-icons";
import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { IAppRoute, IAppRouteGroup, routes } from "../route";
import { useData } from "./AppContext";

interface AppSideNavigationProps {
  isSidebarOpen: boolean;
}

const AppSideNavigation: React.FC<AppSideNavigationProps> = ({
  isSidebarOpen,
}) => {
  const location = useLocation();

  const { setDarkMode } = useData();

  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("themeMode") === "dark"
  );

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    setDarkMode(newDarkMode);
    localStorage.setItem("themeMode", newDarkMode ? "dark" : "light");
    document.documentElement.classList.toggle("pf-v6-theme-dark");
  };

  useEffect(() => {
    const storedThemeMode = localStorage.getItem("themeMode");
    if (storedThemeMode === "dark") {
      setDarkMode(storedThemeMode === "dark");
      document.documentElement.classList.add("pf-v6-theme-dark");
    }
  }, [setDarkMode]);

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

      <PageSidebarBody isFilled={false} className="custom-app-page__sidebar-body">
        {isSidebarOpen ? (
          <Nav className="pf-v6-c-nav">
            <NavList>
              <NavItem onClick={toggleDarkMode}>
                <div
                  className="pf-v6-c-nav__link"
                  style={{ cursor: "pointer" }}
                >
                  {isDarkMode ? (
                    <>
                      <SunIcon /> Light mode
                    </>
                  ) : (
                    <>
                      <MoonIcon /> Dark mode
                    </>
                  )}
                </div>
              </NavItem>
            </NavList>
          </Nav>
        ) : (
          <Nav className="pf-v6-c-nav">
            <NavList>
              <NavItem onClick={toggleDarkMode}>
                <div
                  className="pf-v6-c-nav__link"
                  style={{ fontSize: "20px", cursor: "pointer" }}
                >
                  {isDarkMode ? <SunIcon /> : <MoonIcon />}
                </div>
              </NavItem>
            </NavList>
          </Nav>
        )}
      </PageSidebarBody>
    </PageSidebar>
  );
};

export default AppSideNavigation;
