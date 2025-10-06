import { DatabaseType } from "./constants";
import DestinationCatalog from "../__mocks__/data/DestinationCatalog.json";
import SourceCatalog from "../__mocks__/data/SourceCatalog.json";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const convertMapToObject = (
  map: Map<string, { key: string; value: string | number }>,  errorWarning?: string[], setErrorWarning?: (errorWarning: string[]) => void
) => {
  const obj: { [key: string]: string | number } = {};

  map.forEach(({ key, value }) => {
    if (key === "" || value === "") {
      errorWarning?.push(key);
      return;

    }
    obj[key] = value;
  });
  setErrorWarning?.(errorWarning || []);

  return obj;
};

export const isEmpty = (obj: any) => {
  return Object.keys(obj).length === 0;
};

export const openDBZJira = () => {
  const newWindow = window.open("https://issues.redhat.com/projects/DBZ/issues", '_blank');
  if (newWindow) {
    newWindow.focus();
  }
}

export const getDatabaseType = (connectorType: string)  => {
  let type =  "";
  switch (true) {
    case connectorType.includes("postgresql"):
      type = DatabaseType.POSTGRESQL;
      break;
    case connectorType.includes("mysql"): 
      type = DatabaseType.MYSQL;
      break;
    case connectorType.includes("mariadb"): 
      type = DatabaseType.MARIADB;
      break;
    case connectorType.includes("sqlserver"):
      type = DatabaseType.SQLSERVER;
      break;
    case connectorType.includes("oracle"):
      type = DatabaseType.ORACLE;
      break;
  }
  return type;
}
export const getConnectionRole = (connectorType: string) => {
  const connectionsCatalog = [...SourceCatalog, ...DestinationCatalog];
  const connection = connectionsCatalog.find((connection) => connection.id === connectorType);
  return connection?.role;
}

export const getConnectorTypeName = (connectorType: string) => {
  let name = "";

  switch (true) {
    case connectorType.includes("mongo"):
      name = "MongoDB";
      break;
    case connectorType.includes("postgre"):
      name = "PostgreSQL";
      break;
    case connectorType.includes("cassandra"):
      name = "Cassandra";
      break;
    case connectorType.includes("mysql"):
      name = "MySQL";
      break;
    case connectorType.includes("mariadb"):
      name = "MariaDB";
      break;
    case connectorType.includes("sqlserver"):
      name = "SQL Server";
      break;
    case connectorType.includes("apache_pulsar"):
      name = "Apache Pulsar";
      break;
    case connectorType.includes("oracle"):
      name = "Oracle";
      break;
    case connectorType.includes("rocketmq"):
      name = "RocketMQ";
      break;
    case connectorType.includes("kinesis"):
      name = "Amazon Kinesis";
      break;
    case connectorType.includes("events_hubs"):
      name = "Event Hub";
      break;

    case connectorType.includes("rabbitmq"):
      name = "RabbitMQ";
      break;
    case connectorType.includes("nats_streaming"):
      name = "NATS Streaming";
      break;
    case connectorType.includes("kafka"):
      name = "Kafka";
      break;
    case connectorType.includes("infinispan"):
      name = "Infinispan";
      break;
    case connectorType.includes("pub_sub_lite"):
      name = "Pub/Sub Lite";
      break;
    case connectorType.includes("pub_sub"):
      name = "Pub/Sub";
      break;
    case connectorType.includes("pravega"):
      name = "Pravega";
      break;
    case connectorType.includes("milvus"):
      name = "Milvus";
      break;
    case connectorType.includes("qdrant"):
      name = "Qdrant";
      break;
    case connectorType.includes("redis"):
      name = "Redis(Stream)";
      break;
    case connectorType.includes("http"):
      name = "HTTP";
      break;
  }

  return name;
};
