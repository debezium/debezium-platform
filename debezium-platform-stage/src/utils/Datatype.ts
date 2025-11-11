import { SelectedDataListItem } from "@sourcePage/CreateSource";
export const datatype = {
    postgresql: ["schema", "table"],
    mysql: ["database", "table"],
    mariadb: ["database", "table"],
    sqlserver: ["schema", "table"],
    oracle: ["schema", "table"],
    mongodb: ["database", "collection"],
}

const DATABASE_FIELD_MAPPINGS: Record<string, { schema: string; table: string }> = {
    postgres: { schema: "schema.include.list", table: "table.include.list" },
    mysql: { schema: "database.include.list", table: "table.include.list" },
    mariadb: { schema: "database.include.list", table: "table.include.list" },
    sqlserver: { schema: "schema.include.list", table: "table.include.list" },
    oracle: { schema: "schema.include.list", table: "table.include.list" },
    mongo: { schema: "database.include.list", table: "collection.include.list" },
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
    const dbKey = Object.keys(DATABASE_FIELD_MAPPINGS).find((key) =>
        databaseType.toLowerCase().includes(key)
    );

    if (!dbKey) {
        return {};
    }

    const fieldMapping = DATABASE_FIELD_MAPPINGS[dbKey];
    const result: Record<string, string> = {};

    if (selectedDataListItems?.schemas?.length) {
        result[fieldMapping.schema] = selectedDataListItems.schemas.join(",");
    }

    if (selectedDataListItems?.tables?.length) {
        result[fieldMapping.table] = selectedDataListItems.tables.join(",");
    }

    return result;
};