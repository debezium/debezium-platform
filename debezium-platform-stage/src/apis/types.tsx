export interface CatalogComponentEntry {
  class: string;
  name: string;
  description: string;
  descriptor: string;
}

export type Catalog = CatalogComponentEntry & { role: string };

export interface SchemaPropertyValidation {
  type: string;
  values?: string[];
}

export interface SchemaPropertyValueDependant {
  values: string[];
  dependants: string[];
}

export interface SchemaPropertyDisplay {
  label: string;
  description: string;
  group: string;
  groupOrder: number;
  width?: "short" | "medium" | "long";
  importance?: "high" | "medium" | "low";
}

export interface SchemaProperty {
  name: string;
  type: "string" | "number" | "boolean" | "list";
  required?: boolean;
  default?: string;
  display: SchemaPropertyDisplay;
  validation: SchemaPropertyValidation[];
  valueDependants: SchemaPropertyValueDependant[];
}

export interface SchemaGroup {
  name: string;
  order: number;
  description: string;
}

export interface ConnectorSchema {
  name: string;
  type: string;
  version: string;
  metadata: { description: string };
  properties: SchemaProperty[];
  groups: SchemaGroup[];
}

export type Properties = { key: string; value: string };

export type SelectedDataListItem = {
  schemas: string[];
  tables: string[];
};

export interface CatalogApiResponse {
  schemaVersion: string;
  build: {
    version: string;
    timestamp: string;
    sourceRepository: string;
    sourceCommit: string;
    sourceBranch: string;
  };
  components: {
    converter: CatalogComponentEntry[];
    "custom-converter": CatalogComponentEntry[];
    predicate: CatalogComponentEntry[];
    "server-sink": CatalogComponentEntry[];
    "sink-connector": CatalogComponentEntry[];
    "source-connector": CatalogComponentEntry[];
    transformation: CatalogComponentEntry[];
  };
}

// Monitoring API Types
export interface PanelVisualization {
  type: "area" | "line" | "donut-utilization";
  suggestedStep: string;
}

export interface PanelResponse {
  id: string;
  title: string;
  description: string;
  category: "streaming" | "snapshot";
  unit: string;
  visualization: PanelVisualization;
}

export interface PanelsListResponse {
  panels: PanelResponse[];
}

export interface TimeRange {
  start: string;
  end: string;
  step: string;
}

export interface TimeSeries {
  labels: Record<string, string>;
  datapoints: [number, number][]; // [timestamp, value]
}

export interface PanelMetadata {
  queryDurationMs: number;
}

export interface PanelQueryResponse {
  panelId: string;
  pipelineId: string;
  timeRange: TimeRange;
  series: TimeSeries[];
  metadata: PanelMetadata;
}

export type Vault = {
  name: string;
  id: number;
};

export type Transform = {
  name: string;
  id: number;
};

export type PipelineDestination = {
  name: string;
  id: number;
};

export type PipelineSource = {
  name: string;
  id: number;
};

export type DestinationConfig = {
  [key: string]: string; // Dynamic keys with string values
};

export type ConnectionUnknownConfig = {
  [key: string]: string | number | boolean;
};

export type ConnectionAdditionalConfig = {
  [key: string]: string | number | boolean;
};

export type ConnectionConfig = {
  id: number;
  name: string;
}

export type Payload = {
  type: string;
  schema: string;
  vaults: Vault[];
  config: DestinationConfig;
  connection?: ConnectionConfig | Record<string, never>;
  description?: string;
  name: string;
};

export type TableCollection = {
  name: string;
  fullyQualifiedName: string;
};

export type TableSchema = {
  name: string;
  collections: TableCollection[];
  collectionCount: number;
};

export type TableCatalog = {
  name: string | null;
  schemas: TableSchema[];
  totalCollections: number;
};

export type TableData = {
  catalogs: TableCatalog[];
};

export type ResourceType = "source" | "destination" | "transform" | "connection" | "pipeline";

export type ConnectionValidationResult = {
  valid: boolean;
  message: string;
  errorType: string;
};

export type ConnectionPayload = {
  type: string;
  id?: string;
  config: ConnectionUnknownConfig | ConnectionAdditionalConfig;
  description?: string;
  name: string;
};

export type PipelineSignalPayload = {
  id: string;
  type: string;
  data?: string;
  additionalData?: {
    additionalProp1: string;
  }
}

export type Destination = {
  type: string;
  schema: string;
  vaults: Vault[];
  config: DestinationConfig;
  connection?: ConnectionConfig;
  description?: string;
  name: string;
  id: number;
};

export type ConnectionsSchema = {
  type: string;
  schema: ConnectionSchema;
}

export type ConnectionSchema = {
  type: string;
  title: string;
  description: string;
  required: string[];
  additionalProperties: {
    type: string;
  };
  properties: Record<string, {
    type: string;
    title: string;
  }>;
};

export type Connection = {
  type: string;
  config: ConnectionUnknownConfig;
  description?: string;
  name: string;
  id: number;
};

export type PipelineStatus = "FAILED" | "DEPLOYING" | "RUNNING";

export type Pipeline = {
  name: string;
  id: number;
  errorMessage: string
  source: PipelineSource;
  destination: PipelineDestination;
  status: PipelineStatus;
  description?: string;
  transforms: Transform[];
  logLevel: string;
  logLevels: Record<string, string>;
};

export type PipelinePayload = {
  name: string;
  source: PipelineSource;
  destination: PipelineDestination;
  description?: string;
  transforms: Transform[];
  logLevel: string;
  logLevels: Record<string, string>;
};

export type PipelineUpdatePayload = {
  name: string;
  description?: string;
  transforms: Transform[];
  logLevel: string;
  logLevels: Record<string, string>;
};

export type DestinationApiResponse = Destination[];

export type SourceConfig = {
  [key: string]: string; // Dynamic keys with string values
};

export type Source = {
  type: string;
  schema: string;
  vaults: Vault[];
  config: SourceConfig;
  connection?: ConnectionConfig;
  description?: string;
  name: string;
  id: number;
};

export type Predicate = {
  type: string;
  config: Record<string, string>;
  negate?: boolean;
}

export type TransformData = {
  type: string;
  schema: string;
  vaults: Vault[];
  config: SourceConfig;
  description?: string;
  predicate?: Predicate;
  name: string;
  id: number;
};

export type TransformPayload = {
  type: string;
  schema: string;
  vaults: Vault[];
  config: SourceConfig;
  description?: string;
  predicate?: Predicate;
  name: string;
};

export type TransformApiResponse = TransformData[];

export type SourceApiResponse = Source[];

export type ConnectionsApiResponse = Connection[];

export type PipelineApiResponse = Pipeline[];

export type SignalDataCollectionVerifyResponse = {
  exists: boolean;
  message: string;
};
