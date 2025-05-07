// Add more constants here as needed
import { getBackendUrl } from "src/config";

export const AppBranding = "Stage";

const backendBaseUrl = getBackendUrl();

export const API_URL = backendBaseUrl;
export const MAX_RESULTS = 10;
export const DEFAULT_TIMEOUT = 5000;

// Debezium color constants
export const BrandColors = {
  green: "#a5c82d",
  lightGreen: "#7fc5a5",
  teal: "#58b2da",
};

// Application color constants
export const AppColors = {
  dark: "#292929",
  darkBlue: "#4f6c87",
  white: "#ffffff",
};

// Application constant strings
export const AppStrings = {
  source: "source",
  destination: "destination",
  pipeline: "pipeline",
};

// Connector schema
export const connectorSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    type: { type: "string" },
    schema: { type: "string" },
    vault: { type: "array" },
    config: {
      type: "object",
      minProperties: 1,
    },
  },
  required: ["name", "type", "schema", "config"],
};

export const initialConnectorSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    type: { type: "string" },
    schema: { type: "string" },
    vault: { type: "array" },
    config: {
      type: "object",
      // minProperties: 1,
    },
  },
  required: ["name", "type", "schema", "config"],
};

export const transformSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    type: { type: "string" },
    schema: { type: "string" },
    vault: { type: "array" },
    config: {
      type: "object",
      minProperties: 1,
    },
    predicate: {
      type: "object",
      properties: {
        type: { type: "string" },
        config: {
          type: "object",
        },
        negate: { type: "boolean" },
      },
    }
  },
  required: ["name", "type", "schema", "config"],
};

export enum DatabaseType {
  ORACLE = "ORACLE",
  MYSQL = "MYSQL",
  MARIADB = "MARIADB",
  SQLSERVER = "SQLSERVER",
  POSTGRESQL = "POSTGRESQL",
}

export const pipelineSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    source: {
      type: "object",
      properties: { name: { type: "string" }, id: { type: "number" } },
      required: ["name", "id"],
    },
    destination: {
      type: "object",
      properties: { name: { type: "string" }, id: { type: "number" } },
      required: ["name", "id"],
    },
    transforms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          id: { type: "number" },
        },
        required: ["name", "id"],
      },
    },
  },
  required: ["name", "source", "destination"],
};
