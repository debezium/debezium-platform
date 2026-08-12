import type { CatalogComponentEntry, SchemaProperty } from "../apis/types";

export type TransformCatalogGroupId =
  | "ai"
  | "debeziumSmt"
  | "connectorSpecific"
  | "kafkaConnect"
  | "other";

export type TransformCatalogGroup = {
  id: TransformCatalogGroupId;
  label: string;
};

export const TRANSFORM_CATALOG_GROUPS: TransformCatalogGroup[] = [
  { id: "ai", label: "AI" },
  { id: "debeziumSmt", label: "Debezium SMT" },
  { id: "connectorSpecific", label: "Connector-specific" },
  { id: "kafkaConnect", label: "Kafka Connect SMT" },
  { id: "other", label: "Other" },
];

const VARIANT_LABELS: Record<string, string> = {
  "": "Default",
  HuggingFace: "HuggingFace",
  Minilm: "MiniLM",
  Ollama: "Ollama",
  VoyageAi: "Voyage AI",
};

export function getTransformCatalogGroupId(
  entry: CatalogComponentEntry
): TransformCatalogGroupId {
  if (entry.class.startsWith("io.debezium.ai.")) {
    return "ai";
  }
  if (entry.class.startsWith("io.debezium.transforms.")) {
    return "debeziumSmt";
  }
  if (entry.class.startsWith("io.debezium.connector.")) {
    return "connectorSpecific";
  }
  if (entry.class.startsWith("org.apache.kafka.connect.transforms")) {
    return "kafkaConnect";
  }
  return "other";
}

const CONNECTOR_CLASS_PREFIX = "io.debezium.connector.";

export function getConnectorFamily(
  classOrType: string
): string | undefined {
  if (!classOrType.startsWith(CONNECTOR_CLASS_PREFIX)) {
    return undefined;
  }
  const family = classOrType
    .slice(CONNECTOR_CLASS_PREFIX.length)
    .split(".")[0];
  return family || undefined;
}

export function isConnectorSpecificTransform(classOrType: string): boolean {
  return classOrType.startsWith(CONNECTOR_CLASS_PREFIX);
}

export function isTransformCompatibleWithSource(
  transformType: string,
  sourceType: string | undefined
): boolean {
  if (!sourceType) return true;
  if (!isConnectorSpecificTransform(transformType)) return true;
  return getConnectorFamily(transformType) === getConnectorFamily(sourceType);
}

export function isCatalogTransformNameCompatible(
  entries: CatalogComponentEntry[],
  name: string,
  sourceType: string | undefined
): boolean {
  if (!sourceType) return true;
  const entry = entries.find((e) => e.name === name);
  if (!entry) return true;
  return isTransformCompatibleWithSource(entry.class, sourceType);
}

export function getVariantSuffix(entry: CatalogComponentEntry): string {
  const nameSimple = entry.name.split(".").pop() || entry.name;
  const classSimple = entry.class.split(".").pop() || entry.class;

  if (entry.class === entry.name || classSimple === nameSimple) {
    return "";
  }
  if (classSimple.startsWith(nameSimple)) {
    return classSimple.slice(nameSimple.length);
  }
  return classSimple;
}

export function getVariantLabel(entry: CatalogComponentEntry): string {
  const suffix = getVariantSuffix(entry);
  return VARIANT_LABELS[suffix] ?? (suffix || "Default");
}

export function descriptorPath(descriptor: string): string {
  return descriptor.replace(/\.json$/, "");
}

/** Unique transform names for the typeahead, preserving group order. */
export function getUniqueTransformNames(
  entries: CatalogComponentEntry[]
): { name: string; groupId: TransformCatalogGroupId }[] {
  const seen = new Set<string>();
  const result: { name: string; groupId: TransformCatalogGroupId }[] = [];

  const byGroup = new Map<TransformCatalogGroupId, CatalogComponentEntry[]>();
  for (const group of TRANSFORM_CATALOG_GROUPS) {
    byGroup.set(group.id, []);
  }
  for (const entry of entries) {
    byGroup.get(getTransformCatalogGroupId(entry))!.push(entry);
  }

  for (const group of TRANSFORM_CATALOG_GROUPS) {
    for (const entry of byGroup.get(group.id) || []) {
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
      result.push({ name: entry.name, groupId: group.id });
    }
  }

  return result;
}

export function getVariantsForName(
  entries: CatalogComponentEntry[],
  name: string
): CatalogComponentEntry[] {
  return entries
    .filter((e) => e.name === name)
    .slice()
    .sort((a, b) => getVariantSuffix(a).localeCompare(getVariantSuffix(b)));
}

/** Unique catalog display names (order preserved) — used for predicates. */
export function getUniqueCatalogNames(
  entries: CatalogComponentEntry[]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    if (seen.has(entry.name)) continue;
    seen.add(entry.name);
    result.push(entry.name);
  }
  return result;
}

export function findEntryByClass(
  entries: CatalogComponentEntry[],
  className: string
): CatalogComponentEntry | undefined {
  return entries.find((e) => e.class === className);
}

/** Prefer the Default (no-suffix) variant when selecting a name. */
export function pickDefaultVariant(
  variants: CatalogComponentEntry[]
): CatalogComponentEntry | undefined {
  if (variants.length === 0) return undefined;
  return (
    variants.find((v) => getVariantSuffix(v) === "") ?? variants[0]
  );
}

export function buildGroupedSchemaProperties(
  properties: SchemaProperty[]
): Map<string, SchemaProperty[]> {
  const map = new Map<string, SchemaProperty[]>();
  for (const prop of properties) {
    const group = prop.display.group || "Configuration";
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(prop);
  }
  return map;
}
