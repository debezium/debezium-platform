import { describe, it, expect } from "vitest";
import {
  descriptorPath,
  getConnectorFamily,
  getTransformCatalogGroupId,
  getUniqueCatalogNames,
  getUniqueTransformNames,
  getVariantLabel,
  getVariantSuffix,
  getVariantsForName,
  isCatalogTransformNameCompatible,
  isTransformCompatibleWithSource,
  pickDefaultVariant,
} from "./transformCatalog";
import type { CatalogComponentEntry } from "../apis/types";

const entry = (
  partial: Partial<CatalogComponentEntry> & Pick<CatalogComponentEntry, "class" | "name">
): CatalogComponentEntry => ({
  description: partial.description ?? "",
  descriptor: partial.descriptor ?? `${partial.class}.json`,
  ...partial,
});

describe("transformCatalog", () => {
  describe("getTransformCatalogGroupId", () => {
    it("groups ai package under AI", () => {
      expect(
        getTransformCatalogGroupId(
          entry({
            class: "io.debezium.ai.docling.FieldToDocling",
            name: "Field To Docling",
          })
        )
      ).toBe("ai");
      expect(
        getTransformCatalogGroupId(
          entry({
            class: "io.debezium.ai.embeddings.FieldToEmbedding",
            name: "FieldToEmbedding",
          })
        )
      ).toBe("ai");
    });

    it("groups kafka connect transforms under kafkaConnect", () => {
      expect(
        getTransformCatalogGroupId(
          entry({
            class: "org.apache.kafka.connect.transforms.Filter",
            name: "org.apache.kafka.connect.transforms.Filter",
          })
        )
      ).toBe("kafkaConnect");
    });

    it("groups core debezium transforms under debeziumSmt", () => {
      expect(
        getTransformCatalogGroupId(
          entry({
            class: "io.debezium.transforms.ExtractNewRecordState",
            name: "io.debezium.transforms.ExtractNewRecordState",
          })
        )
      ).toBe("debeziumSmt");
      expect(
        getTransformCatalogGroupId(
          entry({
            class: "io.debezium.transforms.outbox.EventRouter",
            name: "io.debezium.transforms.outbox.EventRouter",
          })
        )
      ).toBe("debeziumSmt");
    });

    it("groups connector package transforms under connectorSpecific", () => {
      expect(
        getTransformCatalogGroupId(
          entry({
            class: "io.debezium.connector.jdbc.transforms.FieldNameTransformation",
            name: "io.debezium.connector.jdbc.transforms.FieldNameTransformation",
          })
        )
      ).toBe("connectorSpecific");
    });

    it("groups unmatched classes under other", () => {
      expect(
        getTransformCatalogGroupId(
          entry({
            class: "io.debezium.something.CustomTransform",
            name: "io.debezium.something.CustomTransform",
          })
        )
      ).toBe("other");
      expect(
        getTransformCatalogGroupId(
          entry({
            class: "com.example.MyTransform",
            name: "com.example.MyTransform",
          })
        )
      ).toBe("other");
    });
  });

  describe("source compatibility", () => {
    const postgresSource = "io.debezium.connector.postgresql.PostgresConnector";
    const mysqlSource = "io.debezium.connector.mysql.MySqlConnector";
    const mariadbSource = "io.debezium.connector.mariadb.MariaDbConnector";

    it("extracts connector family", () => {
      expect(getConnectorFamily(postgresSource)).toBe("postgresql");
      expect(
        getConnectorFamily(
          "io.debezium.connector.mongodb.transforms.ExtractNewDocumentState"
        )
      ).toBe("mongodb");
      expect(getConnectorFamily("io.debezium.transforms.Filter")).toBeUndefined();
    });

    it("allows non-connector transforms for any source", () => {
      expect(
        isTransformCompatibleWithSource(
          "io.debezium.transforms.Filter",
          postgresSource
        )
      ).toBe(true);
      expect(
        isTransformCompatibleWithSource(
          "org.apache.kafka.connect.transforms.Filter",
          mysqlSource
        )
      ).toBe(true);
    });

    it("allows matching connector-specific transforms only", () => {
      expect(
        isTransformCompatibleWithSource(
          "io.debezium.connector.postgresql.transforms.TimescaleDb",
          postgresSource
        )
      ).toBe(true);
      expect(
        isTransformCompatibleWithSource(
          "io.debezium.connector.mongodb.transforms.ExtractNewDocumentState",
          postgresSource
        )
      ).toBe(false);
    });

    it("treats mysql and mariadb as distinct", () => {
      expect(
        isTransformCompatibleWithSource(
          "io.debezium.connector.mysql.transforms.ReadToInsertEvent",
          mysqlSource
        )
      ).toBe(true);
      expect(
        isTransformCompatibleWithSource(
          "io.debezium.connector.mysql.transforms.ReadToInsertEvent",
          mariadbSource
        )
      ).toBe(false);
    });

    it("allows all transforms when sourceType is omitted", () => {
      expect(
        isTransformCompatibleWithSource(
          "io.debezium.connector.jdbc.transforms.FieldNameTransformation",
          undefined
        )
      ).toBe(true);
    });

    it("resolves catalog name compatibility from entry class", () => {
      const entries = [
        entry({
          class: "io.debezium.connector.mongodb.transforms.ExtractNewDocumentState",
          name: "io.debezium.connector.mongodb.transforms.ExtractNewDocumentState",
        }),
      ];
      expect(
        isCatalogTransformNameCompatible(
          entries,
          entries[0].name,
          postgresSource
        )
      ).toBe(false);
      expect(
        isCatalogTransformNameCompatible(entries, entries[0].name, undefined)
      ).toBe(true);
    });
  });

  describe("variants", () => {
    const dropHeaders: CatalogComponentEntry[] = [
      entry({
        class: "org.apache.kafka.connect.transforms.DropHeaders",
        name: "org.apache.kafka.connect.transforms.DropHeaders",
      }),
      entry({
        class: "org.apache.kafka.connect.transforms.DropHeadersHuggingFace",
        name: "org.apache.kafka.connect.transforms.DropHeaders",
      }),
      entry({
        class: "org.apache.kafka.connect.transforms.DropHeadersMinilm",
        name: "org.apache.kafka.connect.transforms.DropHeaders",
      }),
    ];

    it("extracts variant suffix and labels", () => {
      expect(getVariantSuffix(dropHeaders[0])).toBe("");
      expect(getVariantLabel(dropHeaders[0])).toBe("Default");
      expect(getVariantSuffix(dropHeaders[1])).toBe("HuggingFace");
      expect(getVariantLabel(dropHeaders[1])).toBe("HuggingFace");
      expect(getVariantLabel(dropHeaders[2])).toBe("MiniLM");
    });

    it("collapses unique names and returns variants for a name", () => {
      const unique = getUniqueTransformNames(dropHeaders);
      expect(unique).toHaveLength(1);
      expect(unique[0].name).toBe(
        "org.apache.kafka.connect.transforms.DropHeaders"
      );
      expect(unique[0].groupId).toBe("kafkaConnect");
      expect(getVariantsForName(dropHeaders, unique[0].name)).toHaveLength(3);
      expect(pickDefaultVariant(dropHeaders)?.class).toBe(
        "org.apache.kafka.connect.transforms.DropHeaders"
      );
    });
  });

  describe("descriptorPath", () => {
    it("strips .json suffix", () => {
      expect(
        descriptorPath(
          "transformation/io.debezium.transforms.ExtractNewRecordState.json"
        )
      ).toBe("transformation/io.debezium.transforms.ExtractNewRecordState");
    });
  });

  describe("getUniqueCatalogNames", () => {
    it("dedupes shared predicate names", () => {
      const entries = [
        entry({
          class: "org.apache.kafka.connect.transforms.predicates.HasHeaderKey",
          name: "org.apache.kafka.connect.transforms.predicates.HasHeaderKey",
        }),
        entry({
          class:
            "org.apache.kafka.connect.transforms.predicates.HasHeaderKeyHuggingFace",
          name: "org.apache.kafka.connect.transforms.predicates.HasHeaderKey",
        }),
      ];
      expect(getUniqueCatalogNames(entries)).toEqual([
        "org.apache.kafka.connect.transforms.predicates.HasHeaderKey",
      ]);
    });
  });
});
