export interface CatalogComponentEntry {
  class: string;
  name: string;
  description: string;
  descriptor: string;
}

export type Catalog = CatalogComponentEntry & { role: string };

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
