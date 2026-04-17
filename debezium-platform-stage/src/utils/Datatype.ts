import { SelectedDataListItem } from "../apis/types";
export const datatype = {
    postgresql: ["schema", "table"],
    mysql: ["database", "table"],
    mariadb: ["database", "table"],
    sqlserver: ["schema", "table"],
    oracle: ["schema", "table"],
    mongodb: ["database", "collection"],
    db2: ["schema", "table"],
} as const;

/** Labels for the data explorer subtitle */
export function getDataExplorerScopePhrase(connectorTypeId: string): string {
    const segment = connectorTypeId?.split(".")?.[3]?.toLowerCase();
    if (!segment) return "schema and table";
    const keys = Object.keys(datatype) as (keyof typeof datatype)[];
    const match = keys.find((k) => segment.includes(k) || k.includes(segment));
    if (!match) return "schema and table";
    return [...datatype[match]].join(" and ");
}

const DATABASE_FIELD_MAPPINGS: Record<string, { schema: string; table: string }> = {
    postgres: { schema: "schema.include.list", table: "table.include.list" },
    mysql: { schema: "database.include.list", table: "table.include.list" },
    mariadb: { schema: "database.include.list", table: "table.include.list" },
    sqlserver: { schema: "schema.include.list", table: "table.include.list" },
    oracle: { schema: "schema.include.list", table: "table.include.list" },
    mongo: { schema: "database.include.list", table: "collection.include.list" },
    db2: { schema: "schema.include.list", table: "table.include.list" },
};

const resolveDatabaseFieldMapping = (
    databaseType: string
): { schema: string; table: string } | undefined => {
    const dbKey = Object.keys(DATABASE_FIELD_MAPPINGS).find((key) =>
        databaseType.toLowerCase().includes(key)
    );
    return dbKey ? DATABASE_FIELD_MAPPINGS[dbKey] : undefined;
};

const includeListPropertyToExcludeListProperty = (includeName: string): string =>
    includeName.replace(".include.", ".exclude.");

/**
 * Include/exclude list property names driven by the source table explorer for this connector.
 * When present, those inputs are hidden in the Filters group because selection sets the include lists.
 */
export const getTableManagedFilterPropertyNames = (databaseType: string): string[] => {
    const mapping = resolveDatabaseFieldMapping(databaseType);
    if (!mapping) return [];
    const schemaExclude = includeListPropertyToExcludeListProperty(mapping.schema);
    const tableExclude = includeListPropertyToExcludeListProperty(mapping.table);
    return [...new Set([mapping.schema, mapping.table, schemaExclude, tableExclude])];
};

/** Include list keys written from the table explorer (not the paired exclude keys). */
export const getTableManagedIncludeListPropertyNames = (databaseType: string): string[] => {
    const mapping = resolveDatabaseFieldMapping(databaseType);
    if (!mapping) return [];
    return [mapping.schema, mapping.table];
};

/**
 * Generates include list configuration based on selected data items and database type
 * @param selectedDataListItems 
 * @param databaseType 
 * @returns Object with appropriate include list configuration for the database type
 */
export const getIncludeList = (
    selectedDataListItems: SelectedDataListItem | undefined,
    databaseType: string
): Record<string, string> => {
    const fieldMapping = resolveDatabaseFieldMapping(databaseType);

    if (!fieldMapping) {
        return {};
    }
    const result: Record<string, string> = {};

    if (selectedDataListItems?.schemas?.length) {
        result[fieldMapping.schema] = selectedDataListItems.schemas.join(",");
    }

    if (selectedDataListItems?.tables?.length) {
        result[fieldMapping.table] = selectedDataListItems.tables.join(",");
    }

    return result;
};