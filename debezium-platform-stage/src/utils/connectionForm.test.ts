import { describe, it, expect } from "vitest";
import {
  buildFlatConfigFromFormData,
  flatConnectionConfigToRhfShape,
} from "./connectionForm";

describe("buildFlatConfigFromFormData", () => {
  describe.each([
    {
      description: "single bootstrap server",
      formData: { "bootstrap.servers": "localhost:9092" },
      propertyKeys: ["bootstrap.servers"],
      expected: { "bootstrap.servers": "localhost:9092" },
    },
    {
      description: "multiple bootstrap servers (comma-separated)",
      formData: { "bootstrap.servers": "server1:9092,server2:9092,server3:9092" },
      propertyKeys: ["bootstrap.servers"],
      expected: { "bootstrap.servers": "server1:9092,server2:9092,server3:9092" },
    },
    {
      description: "bootstrap servers with spaces",
      formData: { "bootstrap.servers": "server1:9092, server2:9092" },
      propertyKeys: ["bootstrap.servers"],
      expected: { "bootstrap.servers": "server1:9092, server2:9092" },
    },
    {
      description: "empty bootstrap servers",
      formData: { "bootstrap.servers": "" },
      propertyKeys: ["bootstrap.servers"],
      expected: { "bootstrap.servers": "" },
    },
    {
      description: "bootstrap servers with other properties",
      formData: {
        "bootstrap.servers": "localhost:9092",
        "topic.prefix": "dbz",
        "database.hostname": "db.example.com",
      },
      propertyKeys: ["bootstrap.servers", "topic.prefix", "database.hostname"],
      expected: {
        "bootstrap.servers": "localhost:9092",
        "topic.prefix": "dbz",
        "database.hostname": "db.example.com",
      },
    },
    {
      description: "nested property with bootstrap servers",
      formData: {
        "bootstrap.servers": "localhost:9092",
        kafka: { max: { poll: { records: 500 } } },
      },
      propertyKeys: ["bootstrap.servers", "kafka.max.poll.records"],
      expected: {
        "bootstrap.servers": "localhost:9092",
        "kafka.max.poll.records": 500,
      },
    },
    {
      description: "undefined bootstrap servers not included",
      formData: { "topic.prefix": "dbz" },
      propertyKeys: ["bootstrap.servers", "topic.prefix"],
      expected: { "topic.prefix": "dbz" },
    },
    {
      description: "numeric port value",
      formData: { "bootstrap.servers": "localhost:9092", port: 5432 },
      propertyKeys: ["bootstrap.servers", "port"],
      expected: { "bootstrap.servers": "localhost:9092", port: 5432 },
    },
    {
      description: "bootstrap servers with IPv4 addresses",
      formData: { "bootstrap.servers": "192.168.1.1:9092,192.168.1.2:9092" },
      propertyKeys: ["bootstrap.servers"],
      expected: { "bootstrap.servers": "192.168.1.1:9092,192.168.1.2:9092" },
    },
    {
      description: "bootstrap servers with IPv6 addresses",
      formData: { "bootstrap.servers": "[::1]:9092,[2001:db8::1]:9092" },
      propertyKeys: ["bootstrap.servers"],
      expected: { "bootstrap.servers": "[::1]:9092,[2001:db8::1]:9092" },
    },
    {
      description: "bootstrap servers with domain names",
      formData: { "bootstrap.servers": "kafka.example.com:9092,kafka2.example.com:9093" },
      propertyKeys: ["bootstrap.servers"],
      expected: { "bootstrap.servers": "kafka.example.com:9092,kafka2.example.com:9093" },
    },
    {
      description: "dotted key exists as direct property when nested value is undefined",
      formData: { "bootstrap.servers": "direct:9092" },
      propertyKeys: ["bootstrap.servers"],
      expected: { "bootstrap.servers": "direct:9092" },
    },
  ])("$description", ({ formData, propertyKeys, expected }) => {
    it("builds correct flat config", () => {
      const result = buildFlatConfigFromFormData(formData, propertyKeys);
      expect(result).toEqual(expected);
    });
  });

  it("handles mixed nested and flat properties correctly", () => {
    const formData = {
      "bootstrap.servers": "localhost:9092",
      database: {
        hostname: "db.example.com",
        port: 5432,
      },
      "topic.prefix": "myprefix",
    };
    const propertyKeys = [
      "bootstrap.servers",
      "database.hostname",
      "database.port",
      "topic.prefix",
    ];
    const result = buildFlatConfigFromFormData(formData, propertyKeys);
    expect(result).toEqual({
      "bootstrap.servers": "localhost:9092",
      "database.hostname": "db.example.com",
      "database.port": 5432,
      "topic.prefix": "myprefix",
    });
  });
});

