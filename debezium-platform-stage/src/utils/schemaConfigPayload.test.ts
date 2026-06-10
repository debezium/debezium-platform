import { describe, it, expect } from "vitest";
import { buildSchemaConfigPayload } from "./schemaConfigPayload";
import type { SchemaProperty } from "../apis/types";

const baseDisplay = {
  label: "L",
  description: "D",
  group: "g",
  groupOrder: 0,
};

const prop = (name: string, extra?: Partial<SchemaProperty>): SchemaProperty => ({
  name,
  type: "string",
  display: { ...baseDisplay, label: name },
  validation: [],
  valueDependants: [],
  ...extra,
});

describe("buildSchemaConfigPayload", () => {
  const properties = [
    prop("host"),
    prop("metrics.enabled", { type: "boolean", default: "true" }),
    prop("port", { default: "5432" }),
  ];

  it("create: omits untouched fields including those with defaults", () => {
    const config = buildSchemaConfigPayload({
      properties,
      schemaValues: { host: "localhost" },
      isEdit: false,
      tableManagedIncludeListNames: new Set(),
    });
    expect(config).toEqual({ host: "localhost" });
  });

  it("create: includes touched boolean false", () => {
    const config = buildSchemaConfigPayload({
      properties,
      schemaValues: { "metrics.enabled": "false" },
      isEdit: false,
      tableManagedIncludeListNames: new Set(),
    });
    expect(config).toEqual({ "metrics.enabled": "false" });
  });

  it("create: skips touched fields cleared to empty string", () => {
    const config = buildSchemaConfigPayload({
      properties,
      schemaValues: { host: "" },
      isEdit: false,
      tableManagedIncludeListNames: new Set(),
    });
    expect(config).toEqual({});
  });

  it("edit: re-sends all persisted keys", () => {
    const config = buildSchemaConfigPayload({
      properties,
      schemaValues: { host: "localhost", port: "5432" },
      initialSchemaValues: { host: "localhost", port: "5432" },
      isEdit: true,
      tableManagedIncludeListNames: new Set(),
    });
    expect(config).toEqual({ host: "localhost", port: "5432" });
  });

  it("edit: omits never-saved default-only fields", () => {
    const config = buildSchemaConfigPayload({
      properties,
      schemaValues: { host: "localhost" },
      initialSchemaValues: { host: "localhost" },
      isEdit: true,
      tableManagedIncludeListNames: new Set(),
    });
    expect(config).toEqual({ host: "localhost" });
  });

  it("edit: includes newly touched default-only field", () => {
    const config = buildSchemaConfigPayload({
      properties,
      schemaValues: { host: "localhost", "metrics.enabled": "true" },
      initialSchemaValues: { host: "localhost" },
      isEdit: true,
      tableManagedIncludeListNames: new Set(),
    });
    expect(config).toEqual({ host: "localhost", "metrics.enabled": "true" });
  });

  it("edit: clearing persisted field omits key from payload", () => {
    const config = buildSchemaConfigPayload({
      properties,
      schemaValues: { host: "localhost", port: "" },
      initialSchemaValues: { host: "localhost", port: "9999" },
      isEdit: true,
      tableManagedIncludeListNames: new Set(),
    });
    expect(config).toEqual({ host: "localhost" });
  });

  it("skips table-managed include list property names", () => {
    const config = buildSchemaConfigPayload({
      properties: [prop("table.include.list"), prop("host")],
      schemaValues: { "table.include.list": "t1", host: "x" },
      isEdit: false,
      tableManagedIncludeListNames: new Set(["table.include.list"]),
    });
    expect(config).toEqual({ host: "x" });
  });
});
