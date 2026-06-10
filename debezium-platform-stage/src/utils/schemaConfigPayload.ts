import type { SchemaProperty } from "../apis/types";
import { isSchemaFieldTouched } from "./connectorSchemaLayout";

export type BuildSchemaConfigPayloadArgs = {
  properties: SchemaProperty[];
  schemaValues: Record<string, string>;
  /** Persisted schema values from hydration; required for edit mode. */
  initialSchemaValues?: Record<string, string>;
  isEdit: boolean;
  tableManagedIncludeListNames: ReadonlySet<string>;
};

/**
 * Builds the schema portion of the connector config payload.
 *
 * Create: only keys the user touched (non-empty values).
 * Edit: all previously persisted keys plus any newly touched keys (full config replace safe).
 * Empty string values are always omitted (revert to implicit connector default).
 */
export function buildSchemaConfigPayload({
  properties,
  schemaValues,
  initialSchemaValues = {},
  isEdit,
  tableManagedIncludeListNames,
}: BuildSchemaConfigPayloadArgs): Record<string, string> {
  const config: Record<string, string> = {};

  for (const property of properties) {
    const name = property.name;
    if (tableManagedIncludeListNames.has(name)) {
      continue;
    }

    const touched = isSchemaFieldTouched(name, schemaValues);
    const wasPersisted = Object.prototype.hasOwnProperty.call(initialSchemaValues, name);
    const shouldInclude = isEdit ? wasPersisted || touched : touched;

    if (!shouldInclude) {
      continue;
    }

    const value = schemaValues[name];
    if (value === "") {
      continue;
    }

    config[name] = value;
  }

  return config;
}
