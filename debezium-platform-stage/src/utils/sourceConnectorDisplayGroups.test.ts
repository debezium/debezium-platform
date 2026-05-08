import { describe, it, expect } from "vitest";
import { buildSourceConnectorDisplayGroupedProperties } from "./sourceConnectorDisplayGroups";
import type { ConnectorSchema, SchemaProperty } from "../apis/types";

const createProperty = (
  name: string,
  group: string,
  groupOrder = 0
): SchemaProperty => ({
  name,
  type: "string",
  display: {
    group,
    groupOrder,
    label: name,
    description: "",
  },
  required: false,
  validation: [],
  valueDependants: [],
});

const createSchema = (
  properties: SchemaProperty[],
  groupNames: string[]
): ConnectorSchema => ({
  name: "Test Connector",
  type: "test-connector",
  version: "1.0.0",
  metadata: { description: "Test" },
  properties,
  groups: groupNames.map((name, index) => ({
    name,
    order: index,
    description: "",
  })),
});

describe("buildSourceConnectorDisplayGroupedProperties", () => {
  describe("no hidden duplicate groups", () => {
    it("filters out Connection Advanced Ssl group entirely", () => {
      const schema = createSchema(
        [
          createProperty("prop1", "Connector"),
          createProperty("ssl.cert", "Connection Advanced Ssl"),
          createProperty("ssl.key", "Connection Advanced Ssl"),
          createProperty("prop2", "Advanced"),
        ],
        ["Connector", "Connection Advanced Ssl", "Advanced"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      expect(result.has("Connection Advanced Ssl")).toBe(false);
      expect(result.has("Connector")).toBe(true);
      expect(result.has("Advanced")).toBe(true);
      expect(result.get("Connector")).toHaveLength(1);
      expect(result.get("Advanced")).toHaveLength(1);
    });

    it("filters out Connection group except topic.prefix", () => {
      const schema = createSchema(
        [
          createProperty("database.hostname", "Connection"),
          createProperty("database.port", "Connection"),
          createProperty("topic.prefix", "Connection"),
          createProperty("prop1", "Connector"),
        ],
        ["Connection", "Connector"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      expect(result.has("Connection")).toBe(false);
      expect(result.has("Connector")).toBe(true);
      const connectorProps = result.get("Connector");
      expect(connectorProps).toHaveLength(2);
      expect(connectorProps?.find((p) => p.name === "topic.prefix")).toBeDefined();
      expect(connectorProps?.find((p) => p.name === "database.hostname")).toBeUndefined();
    });

    it("does not create duplicate groups when filtering", () => {
      const schema = createSchema(
        [
          createProperty("prop1", "Connector"),
          createProperty("ssl.cert", "Connection Advanced Ssl"),
          createProperty("prop2", "Connector"),
          createProperty("ssl.key", "Connection Advanced Ssl"),
        ],
        ["Connector", "Connection Advanced Ssl"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      expect(result.size).toBe(1);
      expect(result.has("Connector")).toBe(true);
      expect(result.has("Connection Advanced Ssl")).toBe(false);
      expect(result.get("Connector")).toHaveLength(2);
    });

    it("ensures each property appears only once in the result", () => {
      const schema = createSchema(
        [
          createProperty("prop1", "Connector"),
          createProperty("prop2", "Advanced"),
          createProperty("prop3", "Connector"),
        ],
        ["Connector", "Advanced"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      const allProperties = Array.from(result.values()).flat();
      const propertyNames = allProperties.map((p) => p.name);
      const uniqueNames = new Set(propertyNames);

      expect(propertyNames.length).toBe(uniqueNames.size);
      expect(allProperties).toHaveLength(3);
    });

    it("does not duplicate topic.prefix when moved to Connector group", () => {
      const schema = createSchema(
        [
          createProperty("topic.prefix", "Connection"),
          createProperty("prop1", "Connector"),
          createProperty("prop2", "Connector"),
        ],
        ["Connection", "Connector"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      const connectorProps = result.get("Connector");
      expect(connectorProps).toHaveLength(3);
      const topicPrefixCount = connectorProps?.filter((p) => p.name === "topic.prefix").length;
      expect(topicPrefixCount).toBe(1);
    });
  });

  describe("filter-only-once semantics", () => {
    it("processes each property exactly once", () => {
      const schema = createSchema(
        [
          createProperty("prop1", "Connector"),
          createProperty("database.hostname", "Connection"),
          createProperty("ssl.cert", "Connection Advanced Ssl"),
          createProperty("topic.prefix", "Connection"),
          createProperty("prop2", "Advanced"),
        ],
        ["Connector", "Connection", "Connection Advanced Ssl", "Advanced"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      const allProperties = Array.from(result.values()).flat();
      expect(allProperties).toHaveLength(3); // prop1, topic.prefix, prop2
      expect(allProperties.find((p) => p.name === "prop1")).toBeDefined();
      expect(allProperties.find((p) => p.name === "topic.prefix")).toBeDefined();
      expect(allProperties.find((p) => p.name === "prop2")).toBeDefined();
      expect(allProperties.find((p) => p.name === "database.hostname")).toBeUndefined();
      expect(allProperties.find((p) => p.name === "ssl.cert")).toBeUndefined();
    });

    it("applies Connection filter only once per property", () => {
      const schema = createSchema(
        [
          createProperty("database.hostname", "Connection"),
          createProperty("database.port", "Connection"),
          createProperty("database.user", "Connection"),
          createProperty("topic.prefix", "Connection"),
        ],
        ["Connection", "Connector"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      const allProperties = Array.from(result.values()).flat();
      expect(allProperties).toHaveLength(1);
      expect(allProperties[0].name).toBe("topic.prefix");
    });

    it("applies Connection Advanced Ssl filter only once per property", () => {
      const schema = createSchema(
        [
          createProperty("ssl.cert", "Connection Advanced Ssl"),
          createProperty("ssl.key", "Connection Advanced Ssl"),
          createProperty("ssl.truststore", "Connection Advanced Ssl"),
          createProperty("prop1", "Connector"),
        ],
        ["Connection Advanced Ssl", "Connector"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      expect(result.has("Connection Advanced Ssl")).toBe(false);
      const allProperties = Array.from(result.values()).flat();
      expect(allProperties).toHaveLength(1);
      expect(allProperties[0].name).toBe("prop1");
    });

    it("does not re-filter properties after initial filtering", () => {
      const schema = createSchema(
        [
          createProperty("prop1", "Connector"),
          createProperty("database.hostname", "Connection"),
          createProperty("prop2", "Advanced"),
          createProperty("ssl.cert", "Connection Advanced Ssl"),
        ],
        ["Connector", "Connection", "Advanced", "Connection Advanced Ssl"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      // Verify that filtering happened exactly once
      expect(result.size).toBe(2); // Connector and Advanced
      expect(result.get("Connector")).toHaveLength(1);
      expect(result.get("Advanced")).toHaveLength(1);
    });

    it("maintains property order within groups after filtering", () => {
      const schema = createSchema(
        [
          createProperty("prop1", "Connector", 0),
          createProperty("database.hostname", "Connection", 0),
          createProperty("prop2", "Connector", 1),
          createProperty("topic.prefix", "Connection", 1),
          createProperty("prop3", "Connector", 2),
        ],
        ["Connector", "Connection"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      const connectorProps = result.get("Connector");
      expect(connectorProps).toHaveLength(4);
      // Properties should maintain their insertion order
      expect(connectorProps?.[0].name).toBe("prop1");
      expect(connectorProps?.[1].name).toBe("prop2");
      expect(connectorProps?.[2].name).toBe("topic.prefix");
      expect(connectorProps?.[3].name).toBe("prop3");
    });
  });

  describe("topic.prefix placement", () => {
    it("moves topic.prefix to Connector group when it exists", () => {
      const schema = createSchema(
        [
          createProperty("topic.prefix", "Connection"),
          createProperty("prop1", "Connector"),
        ],
        ["Connection", "Connector"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      expect(result.has("Connection")).toBe(false);
      expect(result.has("Connector")).toBe(true);
      const connectorProps = result.get("Connector");
      expect(connectorProps?.find((p) => p.name === "topic.prefix")).toBeDefined();
    });

    it("moves topic.prefix to first non-Connection group when Connector does not exist", () => {
      const schema = createSchema(
        [
          createProperty("topic.prefix", "Connection"),
          createProperty("prop1", "Advanced"),
          createProperty("prop2", "Custom"),
        ],
        ["Connection", "Custom", "Advanced"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      expect(result.has("Connection")).toBe(false);
      // Custom has lower order (1) than Advanced (2), so topic.prefix goes to Custom
      const customProps = result.get("Custom");
      expect(customProps?.find((p) => p.name === "topic.prefix")).toBeDefined();
    });

    it("moves topic.prefix to Advanced when no other groups exist", () => {
      const schema = createSchema(
        [createProperty("topic.prefix", "Connection")],
        ["Connection"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      expect(result.has("Connection")).toBe(false);
      expect(result.has("Advanced")).toBe(true);
      const advancedProps = result.get("Advanced");
      expect(advancedProps?.find((p) => p.name === "topic.prefix")).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("handles empty properties array", () => {
      const schema = createSchema([], ["Connector"]);

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      expect(result.size).toBe(0);
    });

    it("handles schema with only filtered groups", () => {
      const schema = createSchema(
        [
          createProperty("database.hostname", "Connection"),
          createProperty("ssl.cert", "Connection Advanced Ssl"),
        ],
        ["Connection", "Connection Advanced Ssl"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      expect(result.size).toBe(0);
    });

    it("handles schema with only topic.prefix", () => {
      const schema = createSchema(
        [createProperty("topic.prefix", "Connection")],
        ["Connection", "Connector"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      expect(result.size).toBe(1);
      expect(result.has("Connector")).toBe(true);
      expect(result.get("Connector")).toHaveLength(1);
    });

    it("preserves all properties from non-filtered groups", () => {
      const schema = createSchema(
        [
          createProperty("prop1", "Connector"),
          createProperty("prop2", "Connector"),
          createProperty("prop3", "Advanced"),
          createProperty("prop4", "Advanced"),
          createProperty("prop5", "Custom"),
        ],
        ["Connector", "Advanced", "Custom"]
      );

      const result = buildSourceConnectorDisplayGroupedProperties(schema);

      expect(result.size).toBe(3);
      expect(result.get("Connector")).toHaveLength(2);
      expect(result.get("Advanced")).toHaveLength(2);
      expect(result.get("Custom")).toHaveLength(1);
    });
  });
});

