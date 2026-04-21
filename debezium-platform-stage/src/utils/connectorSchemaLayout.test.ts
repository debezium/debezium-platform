import { describe, it, expect } from "vitest";
import {
  buildDependencyMap,
  collectAllDependants,
  isSchemaFieldVisible,
} from "./connectorSchemaLayout";
import type { SchemaProperty } from "../apis/types";

const baseDisplay = {
  label: "L",
  description: "D",
  group: "g",
  groupOrder: 0,
};

const prop = (
  name: string,
  valueDependants: SchemaProperty["valueDependants"],
): SchemaProperty => ({
  name,
  type: "string",
  display: { ...baseDisplay, label: name },
  validation: [],
  valueDependants,
});

describe("buildDependencyMap", () => {
  it("builds a map from properties with value dependants", () => {
    const properties = [
      prop("mode", [{ values: ["a"], dependants: ["extra"] }]),
      prop("other", []),
    ];
    const map = buildDependencyMap(properties);
    expect(map.get("mode")?.get("a")).toEqual(["extra"]);
    expect(map.has("other")).toBe(false);
  });

  it("merges multiple trigger values for the same parent", () => {
    const properties = [
      prop("p", [
        { values: ["1"], dependants: ["d1"] },
        { values: ["2"], dependants: ["d2"] },
      ]),
    ];
    const map = buildDependencyMap(properties);
    expect(map.get("p")?.get("1")).toEqual(["d1"]);
    expect(map.get("p")?.get("2")).toEqual(["d2"]);
  });
});

describe("collectAllDependants", () => {
  it("collects all dependant field names", () => {
    const properties = [
      prop("a", [{ values: ["x"], dependants: ["b", "c"] }]),
      prop("b", [{ values: ["y"], dependants: ["d"] }]),
    ];
    expect(collectAllDependants(properties)).toEqual(new Set(["b", "c", "d"]));
  });
});

describe("isSchemaFieldVisible", () => {
  const depMap = new Map<string, Map<string, string[]>>([
    ["parent", new Map([["on", ["child"]]])],
  ]);

  it("returns true when no dependency hides the field", () => {
    expect(
      isSchemaFieldVisible(
        { name: "child", type: "string", display: baseDisplay, validation: [], valueDependants: [] },
        { parent: "on" },
        depMap,
      ),
    ).toBe(true);
  });

  it("returns false when parent value does not match trigger", () => {
    expect(
      isSchemaFieldVisible(
        { name: "child", type: "string", display: baseDisplay, validation: [], valueDependants: [] },
        { parent: "off" },
        depMap,
      ),
    ).toBe(false);
  });

  it("treats missing parent value as empty string", () => {
    expect(
      isSchemaFieldVisible(
        { name: "child", type: "string", display: baseDisplay, validation: [], valueDependants: [] },
        {},
        depMap,
      ),
    ).toBe(false);
  });
});
