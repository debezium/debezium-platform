import { FC } from "react";
import { Breadcrumb, BreadcrumbItem } from "@patternfly/react-core";
import { useLocation, useNavigate, NavigateFunction } from "react-router-dom";
import { getPipelineDetailsRoutePattern } from "@utils/featureFlag";

interface BreadcrumbTrailItem {
  url: string;
  label: string;
}

export const getBreadcrumbTrail = (route: string): BreadcrumbTrailItem[] => {
  const pipelineDetailsPattern = getPipelineDetailsRoutePattern();

  switch (true) {
    case route.match("/source/catalog") !== null:
      return [
        { url: "/source", label: "Source" },
        { url: "#", label: "Catalog" },
      ];
    case route.includes("/source/create_source"):
      return [
        { url: "/source", label: "Source" },
        { url: "/source/catalog", label: "Catalog" },
        { url: "#", label: "Create source" },
      ];
    case route.match(/^\/source\/[^/]+$/) !== null && !route.includes("/create_source"):
      return [
        { url: "/source", label: "Source" },
        { url: "#", label: "Edit source" },
      ];
    case route === "/destination/catalog":
      return [
        { url: "/destination", label: "Destination" },
        { url: "#", label: "Catalog" },
      ];
    case route.includes("/destination/create_destination"):
      return [
        { url: "/destination", label: "Destination" },
        { url: "/destination/catalog", label: "Catalog" },
        { url: "#", label: "Create destination" },
      ];
    case route.match(/^\/destination\/[^/]+$/) !== null && !route.includes("/create_destination"):
      return [
        { url: "/destination", label: "Destination" },
        { url: "#", label: "Edit destination" },
      ];
    case route === "/connections/catalog":
      return [
        { url: "/connections", label: "Connections" },
        { url: "#", label: "Catalog" },
      ];
    case route.includes("/connections/create_connection"):
      return [
        { url: "/connections", label: "Connections" },
        { url: "/connections/catalog", label: "Catalog" },
        { url: "#", label: "Create connection" },
      ];
    case route.match(/^\/connections\/[^/]+$/) !== null && !route.includes("/create_connection"):
      return [
        { url: "/connections", label: "Connections" },
        { url: "#", label: "Edit connection" },
      ];
    case route === "/pipeline/pipeline_designer":
      return [
        { url: "/pipeline", label: "Pipeline" },
        { url: "#", label: "Pipeline designer" },
      ];
    case route === "/pipeline/pipeline_designer/create_pipeline":
      return [
        { url: "/pipeline", label: "Pipeline" },
        { url: "/pipeline/pipeline_designer", label: "Pipeline designer" },
        { url: "#", label: "Create pipeline" },
      ];
    case route === "/pipeline/pipeline_designer/destination":
      return [
        { url: "/pipeline", label: "Pipeline" },
        { url: "/pipeline/pipeline_designer", label: "Pipeline designer" },
        { url: "#", label: "Create pipeline" },
      ];
    case route.includes("/pipeline/pipeline_designer/destination/new_destination"):
      return [
        { url: "/pipeline", label: "Pipeline" },
        { url: "/pipeline/pipeline_designer", label: "Pipeline designer" },
        { url: "#", label: "Create pipeline" },
      ];
    case route.match("/pipeline/pipeline_edit/[^/]+") !== null:
      return [
        { url: "/pipeline", label: "Pipeline" },
        { url: "#", label: "indra-ui-test" },
        { url: "#", label: "Edit" },
      ];
    case route.match(pipelineDetailsPattern) !== null: {
      const detailsTab = route.split("/").pop() || "overview";
      const tabLabels: Record<string, string> = {
        overview: "Overview",
        logs: "Pipeline logs",
        edit: "Edit pipeline",
        action: "Pipeline actions",
        monitoring: "Monitoring",
      };
      return [
        { url: "/pipeline", label: "Pipeline" },
        { url: "#", label: tabLabels[detailsTab] ?? "Overview" },
      ];
    }
    default:
      return [];
  }
};

const generateBreadcrumbItem = (
  item: BreadcrumbTrailItem,
  navigate: NavigateFunction,
  isCurrent: boolean
) => (
  <BreadcrumbItem
    key={item.label}
    isActive={isCurrent}
    onClick={(e) => {
      e.preventDefault();
      navigate(item.url);
    }}
    to={item.url}
  >
    {item.label}
  </BreadcrumbItem>
);

const AppBreadcrumb: FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const trail = getBreadcrumbTrail(location.pathname);
  if (trail.length === 0) return null;

  return (
    <Breadcrumb ouiaId="BasicBreadcrumb">
      {trail.map((item, index) =>
        generateBreadcrumbItem(item, navigate, index === trail.length - 1)
      )}
    </Breadcrumb>
  );
};

export default AppBreadcrumb;
