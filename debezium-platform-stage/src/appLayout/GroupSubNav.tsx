import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Nav, NavItem, NavList } from "@patternfly/react-core";
import { IAppRoute, IAppRouteGroup, findRouteGroupForPath, isNavRouteVisible } from "../route";
import { useData } from "./AppContext";

interface ActiveGroupSubNav {
  group: IAppRouteGroup;
  routes: IAppRoute[];
}

// Generic fallback for ANY sidebar NavExpandable group its nested items shown as a 
// horizontal subnav for whichever group the current page belongs to.
//
// Exposed as a hook so `AppLayout` can know *before* rendering whether there's anything to show
// and only pass `<GroupSubNav />` into Page's `horizontalSubnav` prop when its sub nav
export const useActiveGroupSubNav = (): ActiveGroupSubNav | null => {
  const location = useLocation();
  const { navigationCollapsed } = useData();

  if (!navigationCollapsed) return null;

  const group = findRouteGroupForPath(location.pathname);
  if (!group) return null;

  const routes = group.routes.filter(isNavRouteVisible);
  if (routes.length === 0) return null;

  return { group, routes };
};

const GroupSubNav: React.FunctionComponent = () => {
  const location = useLocation();
  const active = useActiveGroupSubNav();

  if (!active) return null;

  const { group, routes } = active;

  return (
    <Nav aria-label={`${group.label} sub-navigation`} variant="horizontal-subnav">
      <NavList>
        {routes.map((route) => (
          <NavItem key={route.path} isActive={location.pathname.startsWith(route.path)}>
            <NavLink to={route.path}>{route.label}</NavLink>
          </NavItem>
        ))}
      </NavList>
    </Nav>
  );
};

export default GroupSubNav;
