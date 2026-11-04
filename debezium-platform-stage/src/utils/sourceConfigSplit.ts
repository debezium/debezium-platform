import {
  AdditionalPropertyRow,
  additionalPropertyRowFromApiValue,
} from "./additionalConfigProperties";

const EXPLORER_INCLUDE_LISTS = new Set([
  "database.include.list",
  "schema.include.list",
  "table.include.list",
  "collection.include.list",
]);

export type SourceIncludeSelection = {
  schemas: string[];
  tables: string[];
  values: Record<string, string[]>;
};

export type SourceConfigHydrationSplit = {
  schemaValues: Record<string, string>;
  additionalProps: Map<string, AdditionalPropertyRow>;
  signalCollectionName: string;
  selectedDataListItems: SourceIncludeSelection | undefined;
  additionalKeyCount: number;
};

export function stringifyConfigValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export function splitSourceConfigForHydration(
  rawConfig: Record<string, unknown> | undefined,
  schemaPropertyNames: string[]
): SourceConfigHydrationSplit {
  const cfg: Record<string, unknown> = rawConfig ? { ...rawConfig } : {};

  let signalCollectionName = "";
  if ("signal.data.collection" in cfg) {
    signalCollectionName = stringifyConfigValue(cfg["signal.data.collection"]);
    delete cfg["signal.data.collection"];
  }

  const schemas: string[] = [];
  const tables: string[] = [];
  const values: Record<string, string[]> = {};
  const schemaValues: Record<string, string> = {};

  for (const key of Object.keys(cfg)) {
    if (!EXPLORER_INCLUDE_LISTS.has(key)) continue;
    const raw = cfg[key];
    delete cfg[key];
    const parts = stringifyConfigValue(raw).split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    const joined = parts.join(",");
    schemaValues[key] = joined;
    values[key] = parts;
    if (key.startsWith("database.") || key.startsWith("schema.")) {
      schemas.push(...parts);
    } else {
      tables.push(...parts);
    }
  }

  const schemaNameSet = new Set(schemaPropertyNames);
  const additionalProps = new Map<string, AdditionalPropertyRow>();
  let additionalIndex = 0;

  for (const [key, value] of Object.entries(cfg)) {
    if (schemaNameSet.has(key)) {
      schemaValues[key] = stringifyConfigValue(value);
    } else {
      additionalProps.set(`addprop-${additionalIndex}`, additionalPropertyRowFromApiValue(key, value));
      additionalIndex += 1;
    }
  }

  let selectedDataListItems: SourceIncludeSelection | undefined;
  if (schemas.length > 0 || tables.length > 0) {
    selectedDataListItems = { schemas, tables, values };
  }

  return {
    schemaValues,
    additionalProps,
    signalCollectionName,
    selectedDataListItems,
    additionalKeyCount: additionalIndex,
  };
}

