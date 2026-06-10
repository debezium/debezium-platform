import { describe, it, expect } from "vitest";
import {
  buildDependencyMap,
  buildEffectiveSchemaValues,
  buildOccupiedSchemaKeys,
  collectAllDependants,
  getSchemaFieldDisplayValue,
  getSchemaFieldReviewState,
  isSchemaFieldShowingDefault,
  isSchemaFieldTouched,
  isSchemaFieldVisible,
} from "./connectorSchemaLayout";
import { validateAdditionalPropertyRows } from "./additionalConfigProperties";
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

describe("schema field defaults", () => {
  const withDefault = prop("metrics.enabled", []);
  withDefault.default = "true";

  it("uses schema default when field is untouched", () => {
    expect(getSchemaFieldDisplayValue(withDefault, {})).toBe("true");
    expect(isSchemaFieldTouched("metrics.enabled", {})).toBe(false);
  });

  it("uses touched value even when empty", () => {
    expect(getSchemaFieldDisplayValue(withDefault, { "metrics.enabled": "" })).toBe("");
    expect(isSchemaFieldTouched("metrics.enabled", { "metrics.enabled": "" })).toBe(true);
  });

  it("builds effective values for dependency checks", () => {
    const properties = [withDefault, prop("other", [])];
    expect(buildEffectiveSchemaValues(properties, {})).toEqual({
      "metrics.enabled": "true",
      other: "",
    });
  });

  it("resolves review state for configured, default, and unset", () => {
    expect(getSchemaFieldReviewState(withDefault, {})).toBe("default");
    expect(getSchemaFieldReviewState(withDefault, { "metrics.enabled": "false" })).toBe(
      "configured",
    );
    const noDefault = prop("host", []);
    expect(getSchemaFieldReviewState(noDefault, {})).toBe("unset");
    expect(getSchemaFieldReviewState(noDefault, { host: "db.local" })).toBe("configured");
  });

  it("detects when a field is showing schema default", () => {
    expect(isSchemaFieldShowingDefault(withDefault, {})).toBe(true);
    expect(isSchemaFieldShowingDefault(withDefault, { "metrics.enabled": "false" })).toBe(false);
  });

  it("builds occupied schema keys for collision detection", () => {
    const properties = [withDefault, prop("other", [])];
    expect(buildOccupiedSchemaKeys(properties, {})).toEqual(
      new Set(["metrics.enabled"])
    );
    expect(buildOccupiedSchemaKeys(properties, { other: "" })).toEqual(
      new Set(["metrics.enabled", "other"])
    );
  });

  it("flags additional property collision with default-only schema field", () => {
    const properties = [withDefault];
    const effective = buildEffectiveSchemaValues(properties, {});
    const rows = new Map([
      [
        "row-1",
        {
          key: "metrics.enabled",
          valueKind: "string" as const,
          stringValue: "false",
          booleanValue: false,
          integerInput: "",
        },
      ],
    ]);
    const result = validateAdditionalPropertyRows(rows, effective);
    expect(result.hasErrors).toBe(true);
    expect(result.rowIdsWithErrors.has("row-1")).toBe(true);
  });
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