describe("flatConnectionConfigToRhfShape", () => {
  describe.each([
    {
      description: "single bootstrap server",
      fields: { "bootstrap.servers": "localhost:9092" },
      expected: { bootstrap: { servers: "localhost:9092" } },
    },
    {
      description: "multiple bootstrap servers",
      fields: { "bootstrap.servers": "server1:9092,server2:9092,server3:9092" },
      expected: { bootstrap: { servers: "server1:9092,server2:9092,server3:9092" } },
    },
    {
      description: "bootstrap servers with other dotted properties",
      fields: {
        "bootstrap.servers": "localhost:9092",
        "topic.prefix": "dbz",
        "database.hostname": "db.example.com",
      },
      expected: {
        bootstrap: { servers: "localhost:9092" },
        topic: { prefix: "dbz" },
        database: { hostname: "db.example.com" },
      },
    },
    {
      description: "bootstrap servers with non-dotted properties",
      fields: {
        "bootstrap.servers": "localhost:9092",
        name: "my-connector",
        port: 5432,
      },
      expected: {
        bootstrap: { servers: "localhost:9092" },
        name: "my-connector",
        port: 5432,
      },
    },
    {
      description: "empty bootstrap servers",
      fields: { "bootstrap.servers": "" },
      expected: { bootstrap: { servers: "" } },
    },
    {
      description: "deeply nested properties with bootstrap servers",
      fields: {
        "bootstrap.servers": "localhost:9092",
        "kafka.consumer.max.poll.records": 500,
        "ssl.truststore.location": "/path/to/truststore",
      },
      expected: {
        bootstrap: { servers: "localhost:9092" },
        kafka: { consumer: { max: { poll: { records: 500 } } } },
        ssl: { truststore: { location: "/path/to/truststore" } },
      },
    },
    {
      description: "bootstrap servers with IPv4 addresses",
      fields: { "bootstrap.servers": "192.168.1.1:9092,192.168.1.2:9092" },
      expected: { bootstrap: { servers: "192.168.1.1:9092,192.168.1.2:9092" } },
    },
    {
      description: "bootstrap servers with IPv6 addresses",
      fields: { "bootstrap.servers": "[::1]:9092,[2001:db8::1]:9092" },
      expected: { bootstrap: { servers: "[::1]:9092,[2001:db8::1]:9092" } },
    },
    {
      description: "bootstrap servers with domain names",
      fields: { "bootstrap.servers": "kafka.example.com:9092,kafka2.example.com:9093" },
      expected: { bootstrap: { servers: "kafka.example.com:9092,kafka2.example.com:9093" } },
    },
    {
      description: "only non-dotted properties",
      fields: { name: "connector", port: 5432 },
      expected: { name: "connector", port: 5432 },
    },
    {
      description: "mixed single and multi-level dotted keys",
      fields: {
        "bootstrap.servers": "localhost:9092",
        "a.b": "value1",
        "x.y.z": "value2",
        simple: "value3",
      },
      expected: {
        bootstrap: { servers: "localhost:9092" },
        a: { b: "value1" },
        x: { y: { z: "value2" } },
        simple: "value3",
      },
    },
  ])("$description", ({ fields, expected }) => {
    it("converts to correct RHF shape", () => {
      const result = flatConnectionConfigToRhfShape(fields);
      expect(result).toEqual(expected);
    });
  });

  it("handles numeric values correctly", () => {
    const fields = {
      "bootstrap.servers": "localhost:9092",
      port: 5432,
      "max.connections": 100,
    };
    const result = flatConnectionConfigToRhfShape(fields);
    expect(result).toEqual({
      bootstrap: { servers: "localhost:9092" },
      port: 5432,
      max: { connections: 100 },
    });
  });

  it("handles boolean values correctly", () => {
    const fields = {
      "bootstrap.servers": "localhost:9092",
      "ssl.enabled": true,
      enabled: false,
    };
    const result = flatConnectionConfigToRhfShape(fields);
    expect(result).toEqual({
      bootstrap: { servers: "localhost:9092" },
      ssl: { enabled: true },
      enabled: false,
    });
  });

  it("preserves empty object when no fields provided", () => {
    const result = flatConnectionConfigToRhfShape({});
    expect(result).toEqual({});
  });
});
