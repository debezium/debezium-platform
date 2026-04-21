import { describe, it, expect, vi } from "vitest";
import {
  convertMapToObject,
  getConnectionRole,
  getConnectorTypeName,
  getDatabaseType,
  isEmpty,
  openDBZIssues,
} from "./helpers";
import type { Catalog } from "../apis/types";
import { DatabaseType } from "./constants";

describe("isEmpty", () => {
  it("returns true for an object with no keys", () => {
    expect(isEmpty({})).toBe(true);
  });

  it("returns false when keys exist", () => {
    expect(isEmpty({ a: 1 })).toBe(false);
  });
});

describe("getDatabaseType", () => {
  it("maps connector class strings to DatabaseType", () => {
    expect(getDatabaseType("io.debezium.connector.postgresql.PostgresConnector")).toBe(
      DatabaseType.POSTGRESQL,
    );
    expect(getDatabaseType("mysql")).toBe(DatabaseType.MYSQL);
    expect(getDatabaseType("mariadb")).toBe(DatabaseType.MARIADB);
    expect(getDatabaseType("sqlserver")).toBe(DatabaseType.SQLSERVER);
    expect(getDatabaseType("oracle")).toBe(DatabaseType.ORACLE);
  });

  it("returns empty string when no rule matches", () => {
    expect(getDatabaseType("unknown")).toBe("");
  });
});

describe("getConnectorTypeName", () => {
  it("returns a friendly name for known connector ids", () => {
    expect(getConnectorTypeName("mongodb")).toBe("MongoDB");
    expect(getConnectorTypeName("postgresql")).toBe("PostgreSQL");
    expect(getConnectorTypeName("cassandra")).toBe("Cassandra");
    expect(getConnectorTypeName("mysql")).toBe("MySQL");
    expect(getConnectorTypeName("mariadb")).toBe("MariaDB");
    expect(getConnectorTypeName("sqlserver")).toBe("SQL Server");
    expect(getConnectorTypeName("apache_pulsar")).toBe("Apache Pulsar");
    expect(getConnectorTypeName("oracle")).toBe("Oracle");
    expect(getConnectorTypeName("rocketmq")).toBe("RocketMQ");
    expect(getConnectorTypeName("kinesis")).toBe("Amazon Kinesis");
    expect(getConnectorTypeName("events_hubs")).toBe("Event Hub");
    expect(getConnectorTypeName("rabbitmq")).toBe("RabbitMQ");
    expect(getConnectorTypeName("nats_streaming")).toBe("NATS Streaming");
    expect(getConnectorTypeName("kafka")).toBe("Kafka");
    expect(getConnectorTypeName("infinispan")).toBe("Infinispan");
    expect(getConnectorTypeName("pub_sub_lite")).toBe("Pub/Sub Lite");
    expect(getConnectorTypeName("pub_sub")).toBe("Pub/Sub");
    expect(getConnectorTypeName("pravega")).toBe("Pravega");
    expect(getConnectorTypeName("milvus")).toBe("Milvus");
    expect(getConnectorTypeName("qdrant")).toBe("Qdrant");
    expect(getConnectorTypeName("redis")).toBe("Redis(Stream)");
    expect(getConnectorTypeName("http")).toBe("HTTP");
  });

  it("returns empty string when unknown", () => {
    expect(getConnectorTypeName("")).toBe("");
  });
});

describe("getConnectionRole", () => {
  const catalog: Catalog[] = [
    {
      class: "mariadb",
      name: "MariaDB",
      description: "",
      descriptor: "",
      role: "source",
    },
    {
      class: "kinesis",
      name: "Kinesis",
      description: "",
      descriptor: "",
      role: "destination",
    },
  ];

  it("resolves role from catalog class match", () => {
    expect(getConnectionRole("mariadb", catalog)).toBe("source");
    expect(getConnectionRole("MARIADB", catalog)).toBe("source");
  });

  it("returns undefined when nothing matches", () => {
    expect(getConnectionRole("unknown", catalog)).toBeUndefined();
  });

  it("matches when connector id contains catalog class", () => {
    expect(getConnectionRole("io_custom_mariadb_connector", catalog)).toBe("source");
  });
});

describe("openDBZIssues", () => {
  it("focuses the window when popup succeeds", () => {
    const focus = vi.fn();
    vi.spyOn(window, "open").mockReturnValue({ focus } as Window);
    openDBZIssues();
    expect(focus).toHaveBeenCalled();
  });

  it("does not throw when popup is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(() => openDBZIssues()).not.toThrow();
  });
});

describe("convertMapToObject", () => {
  it("builds an object from valid map entries", () => {
    const map = new Map([
      ["row1", { key: "host", value: "localhost" }],
      ["row2", { key: "port", value: 5432 }],
    ]);
    expect(convertMapToObject(map)).toEqual({ host: "localhost", port: 5432 });
  });

  it("skips rows with empty key or value and records warnings when provided", () => {
    const map = new Map([["r", { key: "", value: "x" }]]);
    const warnings: string[] = [];
    const setWarnings = vi.fn();
    const obj = convertMapToObject(map, warnings, setWarnings);
    expect(obj).toEqual({});
    expect(warnings).toContain("");
    expect(setWarnings).toHaveBeenCalledWith([""]);
  });

  it("invokes setErrorWarning with empty array when no warnings array is passed", () => {
    const map = new Map([["r", { key: "a", value: "1" }]]);
    const setWarnings = vi.fn();
    expect(convertMapToObject(map, undefined, setWarnings)).toEqual({ a: "1" });
    expect(setWarnings).toHaveBeenCalledWith([]);
  });
});
