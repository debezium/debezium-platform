import React, { FC } from "react";
import { Breadcrumb, BreadcrumbItem } from "@patternfly/react-core";
import { useLocation, useNavigate } from "react-router-dom";

const BreadcrumbGenerator: FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <Breadcrumb ouiaId="BasicBreadcrumb">{children}</Breadcrumb>;
};

const generateBreadcrumbItem = (
  url: string,
  label: string,
  navigate: ReturnType<typeof useNavigate>,
  isCurrent: boolean = false
) => {
  return (
    <BreadcrumbItem 
      key={label} 
      isActive={isCurrent}
      onClick={(e) => {
        e.preventDefault();
        navigate(url);
      }}
      to={url}
    >
      {label}
    </BreadcrumbItem>
  );
};

const AppBreadcrumb: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const appBreadcrumb = (route: string) => {
    switch (true) {
      case route.match("/source/catalog") !== null:
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/source", "Source", navigate)}
            {generateBreadcrumbItem("#", "Catalog", navigate, true)}
          </BreadcrumbGenerator>
        );
      case route.includes("/source/create_source"):
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/source", "Source", navigate)}
            {generateBreadcrumbItem("/source/catalog", "Catalog", navigate)}
            {generateBreadcrumbItem("#", "Create source", navigate, true)}
          </BreadcrumbGenerator>
        );
      case route.match(/^\/source\/[^/]+$/) !== null && !route.includes("/create_source"):
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/source", "Source", navigate)}
            {generateBreadcrumbItem("#", "Edit source", navigate, true)}
          </BreadcrumbGenerator>
        );
      case route === "/destination/catalog":
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/destination", "Destination", navigate)}
            {generateBreadcrumbItem("#", "Catalog", navigate, true)}
          </BreadcrumbGenerator>
        );
      case route.includes("/destination/create_destination"):
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/destination", "Destination", navigate)}
            {generateBreadcrumbItem("/destination/catalog", "Catalog", navigate)}
            {generateBreadcrumbItem("#", "Create destination", navigate, true)}
          </BreadcrumbGenerator>
        );
      case route.match(/^\/destination\/[^/]+$/) !== null && !route.includes("/create_destination"):
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/destination", "Destination", navigate)}
            {generateBreadcrumbItem("#", "Edit destination", navigate, true)}
          </BreadcrumbGenerator>
        );
        case route === "/connections/catalog":
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/connections", "Connections", navigate)}
            {generateBreadcrumbItem("#", "Catalog", navigate, true)}
          </BreadcrumbGenerator>
        );
        case route.includes("/connections/create_connection"):
          return (
            <BreadcrumbGenerator>
              {generateBreadcrumbItem("/connections", "Connections", navigate)}
              {generateBreadcrumbItem("/connections/catalog", "Catalog", navigate)}
              {generateBreadcrumbItem("#", "Create connection", navigate, true)}
            </BreadcrumbGenerator>
          );
        case route.match(/^\/connections\/[^/]+$/) !== null && !route.includes("/create_connection"):
          return (
            <BreadcrumbGenerator>
              {generateBreadcrumbItem("/connections", "Connections", navigate)}
              {generateBreadcrumbItem("#", "Edit connection", navigate, true)}
            </BreadcrumbGenerator>
          );
      case route === "/pipeline/pipeline_designer":
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline", navigate)}
            {generateBreadcrumbItem("#", "Pipeline designer", navigate, true)}
          </BreadcrumbGenerator>
        );
      case route === "/pipeline/pipeline_designer/configure":
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline", navigate)}
            {generateBreadcrumbItem("/pipeline/pipeline_designer", "Pipeline designer", navigate)}
            {generateBreadcrumbItem("#", "Create pipeline", navigate, true)}
          </BreadcrumbGenerator>
        );
      case route === "/pipeline/pipeline_designer/destination":
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline", navigate)}
            {generateBreadcrumbItem(
              "/pipeline/pipeline_designer",
              "Pipeline designer",
              navigate
            )}
            {generateBreadcrumbItem("#", "Create pipeline", navigate, true)}
          </BreadcrumbGenerator>
        );
      case route.includes(
        "/pipeline/pipeline_designer/destination/new_destination"
      ):
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline", navigate)}
            {generateBreadcrumbItem(
              "/pipeline/pipeline_designer",
              "Pipeline designer",
              navigate
            )}
            {generateBreadcrumbItem("#", "Create pipeline", navigate, true)}
          </BreadcrumbGenerator>
        );
      case route.match("/pipeline/pipeline_edit/[^/]+") !== null:
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline", navigate)}
            {generateBreadcrumbItem("#", "indra-ui-test", navigate, true)}
            {generateBreadcrumbItem("#", "Edit", navigate, true)}
          </BreadcrumbGenerator>
        );
      case route.match(/^\/pipeline\/[^/]+\/(overview|logs|edit|action)$/) !== null: {
        const detailsTab = route.split("/").pop() || "overview";
        const tabLabels: Record<string, string> = {
          overview: "Overview",
          logs: "Pipeline logs",
          edit: "Edit pipeline",
          action: "Pipeline actions",
        };
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline", navigate)}
            {generateBreadcrumbItem(
              "#",
              tabLabels[detailsTab] ?? "Overview",
              navigate,
              true
            )}
          </BreadcrumbGenerator>
        );
      }
      default:
        return <></>;
    }
  };
  return <>{appBreadcrumb(location.pathname)}</>;
};

export default AppBreadcrumb;
