/**
 * Maps connector/feature IDs to their documentation URLs on debezium.io.
 *
 * Source of truth: https://github.com/debezium/debezium/tree/main/documentation
 * Rendered at:     https://debezium.io/documentation/reference/
 *
 * Each entry points to a specific page and anchor fragment so the browser
 * scrolls directly to the relevant section when the link opens in the
 * in-app documentation drawer.
 */

const CONNECTORS = "https://debezium.io/documentation/reference/connectors";
const CONFIG = "https://debezium.io/documentation/reference/configuration";

export interface DocLink {
  /** URL including anchor fragment for the relevant section */
  href: string;
  /** Short label shown on the link */
  label: string;
}

/**
 * Connector-specific documentation links.
 * Keyed by the connector catalog ID (matches SourceCatalog.json `id` field).
 */
export const connectorDocLinks: Record<string, DocLink> = {
  postgresql: {
    href: `${CONNECTORS}/postgresql.html#postgresql-connector-properties`,
    label: "PostgreSQL connector properties",
  },
  mongodb: {
    href: `${CONNECTORS}/mongodb.html#mongodb-connector-properties`,
    label: "MongoDB connector properties",
  },
  mysql: {
    href: `${CONNECTORS}/mysql.html#mysql-connector-properties`,
    label: "MySQL connector properties",
  },
  mariadb: {
    href: `${CONNECTORS}/mariadb.html#mariadb-connector-properties`,
    label: "MariaDB connector properties",
  },
  oracle: {
    href: `${CONNECTORS}/oracle.html#oracle-connector-properties`,
    label: "Oracle connector properties",
  },
  sqlserver: {
    href: `${CONNECTORS}/sqlserver.html#sqlserver-connector-properties`,
    label: "SQL Server connector properties",
  },
};

/**
 * Feature / cross-cutting documentation links.
 * Keyed by a feature identifier used in the UI components.
 */
export const featureDocLinks: Record<string, DocLink> = {
  "signal-data-collection": {
    href: `${CONFIG}/signalling.html`,
    label: "signaling documentation",
  },
};
