

const CONNECTORS = "https://debezium.io/documentation/reference/connectors";
const CONFIG = "https://debezium.io/documentation/reference/configuration";

export interface DocLink {
  href: string;
  label: string;
}

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

export const featureDocLinks: Record<string, DocLink> = {
  "signal-data-collection": {
    href: `${CONFIG}/signalling.html`,
    label: "signaling documentation",
  },
};
