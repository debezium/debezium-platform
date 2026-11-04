import { SelectedDataListItem, TableData } from "../apis/types";

export const DATABASE_INCLUDE_LIST = "database.include.list";
export const SCHEMA_INCLUDE_LIST = "schema.include.list";
export const TABLE_INCLUDE_LIST = "table.include.list";
export const COLLECTION_INCLUDE_LIST = "collection.include.list";

const EXPLORER_INCLUDE_LISTS = [
    DATABASE_INCLUDE_LIST,
    SCHEMA_INCLUDE_LIST,
    TABLE_INCLUDE_LIST,
    COLLECTION_INCLUDE_LIST,
] as const;

export type ExplorerBinding = {
    /** Set when the tree has a catalog name and the catalog schema defines database.include.list. */
    catalogProperty: string | null;
    /** Set when the tree has a schema name and the catalog schema defines schema.include.list. */
    schemaProperty: string | null;
    /** table.include.list, or collection.include.list when the catalog has no table list. */
    leafProperty: string | null;
    includeProperties: string[];
    managedProperties: string[];
    scopePhrase: string;
};

export type NamedSchemaProperty = { name: string };

/** Default binding for callers that pick fully qualified names and do not have a connector catalog. */
export const LEGACY_EXPLORER_BINDING: ExplorerBinding = {
    catalogProperty: null,
    schemaProperty: SCHEMA_INCLUDE_LIST,
    leafProperty: TABLE_INCLUDE_LIST,
    includeProperties: [SCHEMA_INCLUDE_LIST, TABLE_INCLUDE_LIST],
    managedProperties: [
        SCHEMA_INCLUDE_LIST,
        "schema.exclude.list",
        TABLE_INCLUDE_LIST,
        "table.exclude.list",
    ],
    scopePhrase: "schema and table",
};

export function isPresentName(name: string | null | undefined): name is string {
    return typeof name === "string" && name.trim() !== "";
}

const includeListPropertyToExcludeListProperty = (includeName: string): string =>
    includeName.replace(".include.", ".exclude.");

const hasProperty = (properties: NamedSchemaProperty[], name: string): boolean =>
    properties.some((property) => property.name === name);

function levelHasName(collections: TableData | undefined, level: "catalog" | "schema" | "collection"): boolean {
    if (!collections?.catalogs) return false;
    for (const catalog of collections.catalogs) {
        if (level === "catalog" && isPresentName(catalog.name)) return true;
        for (const schema of catalog.schemas ?? []) {
            if (level === "schema" && isPresentName(schema.name)) return true;
            if (level === "collection") {
                for (const collection of schema.collections ?? []) {
                    if (isPresentName(collection.name) || isPresentName(collection.fullyQualifiedName)) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function scopePhraseFor(
    catalogProperty: string | null,
    schemaProperty: string | null,
    leafProperty: string | null
): string {
    const labels: string[] = [];
    if (catalogProperty) labels.push("database");
    if (schemaProperty) labels.push("schema");
    if (leafProperty === COLLECTION_INCLUDE_LIST) labels.push("collection");
    else if (leafProperty) labels.push("table");
    if (labels.length === 0) return "table";
    return labels.join(" and ");
}

/**
 * Decides which include-list properties the table explorer writes.
 * A level is bound only when the collections tree has a name at that level
 * and the connector catalog defines the matching property. No connector class name is used.
 */
export function resolveExplorerBinding(
    properties: NamedSchemaProperty[],
    collections: TableData | undefined
): ExplorerBinding {
    const catalogProperty =
        hasProperty(properties, DATABASE_INCLUDE_LIST) && levelHasName(collections, "catalog")
            ? DATABASE_INCLUDE_LIST
            : null;
    const schemaProperty =
        hasProperty(properties, SCHEMA_INCLUDE_LIST) && levelHasName(collections, "schema")
            ? SCHEMA_INCLUDE_LIST
            : null;

    let leafProperty: string | null = null;
    if (levelHasName(collections, "collection")) {
        if (hasProperty(properties, TABLE_INCLUDE_LIST)) leafProperty = TABLE_INCLUDE_LIST;
        else if (hasProperty(properties, COLLECTION_INCLUDE_LIST)) leafProperty = COLLECTION_INCLUDE_LIST;
    }

    const includeProperties = [catalogProperty, schemaProperty, leafProperty].filter(
        (name): name is string => name != null
    );
    const managedProperties = includeProperties.flatMap((name) => [
        name,
        includeListPropertyToExcludeListProperty(name),
    ]);

    return {
        catalogProperty,
        schemaProperty,
        leafProperty,
        includeProperties,
        managedProperties,
        scopePhrase: scopePhraseFor(catalogProperty, schemaProperty, leafProperty),
    };
}

/**
 * Include and exclude properties the explorer might take over, before the collections
 * response is known. Used to avoid flashing those fields while the request is in flight.
 */
export function candidateExplorerManagedProperties(properties: NamedSchemaProperty[]): string[] {
    return EXPLORER_INCLUDE_LISTS.filter((name) => hasProperty(properties, name)).flatMap((name) => [
        name,
        includeListPropertyToExcludeListProperty(name),
    ]);
}

function splitList(value: string | undefined): string[] {
    if (!value) return [];
    return value.split(",").map((part) => part.trim()).filter(Boolean);
}

/** Checkbox seed derived from the include-list strings already stored on the form. */
export function selectionFromSchemaValues(
    schemaValues: Record<string, string>,
    binding: ExplorerBinding
): SelectedDataListItem {
    const values: Record<string, string[]> = {};
    const schemas: string[] = [];
    const tables: string[] = [];

    for (const prop of binding.includeProperties) {
        const parts = splitList(schemaValues[prop]);
        if (!parts.length) continue;
        values[prop] = parts;
        if (prop === binding.leafProperty) tables.push(...parts);
        else schemas.push(...parts);
    }

    return { schemas, tables, values };
}

/**
 * Writes explorer selections back onto the schema values the form submits.
 * Returns the same object when nothing changed.
 */
export function applyExplorerSelection(
    schemaValues: Record<string, string>,
    selection: SelectedDataListItem | undefined,
    binding: ExplorerBinding
): Record<string, string> {
    let changed = false;
    const next: Record<string, string> = { ...schemaValues };

    for (const prop of binding.includeProperties) {
        const joined = (selection?.values?.[prop] ?? []).join(",");
        if ((schemaValues[prop] ?? "") !== joined) {
            next[prop] = joined;
            changed = true;
        }
    }

    return changed ? next : schemaValues;
}
