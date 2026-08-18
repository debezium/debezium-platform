import React from "react";
import { AppBranding } from "./utils/constants";
import {
  RhUiDataProcessorIcon,
  RhUiDataSinkIcon,
  RhUiDataSourceIcon,
  RhUiInfrastructureIcon,
  RhUiNotificationIcon,
} from "@patternfly/react-icons";
import { RhUiPathIcon as PipelineIcon } from "@patternfly/react-icons";
import { ServiceCatalogIcon as VaultIcon } from "@patternfly/react-icons";
import {
  CreateSource,
  EditSource,
  SourceCatalog,
  Sources,
} from "./pages/Source";
import {
  CreateDestination,
  DestinationCatalog,
  Destinations,
  EditDestination,
} from "./pages/Destination";
import {
  ConfigurePipeline,
  PipelineDesigner,
  PipelineDetails,
  Pipelines,
} from "./pages/Pipeline";
import { Transforms } from "./pages/Transforms";
import { Vaults } from "./pages/Vault";
import { Alerts } from "./pages/Alerts";
import { CreateTransforms } from "./pages/Transforms/CreateTransforms";
import { EditTransforms } from "./pages/Transforms/EditTransforms";
import { Connections } from "./pages/Connection/Connections";
import { CreateConnection } from "./pages/Connection/CreateConnection";
import { ConnectionsCatalog } from "./pages/Connection/ConnectionsCatalog";
import { EditConnection } from "./pages/Connection/EditConnection";
import { FeatureFlag, isRouteNavVisible } from "./utils/featureFlag";

export interface IAppRoute {
  label?: string; // Excluding the label will exclude the route from the nav sidebar in AppLayout
  /* eslint-disable @typescript-eslint/no-explicit-any */
  component: React.ComponentType<any>;
  path: string;
  navSection: string;
  title: string;
  icon?: React.ReactElement;
  featureFlag?: FeatureFlag;
  routes?: undefined;
}

export interface IAppRouteGroup {
  label: string;
  icon?: React.ReactElement;
  routes: IAppRoute[];
}

export type AppRouteConfig = IAppRoute | IAppRouteGroup;


export const isRouteGroup = (route: AppRouteConfig): route is IAppRouteGroup =>
  Array.isArray((route as IAppRouteGroup).routes);

// A leaf route is only worth navigating to if it has a label and isn't feature-hidden.
export const isNavRouteVisible = (route: IAppRoute): boolean =>
  !!route.label && isRouteNavVisible(route.featureFlag);

export const findRouteGroupForPath = (
  pathname: string
): IAppRouteGroup | undefined =>
  routes.find(
    (route): route is IAppRouteGroup =>
      isRouteGroup(route) &&
      route.routes.some((child) => pathname.includes(child.navSection))
  );

