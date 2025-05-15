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

export enum DatabaseType {
  ORACLE = "ORACLE",
  MYSQL = "MYSQL",
  MARIADB = "MARIADB",
  SQLSERVER = "SQLSERVER",
  POSTGRESQL = "POSTGRESQL",
}
