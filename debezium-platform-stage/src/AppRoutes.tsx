import React from "react";
import { Route, Routes } from "react-router-dom";
import { NotFound } from "./pages/NotFound/NotFound";
import { useTranslation } from "react-i18next"; 
import { useDocumentTitle } from "./utils/useDocumentTitle";
import { AppBranding } from "./utils/constants";
import { IAppRoute, isRouteAccessible, isRouteGroup, routes } from "./route";


const PageWithTitle = ({
  title,
  component: Component,
}: {
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>;
}) => {
  useDocumentTitle(title);
  return <Component />;
};

// Route groups (nested sidebar sections) don't carry their own path/component,
// so flatten them into their leaf routes before registering <Route> elements.
const getFlattenedRoutes = (): IAppRoute[] =>
  routes
    .flatMap((route) => (isRouteGroup(route) ? route.routes : [route]))
    .filter(isRouteAccessible);

const AppRoutes = (): React.ReactElement => {
   const { t } = useTranslation(); 
  return (
  <Routes>
    {getFlattenedRoutes().map((route, index) => (
      <Route
        key={route.label || index}
        path={route.path}
        element={
          <PageWithTitle title={route.title} component={route.component} />
        }
      />
    ))}
    <Route
      path="*"
      element={
        <PageWithTitle
          title={`${AppBranding} | ${t("notFound")}`}
          component={NotFound}
        />
      }
    />
  </Routes>
)};

export { AppRoutes };
