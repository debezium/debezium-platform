import React from "react";
import { AppBranding } from "./utils/constants";
import {
  DataProcessorIcon,
  DataSinkIcon,
  DataSourceIcon,
} from "@patternfly/react-icons";
import { MigrationIcon as PipelineIcon } from "@patternfly/react-icons";
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
import { CreateTransforms } from "./pages/Transforms/CreateTransforms";
import { EditTransforms } from "./pages/Transforms/EditTransforms";

export interface IAppRoute {
  label?: string; // Excluding the label will exclude the route from the nav sidebar in AppLayout
  /* eslint-disable @typescript-eslint/no-explicit-any */
  component: React.ComponentType<any>;
  path: string;
  navSection: string;
  title: string;
  icon?: React.ReactElement;
  routes?: undefined;
}

export interface IAppRouteGroup {
  label: string;
  routes: IAppRoute[];
}

export type AppRouteConfig = IAppRoute | IAppRouteGroup;

const routes: AppRouteConfig[] = [
  {
    component: Pipelines,
    path: "/",
    navSection: "pipeline",
    title: `${AppBranding} | Pipeline`,
  },
  {
    component: Pipelines,
    label: "Pipeline",
    icon: <PipelineIcon style={{ outline: "none" }} />,
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
    label: "Source",
    icon: <DataSourceIcon style={{ outline: "none" }} />,
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
    label: "Transform",
    icon: <DataProcessorIcon style={{ outline: "none" }} />,
    path: "/transform",
    navSection: "transform",
    title: `${AppBranding} | Transform`,
  },
  {
    component: EditTransforms,
    path: "/transform/:transformId",
    navSection: "transform",
    title: `${AppBranding} | Transform`,
  },

  {
    component: Destinations,
    label: "Destination",
    icon: <DataSinkIcon style={{ outline: "none" }} />,
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
    component: Vaults,
    label: "Vaults",
    icon: <VaultIcon style={{ outline: "none" }} />,
    path: "/vaults",
    navSection: "vaults",
    title: `${AppBranding} | Vaults`,
  },
];

export { routes };