const routes: AppRouteConfig[] = [
  {
    component: Pipelines,
    path: "/",
    navSection: "pipeline",
    title: `${AppBranding} | Pipeline`,
  },
  {
    component: Pipelines,
    label: "Pipelines",
    icon: <PipelineIcon />,
    path: "/pipeline",
    navSection: "pipeline",
    title: `${AppBranding} | Pipeline`,
  },
  {
    component: PipelineDetails,
    path: "/pipeline/:pipelineId/:detailsTab",
    navSection: "pipeline",
    title: `${AppBranding} | Pipeline`,
  },
  {
    component: PipelineDesigner,
    path: "/pipeline/pipeline_designer",
    navSection: "pipeline",
    title: `${AppBranding} | Pipeline`,
  },
  {
    component: ConfigurePipeline,
    path: "/pipeline/pipeline_designer/create_pipeline",
    navSection: "pipeline",
    title: `${AppBranding} | Pipeline`,
  },
  {
    component: Sources,
    label: "Sources",
    icon: <RhUiDataSourceIcon />,
    path: "/source",
    navSection: "source",
    title: `${AppBranding} | Source`,
  },
  {
    component: SourceCatalog,
    path: "/source/catalog",
    navSection: "source",
    title: `${AppBranding} | Source`,
  },
  {
    component: CreateSource,
    path: "/source/create_source/:sourceId?",
    navSection: "source",
    title: `${AppBranding} | Source`,
  },
  {
    component: EditSource,
    path: "/source/:sourceId",
    navSection: "source",
    title: `${AppBranding} | Source`,
  },
  {
    component: CreateTransforms,
    path: "/transform/create_transform",
    navSection: "transform",
    title: `${AppBranding} | Transform`,
  },
  {
    component: Transforms,
    label: "Transforms",
    icon: <RhUiDataProcessorIcon style={{ outline: "none" }} />,
    path: "/transform",
    navSection: "transform",
    title: `${AppBranding} | Transform`,
    featureFlag: "Transforms",
  },
  {
    component: EditTransforms,
    path: "/transform/:transformId",
    navSection: "transform",
    title: `${AppBranding} | Transform`,
  },
  {
    component: Destinations,
    label: "Destinations",
    icon: <RhUiDataSinkIcon style={{ outline: "none" }} />,
    title: `${AppBranding} | Destination`,
    path: "/destination",
    navSection: "destination",
  },
  {
    component: DestinationCatalog,
    path: "/destination/catalog",
    navSection: "destination",
    title: `${AppBranding} | Destination`,
  },
  {
    component: CreateDestination,
    path: "/destination/create_destination/:destinationId?",
    navSection: "destination",
    title: `${AppBranding} | Destination`,
  },
  {
    component: EditDestination,
    path: "/destination/:destinationId",
    navSection: "destination",
    title: `${AppBranding} | Destination`,
  },
  {
    component: Connections,
    label: "Connections",
    icon: <RhUiInfrastructureIcon/>,
    title: `${AppBranding} | Connections`,
    path: "/connections",
    navSection: "connections",
    featureFlag: "Connection",
  },
  {
    component: ConnectionsCatalog,
    path: "/connections/catalog",
    navSection: "connections",
    title: `${AppBranding} | Connections`,
  },
  {
    component: CreateConnection,
    path: "/connections/create_connection/:connectionId?",
    navSection: "connections",
    title: `${AppBranding} | Connections`,
  },
  {
    component: EditConnection,
    path: "/connections/:connectionId",
    navSection: "connections",
    title: `${AppBranding} | Connections`,
  },
  {
    // Intentionally no `label`: this is a hidden fallback so a bare "/alerts" URL still
    // renders a component (defaults to the Rules tab). The nav-visible entry point is the
    // "Alerts" IAppRouteGroup below - giving this route a label would show a duplicate item.
    component: Alerts,
    path: "/alerts",
    navSection: "alerts",
    title: `${AppBranding} | Alerts`,
  },
  {
    label: "Alerts",
    icon: <RhUiNotificationIcon style={{ outline: "none" }} />,
    routes: [
            {
        component: Alerts,
        label: "Events",
        path: "/alerts/history",
        navSection: "alerts",
        title: `${AppBranding} | Alert events`,
        featureFlag: "Alerts",
      },
      {
        component: Alerts,
        label: "Rules",
        path: "/alerts/rules",
        navSection: "alerts",
        title: `${AppBranding} | Alert rules`,
        featureFlag: "Alerts",
      },
      {
        component: Alerts,
        label: "Channels",
        path: "/alerts/channels",
        navSection: "alerts",
        title: `${AppBranding} | Alert channels`,
        featureFlag: "Alerts",
      },
    ],
  },
  {
    component: Vaults,
    label: "Vaults",
    icon: <VaultIcon style={{ outline: "none" }} />,
    path: "/vaults",
    navSection: "vaults",
    title: `${AppBranding} | Vaults`,
    featureFlag: "Vault",
  },
];

export { routes };
