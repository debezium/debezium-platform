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
    "sink-connector": CatalogComponentEntry[];
    "source-connector": CatalogComponentEntry[];
    transformation: CatalogComponentEntry[];
  };
}
