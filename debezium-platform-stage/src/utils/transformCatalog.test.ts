import { describe, it, expect } from "vitest";
import {
  descriptorPath,
  getTransformCatalogGroupId,
  getUniqueCatalogNames,
  getUniqueTransformNames,
  getVariantLabel,
  getVariantSuffix,
  getVariantsForName,
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

    it("groups remaining debezium classes under debezium", () => {
      expect(
        getTransformCatalogGroupId(
          entry({
            class: "io.debezium.transforms.ExtractNewRecordState",
            name: "io.debezium.transforms.ExtractNewRecordState",
          })
        )
      ).toBe("debezium");
      expect(
        getTransformCatalogGroupId(
          entry({
            class: "io.debezium.connector.jdbc.transforms.FieldNameTransformation",
            name: "io.debezium.connector.jdbc.transforms.FieldNameTransformation",
          })
        )
      ).toBe("debezium");
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
