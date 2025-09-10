import React, { FC } from "react";
import { Breadcrumb, BreadcrumbItem } from "@patternfly/react-core";
import { useLocation } from "react-router-dom";

const BreadcrumbGenerator: FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <Breadcrumb ouiaId="BasicBreadcrumb">{children}</Breadcrumb>;
};

const generateBreadcrumbItem = (
  url: string,
  label: string,
  isCurrent: boolean = false
) => {
  return (
    <BreadcrumbItem key={label} isActive={isCurrent} to={url}>
      {label}
    </BreadcrumbItem>
  );
};

const AppBreadcrumb: React.FC = () => {
  const location = useLocation();

  const appBreadcrumb = (route: string) => {
    switch (true) {
      case route.match("/source/catalog") !== null:
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/source", "Source")}
            {generateBreadcrumbItem("#", "Catalog", true)}
          </BreadcrumbGenerator>
        );
      case route.match("source/[^/]+") !== null:
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/source", "Source")}
            {generateBreadcrumbItem("#", "Edit source", true)}
          </BreadcrumbGenerator>
        );
      case route.includes("/source/create_source"):
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/source", "Source")}
            {generateBreadcrumbItem("/source/catalog", "Catalog")}
            {generateBreadcrumbItem("#", "Create source", true)}
          </BreadcrumbGenerator>
        );
      case route === "/destination/catalog":
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/destination", "Destination")}
            {generateBreadcrumbItem("#", "Catalog", true)}
          </BreadcrumbGenerator>
        );
      case route.match("destination/[^/]+") !== null:
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/destination", "Destination")}
            {generateBreadcrumbItem("#", "Edit destination", true)}
          </BreadcrumbGenerator>
        );
      case route.includes("/destination/create_destination"):
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/destination", "Destination")}
            {generateBreadcrumbItem("/destination/catalog", "Catalog")}
            {generateBreadcrumbItem("#", "Create destination", true)}
          </BreadcrumbGenerator>
        );
        case route.includes("/connections/create_connection"):
          return (
            <BreadcrumbGenerator>
              {generateBreadcrumbItem("/connections", "Connections")}
              {generateBreadcrumbItem("#", "Create connection", true)}
            </BreadcrumbGenerator>
          );
      case route === "/pipeline/pipeline_designer":
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline")}
            {generateBreadcrumbItem("#", "Pipeline designer", true)}
          </BreadcrumbGenerator>
        );
      case route.match("/pipeline/[^/]+") !== null:
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline")}
            {generateBreadcrumbItem("#", "Overview", true)}
          </BreadcrumbGenerator>
        );
      case route.match("/pipeline/pipeline_edit/[^/]+") !== null:
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline")}
            {generateBreadcrumbItem("#", "indra-ui-test", true)}
            {generateBreadcrumbItem("#", "Edit", true)}
          </BreadcrumbGenerator>
        );
      case route === "/pipeline/pipeline_designer/configure":
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline")}
            {generateBreadcrumbItem("#", "Pipeline designer")}
            {generateBreadcrumbItem("#", "Create pipeline")}
          </BreadcrumbGenerator>
        );
      case route === "/pipeline/pipeline_designer/destination":
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline")}
            {generateBreadcrumbItem(
              "/pipeline/pipeline_designer",
              " Pipeline designer"
            )}
            {generateBreadcrumbItem("#", "Destination", true)}
          </BreadcrumbGenerator>
        );
      case route.includes(
        "/pipeline/pipeline_designer/destination/new_destination"
      ):
        return (
          <BreadcrumbGenerator>
            {generateBreadcrumbItem("/pipeline", "Pipeline")}
            {generateBreadcrumbItem(
              "/pipeline/pipeline_designer",
              "Pipeline designer"
            )}
            {generateBreadcrumbItem(
              "pipeline/pipeline_designer/destination",
              "Destination"
            )}
            {generateBreadcrumbItem("#", "Create destination", true)}
          </BreadcrumbGenerator>
        );
      default:
        return <></>;
    }
  };
  return <>{appBreadcrumb(location.pathname)}</>;
};

export default AppBreadcrumb;
