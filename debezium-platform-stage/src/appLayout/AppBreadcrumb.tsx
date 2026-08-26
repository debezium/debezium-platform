import { FC } from "react";
import i18next from "../i18n";
import { Breadcrumb, BreadcrumbItem } from "@patternfly/react-core";
import { useLocation, useNavigate, NavigateFunction } from "react-router-dom";
import { getPipelineDetailsRoutePattern, isFeatureAccessible } from "@utils/featureFlag";

interface BreadcrumbTrailItem {
  url: string;
  label: string;
}

export const getBreadcrumbTrail = (route: string): BreadcrumbTrailItem[] => {
  const pipelineDetailsPattern = getPipelineDetailsRoutePattern();

  switch (true) {
    case route.match("/source/catalog") !== null:
      return [
        { url: "/source", label: i18next.t("breadcrumb.source")   },
        { url: "#", label: i18next.t("breadcrumb.catalog") },
      ];
    case route.includes("/source/create_source"):
      return [
        { url: "/source", label: i18next.t("breadcrumb.source") },
        { url: "/source/catalog", label: i18next.t("breadcrumb.catalog") },
        { url: "#", label: i18next.t("breadcrumb.createResource", { val : "source"}) },
      ];
    case route.match(/^\/source\/[^/]+$/) !== null && !route.includes("/create_source"):
      return [
        { url: "/source", label: i18next.t("breadcrumb.source") },
        { url: "#", label: i18next.t("breadcrumb.editResource", { val : "source"}) },
      ];
    case route === "/destination/catalog":
      return [
        { url: "/destination", label: i18next.t("breadcrumb.destination") },
        { url: "#", label: i18next.t("breadcrumb.catalog") },
      ];
    case route.includes("/destination/create_destination"):
      return [
        { url: "/destination", label: i18next.t("breadcrumb.destination") },
        { url: "/destination/catalog", label: i18next.t("breadcrumb.catalog") },
        { url: "#", label: i18next.t("breadcrumb.createResource", { val : "destination"}) },
      ];
    case route.match(/^\/destination\/[^/]+$/) !== null && !route.includes("/create_destination"):
      return [
        { url: "/destination", label: i18next.t("breadcrumb.destination") },
        { url: "#", label: i18next.t("breadcrumb.editResource", { val : "destination"}) },
      ];
    case route === "/connections/catalog":
      return [
        { url: "/connections", label: i18next.t("breadcrumb.connection") },
        { url: "#", label: i18next.t("breadcrumb.catalog") },
      ];
    case route.includes("/connections/create_connection"):
      return [
        { url: "/connections", label: i18next.t("breadcrumb.connection") },
        { url: "/connections/catalog", label: i18next.t("breadcrumb.catalog") },
        { url: "#", label: i18next.t("breadcrumb.createResource", { val : "connection"}) },
      ];
    case route.match(/^\/connections\/[^/]+$/) !== null && !route.includes("/create_connection"):
      return [
        { url: "/connections", label: i18next.t("breadcrumb.connection") },
        { url: "#", label: i18next.t("breadcrumb.editResource", { val : "connection"}) },
      ];
    case isFeatureAccessible("Alerts") && route.includes("/alerts/rules/create_rule"):
      return [
         { url: "/alerts/history", label: i18next.t("breadcrumb.alert") },
        { url: "/alerts/rules", label:  i18next.t("breadcrumb.rule")  },
        { url: "#", label: i18next.t("breadcrumb.createResource", { val : "rule"}) },
      ];
    case isFeatureAccessible("Alerts") && route.match(/^\/alerts\/rules\/[^/]+$/) !== null:
      return [
         { url: "/alerts/history", label:  i18next.t("breadcrumb.alert")  },
        { url: "/alerts/rules", label:  i18next.t("breadcrumb.rule")  },
        { url: "#", label: i18next.t("breadcrumb.editResource", { val : "rule"}) },
      ];
    case route === "/pipeline/pipeline_designer":
      return [
        { url: "/pipeline", label: i18next.t("breadcrumb.pipeline")  },
        { url: "#", label: i18next.t("breadcrumb.pipelineDesigner") },
      ];
    case route === "/pipeline/pipeline_designer/create_pipeline":
      return [
        { url: "/pipeline", label: i18next.t("breadcrumb.pipeline") },
        { url: "/pipeline/pipeline_designer", label: i18next.t("breadcrumb.pipelineDesigner") },
        { url: "#", label: i18next.t("breadcrumb.createResource", { val : "pipeline"}) },
      ];
    case route === "/pipeline/pipeline_designer/destination":
      return [
        { url: "/pipeline", label: i18next.t("breadcrumb.pipeline")  },
        { url: "/pipeline/pipeline_designer", label: i18next.t("breadcrumb.pipelineDesigner") },
        { url: "#", label: i18next.t("breadcrumb.createResource", { val : "pipeline"})},
      ];
    case route.includes("/pipeline/pipeline_designer/destination/new_destination"):
      return [
        { url: "/pipeline", label: i18next.t("breadcrumb.pipeline")  },
        { url: "/pipeline/pipeline_designer", label: i18next.t("breadcrumb.pipelineDesigner") },
        { url: "#", label: i18next.t("breadcrumb.createResource", { val : "pipeline"}) },
      ];
    case route.match("/pipeline/pipeline_edit/[^/]+") !== null:
      return [
        { url: "/pipeline", label: i18next.t("breadcrumb.pipeline") },
        { url: "#", label: "indra-ui-test" },
        { url: "#", label: "Edit" },
      ];
    case route.match(pipelineDetailsPattern) !== null: {
      const detailsTab = route.split("/").pop() || "overview";
      const tabLabels: Record<string, string> = {
        overview: i18next.t("breadcrumb.overview"),
        logs: i18next.t("breadcrumb.log"),
        edit:  i18next.t("breadcrumb.editResource", { val : "pipeline"}),
        action: i18next.t("breadcrumb.action"),
        monitoring: i18next.t("breadcrumb.monitoring"),
      };
      return [
        { url: "/pipeline", label: i18next.t("breadcrumb.pipeline") },
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
