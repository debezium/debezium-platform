import React from "react";

import mongoDB from "../assets/MongoDB.png";
import cassandra from "../assets/Cassandra.png";
import mySql from "../assets/my-sql.png";
import postgreSql from "../assets/PostgreSQL.png";
import sqlServer from "../assets/sql-server.png";
import apachePulsar from "../assets/apachePulsar.png";
import rocketMq from "../assets/Apache_RocketMQ.png";
import eventHub from "../assets/Azure-event-hub.png";
import pubsub from "../assets/G_pubsub.png";
import rabbitMq from "../assets/RabbitMQ.png";
import natsStreaming from "../assets/NATS_stream.png";
import kafka from "../assets/kafka.png";
import infinispan from "../assets/infinispan.png";
import pubsubLite from "../assets/pub-sub-lite.png";
import pravega from "../assets/pravega.webp";
import dbz from "../assets/dbz_logo.png";

interface ConnectorImageProps {
  connectorType: string;
  size?: number;
}

const ConnectorImage: React.FC<ConnectorImageProps> = ({
  connectorType = "",
  size,
}) => {
  let src = "";
  let altText = ""

  switch (true) {
    case connectorType.includes("mongo"):
      altText = "MongoDB"
      src = mongoDB;
      break;
    case connectorType.includes("postgre"):
      altText = "Postgres"
      src = postgreSql;
      break;
    case connectorType.includes("cassandra"):
      altText = "Cassandra"
      src = cassandra;
      break;
    case connectorType.includes("mysql"):
      altText = "MySQL"
      src = mySql;
      break;
    case connectorType.includes("sqlserver"):
      altText = "SqlServer"
      src = sqlServer;
      break;
    case connectorType.includes("apachepulsar"):
      altText = "Apache Pulsar"
      src = apachePulsar;
      break;
    case connectorType.includes("rocketmq"):
      altText = "RocketMQ"
      src = rocketMq;
      break;
    case connectorType.includes("eventhub"):
      altText = "EventHub"
      src = eventHub;
      break;

    case connectorType.includes("rabbitmq"):
      altText = "RabbitMQ"
      src = rabbitMq;
      break;
    case connectorType.includes("natsstreaming"):
      altText = "NATS Stream"
      src = natsStreaming;
      break;
    case connectorType.includes("kafka"):
      altText = "Kafka"
      src = kafka;
      break;
    case connectorType.includes("infinispan"):
      altText = "Infinispan"
      src = infinispan;
      break;
    case connectorType.includes("pubsublite"):
      altText = "Pub/SUB"
      src = pubsubLite;
      break;
    case connectorType.includes("pubsub"):
      altText = "Pub/Sub liet"
      src = pubsub;
      break;
    case connectorType.includes("pravega"):
      altText = "Pravega"
      src = pravega;
      break;
    case connectorType.includes("debezium"):
      altText = "Debezium"
      src = dbz;
      break;
  }

  return size ? (
    <img src={src} alt={`${altText} icon`} style={{ maxHeight: `${size}px` }} />
  ) : (
    <img src={src} alt={`mongo icon`} style={{ maxHeight: "60px" }} />
  );
};

export default ConnectorImage;
