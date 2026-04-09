export type SourceConfigAdditionalRow = { key: string; value: string };

export type SourceIncludeSelection = {
  schemas: string[];
  tables: string[];
};

export type SourceConfigHydrationSplit = {
  schemaValues: Record<string, string>;
  additionalProps: Map<string, SourceConfigAdditionalRow>;
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
  for (const key of Object.keys(cfg)) {
    if (!/\.include\.list$/.test(key)) continue;
    const raw = cfg[key];
    delete cfg[key];
    const str = stringifyConfigValue(raw);
    if (!str) continue;
    const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
    if (key.includes("database.") || key.includes("schema.")) {
      schemas.push(...parts);
    } else if (key.includes("table.") || key.includes("collection.")) {
      tables.push(...parts);
    }
  }

  const schemaNameSet = new Set(schemaPropertyNames);
  const schemaValues: Record<string, string> = {};
  const additionalProps = new Map<string, SourceConfigAdditionalRow>();
  let additionalIndex = 0;

  for (const [key, value] of Object.entries(cfg)) {
    const str = stringifyConfigValue(value);
    if (schemaNameSet.has(key)) {
      schemaValues[key] = str;
    } else {
      additionalProps.set(`addprop-${additionalIndex}`, { key, value: str });
      additionalIndex += 1;
    }
  }

  let selectedDataListItems: SourceIncludeSelection | undefined;
  if (schemas.length > 0 || tables.length > 0) {
    selectedDataListItems = { schemas, tables };
  }

  return {
    schemaValues,
    additionalProps,
    signalCollectionName,
    selectedDataListItems,
    additionalKeyCount: additionalIndex,
  };
}
