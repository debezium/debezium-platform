import React from "react";

import mongoDB from "../assets/MongoDB.png";
import cassandra from "../assets/Cassandra.png";
// import mySql from "../assets/my-sql.png";
import postgreSql from "../assets/PostgreSQL.png";
import sqlServer from "../assets/sql-server.png";
import apachePulsar from "../assets/apachePulsar.png";
import rocketMq from "../assets/Apache_RocketMQ.png";
import eventHub from "../assets/Azure-event-hub.png";
import pubsub from "../assets/G_pubsub.png";
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

interface ConnectorImageProps {
  connectorType: string;
  size?: number;
  designerComponent?: boolean;
}

const ConnectorImage: React.FC<ConnectorImageProps> = ({
  connectorType = "",
  size,
  designerComponent = false,
}) => {
  let src = "";
  let altText = "";

  switch (true) {
    case connectorType.includes("mongo"):
      altText = "MongoDB";
      src = mongoDB;
      break;
    case connectorType.includes("postgre"):
      altText = "Postgres";
      src = postgreSql;
      break;
    case connectorType.includes("cassandra"):
      altText = "Cassandra";
      src = cassandra;
      break;
    case connectorType.includes("mysql"):
      altText = "MySQL";
      src = databasePlaceholder;
      break;
    case connectorType.includes("sqlserver"):
      altText = "SqlServer";
      src = sqlServer;
      break;
    case connectorType.includes("pulsar"):
      altText = "Apache Pulsar";
      src = apachePulsar;
      break;
    case connectorType.includes("rocketmq"):
      altText = "RocketMQ";
      src = rocketMq;
      break;
    case connectorType.includes("events_hubs"):
      altText = "EventHub";
      src = eventHub;
      break;

    case connectorType.includes("rabbitmq"):
      altText = "RabbitMQ";
      src = rabbitMq;
      break;
    case connectorType.includes("nats_streaming"):
      altText = "NATS Stream";
      src = natsStreaming;
      break;
    case connectorType.includes("nats_jetstream"):
        altText = "NATS JetStream";
        src = natsStreaming;
        break;  
    case connectorType.includes("kafka"):
      altText = "Kafka";
      src = kafka;
      break;
    case connectorType.includes("infinispan"):
      altText = "Infinispan";
      src = infinispan;
      break;
    case connectorType.includes("pub_sub_lite"):
      altText = "Pub/SUB";
      src = pubsubLite;
      break;
    case connectorType.includes("pub_sub"):
      altText = "Pub/Sub liet";
      src = pubsub;
      break;
    case connectorType.includes("pravega"):
      altText = "Pravega";
      src = pravega;
      break;
    case connectorType.includes("oracle"):
      altText = "Oracle";
      src = oracle;
      break;
    case connectorType.includes("mariadb"):
      altText = "MariaDB";
      src = mariadb;
      break;
    case connectorType.includes("kinesis"):
      altText = "Kinesis";
      src = kinesis;
      break;
    case connectorType.includes("milvus"):
      altText = "Milvus";
      src = milvus;
      break;
    case connectorType.includes("qdrant"):
      altText = "Qdrant";
      src = qdrant;
      break;
    case connectorType.includes("redis"):
      altText = "Redis(Stream)";
      src = redis;
      break;
    case connectorType.includes("http"):
      altText = "HTTP";
      src = http;
      break;
    default:
      altText = "Debezium";
      src = dbz;
      break;
  }

  return (
    <>
      {!designerComponent && <TrademarkMessage />}

      {size ? (
        <img
          src={src}
          alt={`${altText} icon`}
          style={{ maxHeight: `${size}px` }}
        />
      ) : (
        <img src={src} alt={`mongo icon`} style={{ maxHeight: "60px" }} />
      )}
    </>
  );
};

export default ConnectorImage;
