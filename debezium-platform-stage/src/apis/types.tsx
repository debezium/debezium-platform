export type Catalog = {
  type: string;
  description: string;
  name: string;
  id: string;
  role: string;
};

export type CatalogComponent = {
  class: string;
  name: string;
  description: string;
  descriptor: string;
};

export type CatalogResponse = {
  schemaVersion: string;
  build: {
    timestamp: string;
    sourceRepository: string;
    sourceCommit: string;
    sourceBranch: string;
  };
  components: Record<string, CatalogComponent[]>;
};