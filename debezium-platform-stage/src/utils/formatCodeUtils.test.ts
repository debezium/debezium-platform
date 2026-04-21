import { describe, it, expect } from "vitest";
import { extractTransformsAndPredicates, formatCode } from "./formatCodeUtils";
import type { Payload } from "src/apis";

describe("formatCode", () => {
  it("maps kafka-connect JSON to platform payload for source", () => {
    const kafka: Payload = {
      name: "c1",
      description: "d",
      type: "ignored",
      schema: "ignored",
      vaults: [],
      config: {
        "connector.class": "io.debezium.connector.mysql.MySqlConnector",
        "database.hostname": "db",
      },
    };

    const out = formatCode("source", "kafka-connect", kafka);
    expect(out.name).toBe("c1");
    expect(out.type).toBe("io.debezium.connector.mysql.MySqlConnector");
    expect(out.schema).toBe("schema123");
    expect(out.config).toEqual({ "database.hostname": "db" });
  });

  it("parses properties-file for source", () => {
    const raw = `
# header
debezium.source.connector.class = io.debezium.connector.mysql.MySqlConnector
debezium.source.database.hostname = localhost
`;
    const out = formatCode("source", "properties-file", raw);
    expect(out.type).toBe("io.debezium.connector.mysql.MySqlConnector");
    expect(out.config).toEqual({ "database.hostname": "localhost" });
  });

  it("parses properties-file for destination", () => {
    const raw = `debezium.sink.type = kafka
debezium.sink.topics = orders`;
    const out = formatCode("destination", "properties-file", raw);
    expect(out.type).toBe("kafka");
    expect(out.config).toEqual({ topics: "orders" });
  });
});

describe("extractTransformsAndPredicates", () => {
  it("returns empty array when no transform list is present", () => {
    expect(extractTransformsAndPredicates("foo=bar")).toEqual([]);
  });

  it("extracts transforms with type and config fields", () => {
    const raw = `
debezium.transforms=alpha
debezium.transforms.alpha.type=io.debezium.transforms.Filter
debezium.transforms.alpha.topic.regex=.*
`;
    const transforms = extractTransformsAndPredicates(raw);
    expect(transforms).toHaveLength(1);
    expect(transforms[0].name).toBe("alpha");
    expect(transforms[0].type).toBe("io.debezium.transforms.Filter");
    expect(transforms[0].config).toEqual({ "topic.regex": ".*" });
  });

  it("sets negate on transform without prior predicate config", () => {
    const raw = `
debezium.transforms=t1
debezium.transforms.t1.negate=true
`;
    const transforms = extractTransformsAndPredicates(raw);
    const t1 = transforms.find((t) => t.name === "t1");
    expect(t1?.predicate?.negate).toBe(true);
  });

  it("attaches predicates and negate flag when referenced", () => {
    const raw = `
debezium.predicates=p1
debezium.predicates.p1.type=org.example.Pred
debezium.predicates.p1.pattern=a
debezium.transforms=t1
debezium.transforms.t1.type=io.debezium.transforms.Filter
debezium.transforms.t1.predicate=p1
debezium.transforms.t1.negate=true
`;
    const transforms = extractTransformsAndPredicates(raw);
    const t1 = transforms.find((t) => t.name === "t1");
    expect(t1?.predicate?.type).toBe("org.example.Pred");
    expect(t1?.predicate?.config).toEqual({ pattern: "a" });
    expect(t1?.predicate?.negate).toBe(true);
  });
});
