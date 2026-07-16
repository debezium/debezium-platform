import { describe, expect, it } from "vitest";
import { generatePropertiesContent } from "./generateServerConfig";
import type { Connection, Destination, Source, TransformData } from "src/apis";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const source: Source = {
  id: 1,
  name: "my-pg-source",
  type: "io.debezium.connector.postgresql.PostgresConnector",
  schema: "schema123",
  vaults: [],
  config: {
    "topic.prefix": "tutorial",
    "table.include.list": "inventory.customers",
    "plugin.name": "pgoutput",
  },
  connection: { id: 42, name: "my-pg-conn" },
};

const sourceConnection: Connection = {
  id: 42,
  name: "my-pg-conn",
  type: "POSTGRESQL",
  config: {
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.dbname": "postgres",
    "database.user": "postgres",
    "database.password": "supersecret",
  },
};

const destination: Destination = {
  id: 2,
  name: "my-pubsub-sink",
  type: "pubsub",
  schema: "schema123",
  vaults: [],
  config: {
    "pubsub.project.id": "my-project",
    "pubsub.ordering.enabled": "true",
  },
};

const transforms: TransformData[] = [
  {
    id: 10,
    name: "unwrap",
    type: "io.debezium.transforms.ExtractNewRecordState",
    schema: "schema123",
    vaults: [],
    config: {
      "drop.tombstones": "false",
      "delete.handling.mode": "rewrite",
    },
    predicate: {
      type: "org.apache.kafka.connect.transforms.predicates.TopicNameMatches",
      config: { pattern: "outbox.event.*" },
      negate: false,
    },
  },
  {
    id: 11,
    name: "filter",
    type: "io.debezium.transforms.Filter",
    schema: "schema123",
    vaults: [],
    config: {
      language: "jsr223.groovy",
      condition: "value.op == 'u'",
    },
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generatePropertiesContent", () => {
  it("emits debezium.sink.type from destination.type", () => {
    const out = generatePropertiesContent(
      "test-pipeline",
      source,
      null,
      destination,
      null,
      []
    );
    expect(out).toContain("debezium.sink.type=pubsub");
  });

  it("emits debezium.source.connector.class from source.type", () => {
    const out = generatePropertiesContent(
      "test-pipeline",
      source,
      null,
      destination,
      null,
      []
    );
    expect(out).toContain(
      "debezium.source.connector.class=io.debezium.connector.postgresql.PostgresConnector"
    );
  });

  it("emits source config keys under debezium.source.*", () => {
    const out = generatePropertiesContent(
      "test-pipeline",
      source,
      null,
      destination,
      null,
      []
    );
    expect(out).toContain("debezium.source.topic.prefix=tutorial");
    expect(out).toContain(
      "debezium.source.table.include.list=inventory.customers"
    );
  });

  it("merges connection config under debezium.source.* when connection provided", () => {
    const out = generatePropertiesContent(
      "test-pipeline",
      source,
      sourceConnection,
      destination,
      null,
      []
    );
    expect(out).toContain("debezium.source.database.hostname=postgres");
    expect(out).toContain("debezium.source.database.port=5432");
    expect(out).toContain("debezium.source.database.dbname=postgres");
    expect(out).toContain("debezium.source.database.user=postgres");
  });

  it("redacts sensitive keys in connection config", () => {
    const out = generatePropertiesContent(
      "test-pipeline",
      source,
      sourceConnection,
      destination,
      null,
      []
    );
    expect(out).toContain("debezium.source.database.password=<REDACTED>");
    expect(out).not.toContain("supersecret");
  });

  it("does not include connection block when no connection provided", () => {
    const out = generatePropertiesContent(
      "test-pipeline",
      source,
      null,
      destination,
      null,
      []
    );
    expect(out).not.toContain("debezium.source.database.hostname");
  });

  it("emits transform list and per-transform properties", () => {
    const out = generatePropertiesContent(
      "test-pipeline",
      source,
      null,
      destination,
      null,
      transforms
    );
    expect(out).toContain("debezium.transforms=unwrap,filter");
    expect(out).toContain(
      "debezium.transforms.unwrap.type=io.debezium.transforms.ExtractNewRecordState"
    );
    expect(out).toContain(
      "debezium.transforms.unwrap.drop.tombstones=false"
    );
    expect(out).toContain(
      "debezium.transforms.filter.type=io.debezium.transforms.Filter"
    );
    expect(out).toContain(
      "debezium.transforms.filter.language=jsr223.groovy"
    );
  });

  it("emits predicate entries for transforms that have predicates", () => {
    const out = generatePropertiesContent(
      "test-pipeline",
      source,
      null,
      destination,
      null,
      transforms
    );
    expect(out).toContain("debezium.transforms.unwrap.predicate=unwrapPredicate");
    expect(out).toContain("debezium.transforms.unwrap.negate=false");
    expect(out).toContain("debezium.predicates=unwrapPredicate");
    expect(out).toContain(
      "debezium.predicates.unwrapPredicate.type=org.apache.kafka.connect.transforms.predicates.TopicNameMatches"
    );
    expect(out).toContain(
      "debezium.predicates.unwrapPredicate.pattern=outbox.event.*"
    );
  });

  it("does not emit transforms or predicates section when no transforms provided", () => {
    const out = generatePropertiesContent(
      "test-pipeline",
      source,
      null,
      destination,
      null,
      []
    );
    expect(out).not.toContain("debezium.transforms=");
    expect(out).not.toContain("debezium.predicates=");
  });

  it("includes pipeline name in header comment", () => {
    const out = generatePropertiesContent(
      "my-postgres-pipeline",
      source,
      null,
      destination,
      null,
      []
    );
    expect(out).toContain("# Pipeline: my-postgres-pipeline");
  });

  it("includes runtime stub as comments", () => {
    const out = generatePropertiesContent(
      "test-pipeline",
      source,
      null,
      destination,
      null,
      []
    );
    expect(out).toContain(
      "# debezium.source.offset.storage.file.filename=data/offsets.dat"
    );
    expect(out).toContain(
      "# debezium.source.offset.flush.interval.ms=0"
    );
  });

  it("emits destination config keys under debezium.sink.*", () => {
    const out = generatePropertiesContent(
      "test-pipeline",
      source,
      null,
      destination,
      null,
      []
    );
    expect(out).toContain("debezium.sink.pubsub.project.id=my-project");
    expect(out).toContain("debezium.sink.pubsub.ordering.enabled=true");
  });
});
