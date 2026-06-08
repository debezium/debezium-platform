import { DatabaseType } from "./constants";
import { Catalog } from "../apis/types";

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

export const openDBZIssues = () => {
  const newWindow = window.open("https://github.com/debezium/dbz/issues", '_blank');
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
export const getConnectionRole = (connectorType: string, catalog: Catalog[]): string | undefined => {
  const lower = connectorType.toLowerCase();
  return catalog.find((entry) => entry.class.toLowerCase() === lower || lower.includes(entry.class.toLowerCase()) || entry.class.toLowerCase().includes(lower))?.role;
}

export const extractConnectorType = (connectorClass: string): string => {
  // Simple string
  if (!connectorClass.includes('.')) {
    return connectorClass;
  }

  // For source connectors: extract after "io.debezium.connector."
  const sourcePrefix = "io.debezium.connector.";
  if (connectorClass.startsWith(sourcePrefix)) {
    const afterPrefix = connectorClass.substring(sourcePrefix.length);
    const firstSegment = afterPrefix.split('.')[0];
    return firstSegment;
  }

  // For destination/sink connectors: extract after "io.debezium.server."
  const serverPrefix = "io.debezium.server.";
  if (connectorClass.startsWith(serverPrefix)) {
    const afterPrefix = connectorClass.substring(serverPrefix.length);
    const firstSegment = afterPrefix.split('.')[0];
    return firstSegment;
  }

  // Fallback
  return connectorClass;
};


export const getConnectorTypeName = (connectorType: string) => {
  let name = "";

  switch (true) {
    case connectorType.includes("mongo"):
      name = "MongoDB Connector";
      break;
    case connectorType.includes("postgre"):
      name = "PostgreSQL Connector";
      break;
    case connectorType.includes("cassandra"):
      name = "Cassandra Connector";
      break;
    case connectorType.includes("mysql"):
      name = "MySQL Connector";
      break;
    case connectorType.includes("mariadb"):
      name = "MariaDB Connector";
      break;
    case connectorType.includes("sqlserver"):
      name = "SQL Server Connector";
      break;
    case connectorType.includes("db2"):
      name = "IBM Db2 Connector";
      break;
    case connectorType.includes("apache_pulsar") || connectorType.includes("pulsar"):
      name = "Pulsar Server Sink";
      break;
    case connectorType.includes("oracle"):
      name = "Oracle Connector";
      break;
    case connectorType.includes("rocketmq"):
      name = "RocketMQ Server Sink";
      break;
    case connectorType.includes("kinesis"):
      name = "Kinesis Server Sink";
      break;
    case connectorType.includes("eventhubs") || connectorType.includes("events_hubs"):
      name = "Event Hub Server Sink";
      break;
    case connectorType.includes("rabbitmq"):
      name = "RabbitMQ Server Sink";
      break;
    case connectorType.includes("nats"):
      name = "NATS Streaming Server Sink";
      break;
    case connectorType.includes("kafka"):
      name = "Kafka Server Sink";
      break;
    case connectorType.includes("infinispan"):
      name = "Infinispan Server Sink";
      break;
    case connectorType.includes("instructlab"):
      name = "InstructLab Server Sink";
      break;
    case connectorType.includes("fluss"):
      name = "Fluss Server Sink";
      break;
    case connectorType.includes("pub_sub_lite") || connectorType.includes("pubsub_lite"):
      name = "Pub/Sub Lite Server Sink";
      break;
    case connectorType.includes("pub_sub") || connectorType.includes("pubsub"):
      name = "Pub/Sub Server Sink";
      break;
    case connectorType.includes("pravega"):
      name = "Pravega Server Sink";
      break;
    case connectorType.includes("milvus"):
      name = "Milvus Server Sink";
      break;
    case connectorType.includes("qdrant"):
      name = "Qdrant Server Sink";
      break;
    case connectorType.includes("redis"):
      name = "Redis(Stream) Server Sink";
      break;
    case connectorType.includes("http"):
      name = "HTTP Server Sink";
      break;
    case connectorType.includes("sns"):
      name = "SNS Server Sink";
      break;
    case connectorType.includes("sqs"):
      name = "SQS Server Sink";
      break;
  }

  return name;
};
