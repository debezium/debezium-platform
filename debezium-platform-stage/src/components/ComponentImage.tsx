import React from "react";

import mongoDB from "../assets/MongoDB.png";
import cassandra from "../assets/Cassandra.png";
import postgreSql from "../assets/PostgreSQL.png";
import sqlServer from "../assets/sql-server.png";
import apachePulsar from "../assets/apachePulsar.png";
import rocketMq from "../assets/Apache_RocketMQ.png";
import eventHub from "../assets/Azure-event-hub.png";
import pubsub from "../assets/G_pubsub.png";
import fluss from "../assets/fluss.png";
import instruct from "../assets/InstructLab.png";
import sns from "../assets/sns.svg";
import sqs from "../assets/sqs.png";
import rabbitMq from "../assets/RabbitMQ.svg";
import natsStreaming from "../assets/NATS_stream.png";
import kafka from "../assets/kafka.png";
import infinispan from "../assets/infinispan.png";
import pubsubLite from "../assets/pub-sub-lite.png";
import pravega from "../assets/pravega.webp";
import mariadb from "../assets/mariadb.png";
import oracle from "../assets/oracle.png";
import dbz from "../assets/dbz_logo.png";
import databasePlaceholder from "../assets/database.png";
import "./ComponentImage.css";
import TrademarkMessage from "./TrademarkMessage";
import kinesis from "../assets/kinesis.png";
import milvus from "../assets/milvus.png";
import qdrant from "../assets/qdrant.png";
import redis from "../assets/redis.png";
import http from "../assets/http2.png";
import db2 from "../assets/ibm-db2.png";

interface ConnectorImageProps {
  connectorType: string;
  size?: number;
  designerComponent?: boolean;
}

const CONNECTOR_PATTERNS: Array<[string, { src: string; altText: string }]> = [
  ["pubsub_lite", { src: pubsubLite, altText: "Pub/Sub Lite" }],
  ["pubsub", { src: pubsub, altText: "Pub/Sub" }],
  ["mongo", { src: mongoDB, altText: "MongoDB" }],
  ["postgre", { src: postgreSql, altText: "Postgres" }],
  ["cassandra", { src: cassandra, altText: "Cassandra" }],
  ["mysql", { src: databasePlaceholder, altText: "MySQL" }],
  ["sqlserver", { src: sqlServer, altText: "SqlServer" }],
  ["pulsar", { src: apachePulsar, altText: "Apache Pulsar" }],
  ["rocketmq", { src: rocketMq, altText: "RocketMQ" }],
  ["eventhubs", { src: eventHub, altText: "EventHub" }],
  ["rabbitmq", { src: rabbitMq, altText: "RabbitMQ" }],
  ["nats", { src: natsStreaming, altText: "NATS Stream" }],
  ["kafka", { src: kafka, altText: "Kafka" }],
  ["infinispan", { src: infinispan, altText: "Infinispan" }],
  ["pravega", { src: pravega, altText: "Pravega" }],
  ["oracle", { src: oracle, altText: "Oracle" }],
  ["mariadb", { src: mariadb, altText: "MariaDB" }],
  ["fluss", { src: fluss, altText: "Fluss Server Sink" }],
  ["instructlab", { src: instruct, altText: "InstructLab Server Sink" }],
  ["sns", { src: sns, altText: "SNS Server Sink" }],
  ["sqs", { src: sqs, altText: "SQS Server Sink" }],
  ["kinesis", { src: kinesis, altText: "Kinesis" }],
  ["milvus", { src: milvus, altText: "Milvus" }],
  ["qdrant", { src: qdrant, altText: "Qdrant" }],
  ["redis", { src: redis, altText: "Redis(Stream)" }],
  ["http", { src: http, altText: "HTTP" }],
  ["db2", { src: db2, altText: "IBM Db2" }],
];

const DEFAULT_CONFIG = { src: dbz, altText: "Debezium" };

const getConnectorConfig = (connectorType: string) => {
  const normalizedType = connectorType.toLowerCase();
  const match = CONNECTOR_PATTERNS.find(([pattern]) =>
    normalizedType.includes(pattern)
  );
  return match ? match[1] : DEFAULT_CONFIG;
};

const ConnectorImage: React.FC<ConnectorImageProps> = ({
  connectorType = "",
  size,
  designerComponent = false,
}) => {
  const { src, altText } = getConnectorConfig(connectorType);

  return (
    <>
      {!designerComponent && <TrademarkMessage />}
      <img
        src={src}
        alt={`${altText} icon`}
        style={{ maxHeight: size ? `${size}px` : "60px" }}
      />
    </>
  );
};

export default ConnectorImage;
