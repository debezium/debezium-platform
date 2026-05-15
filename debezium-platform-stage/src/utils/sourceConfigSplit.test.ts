import { describe, it, expect } from "vitest";
import {
  splitSourceConfigForHydration,
  stringifyConfigValue,
} from "./sourceConfigSplit";

describe("stringifyConfigValue", () => {
  it("returns empty string for null and undefined", () => {
    expect(stringifyConfigValue(null)).toBe("");
    expect(stringifyConfigValue(undefined)).toBe("");
  });

  it("stringifies primitives", () => {
    expect(stringifyConfigValue(true)).toBe("true");
    expect(stringifyConfigValue(42)).toBe("42");
    expect(stringifyConfigValue("x")).toBe("x");
  });

  it("JSON-stringifies plain objects", () => {
    expect(stringifyConfigValue({ a: 1 })).toBe('{"a":1}');
  });

  it("stringifies bigint via fallback branch", () => {
    expect(stringifyConfigValue(BigInt(1) as unknown)).toBe("1");
  });

  it("falls back when JSON.stringify throws", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(stringifyConfigValue(circular)).toBe("[object Object]");
  });
});

describe("splitSourceConfigForHydration", () => {
  it("handles undefined config", () => {
    const out = splitSourceConfigForHydration(undefined, ["host"]);
    expect(out.schemaValues).toEqual({});
    expect(out.additionalProps.size).toBe(0);
    expect(out.signalCollectionName).toBe("");
    expect(out.selectedDataListItems).toBeUndefined();
    expect(out.additionalKeyCount).toBe(0);
  });

  it("extracts signal.data.collection and include lists", () => {
    const out = splitSourceConfigForHydration(
      {
        "signal.data.collection": "db.signal",
        "schema.include.list": " public , other ",
        "table.include.list": "t1,t2",
        host: "localhost",
      },
      ["host"],
    );

    expect(out.signalCollectionName).toBe("db.signal");
    expect(out.selectedDataListItems).toEqual({
      schemas: ["public", "other"],
      tables: ["t1", "t2"],
    });
    expect(out.schemaValues).toEqual({ host: "localhost" });
    expect(out.additionalProps.size).toBe(0);
  });

  it("splits database and collection include lists for Mongo-like keys", () => {
    const out = splitSourceConfigForHydration(
      {
        "database.include.list": "db1",
        "collection.include.list": "c1,c2",
      },
      [],
    );
    expect(out.selectedDataListItems).toEqual({
      schemas: ["db1"],
      tables: ["c1", "c2"],
    });
  });

  it("skips empty include list values", () => {
    const out = splitSourceConfigForHydration(
      {
        "schema.include.list": "",
        "table.include.list": "   ",
      },
      [],
    );
    expect(out.selectedDataListItems).toBeUndefined();
  });

  it("routes unknown keys into additionalProps", () => {
    const out = splitSourceConfigForHydration(
      { "custom.key": "v" },
      [],
    );
    expect(out.additionalProps.get("addprop-0")).toEqual({
      key: "custom.key",
      value: "v",
    });
    expect(out.additionalKeyCount).toBe(1);
  });
});
