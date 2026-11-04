import { describe, it, expect } from "vitest";
import type { TableData } from "../apis/types";
import {
  applyExplorerSelection,
  candidateExplorerManagedProperties,
  resolveExplorerBinding,
  selectionFromSchemaValues,
} from "./Datatype";

const postgresProperties = [
  { name: "database.include.list" },
  { name: "database.exclude.list" },
  { name: "schema.include.list" },
  { name: "schema.exclude.list" },
  { name: "table.include.list" },
  { name: "table.exclude.list" },
  { name: "column.include.list" },
];

const databaseAndTableProperties = [
  { name: "database.include.list" },
  { name: "database.exclude.list" },
  { name: "table.include.list" },
  { name: "table.exclude.list" },
];

const mongoProperties = [
  { name: "database.include.list" },
  { name: "database.exclude.list" },
  { name: "collection.include.list" },
  { name: "collection.exclude.list" },
];

function tree(options: {
  catalog?: string | null;
  schema?: string | null;
  leaf?: string;
}): TableData {
  const leaf = options.leaf ?? "orders";
  return {
    catalogs: [
      {
        name: options.catalog === undefined ? null : options.catalog,
        totalCollections: 1,
        schemas: [
          {
            name: options.schema === undefined ? null : options.schema,
            collectionCount: 1,
            collections: [{ name: leaf, fullyQualifiedName: leaf.includes(".") ? leaf : `public.${leaf}` }],
          },
        ],
      },
    ],
  };
}

describe("resolveExplorerBinding", () => {
  it("binds schema and table for a postgres-shaped tree and leaves database manual", () => {
    const binding = resolveExplorerBinding(
      postgresProperties,
      tree({ catalog: null, schema: "public", leaf: "public.orders" }),
    );

    expect(binding.catalogProperty).toBeNull();
    expect(binding.schemaProperty).toBe("schema.include.list");
    expect(binding.leafProperty).toBe("table.include.list");
    expect(binding.scopePhrase).toBe("schema and table");
    expect(binding.managedProperties).toEqual([
      "schema.include.list",
      "schema.exclude.list",
      "table.include.list",
      "table.exclude.list",
    ]);
    expect(binding.managedProperties).not.toContain("database.include.list");
    expect(binding.managedProperties).not.toContain("column.include.list");
  });

  it("binds database and table when the schema level is unnamed", () => {
    const binding = resolveExplorerBinding(
      databaseAndTableProperties,
      tree({ catalog: "inventory", schema: null, leaf: "inventory.customers" }),
    );

    expect(binding.catalogProperty).toBe("database.include.list");
    expect(binding.schemaProperty).toBeNull();
    expect(binding.leafProperty).toBe("table.include.list");
    expect(binding.scopePhrase).toBe("database and table");
    expect(binding.managedProperties).toEqual([
      "database.include.list",
      "database.exclude.list",
      "table.include.list",
      "table.exclude.list",
    ]);
  });

  it("binds database and collection for a mongo-shaped tree", () => {
    const binding = resolveExplorerBinding(
      mongoProperties,
      tree({ catalog: "inventory", schema: null, leaf: "inventory.customers" }),
    );

    expect(binding.catalogProperty).toBe("database.include.list");
    expect(binding.leafProperty).toBe("collection.include.list");
    expect(binding.scopePhrase).toBe("database and collection");
  });

  it("uses database and table include lists for SQL Server, Oracle, and DB2 catalogs", () => {
    const namedCatalog = resolveExplorerBinding(
      databaseAndTableProperties,
      tree({ catalog: "sales", schema: "dbo", leaf: "sales.dbo.orders" }),
    );
    const schemaOnly = resolveExplorerBinding(
      databaseAndTableProperties,
      tree({ catalog: null, schema: "HR", leaf: "HR.ORDERS" }),
    );

    expect(namedCatalog.catalogProperty).toBe("database.include.list");
    expect(namedCatalog.schemaProperty).toBeNull();
    expect(namedCatalog.leafProperty).toBe("table.include.list");

    expect(schemaOnly.catalogProperty).toBeNull();
    expect(schemaOnly.schemaProperty).toBeNull();
    expect(schemaOnly.leafProperty).toBe("table.include.list");
    expect(schemaOnly.managedProperties).toEqual([
      "table.include.list",
      "table.exclude.list",
    ]);
  });

  it("binds nothing when the collections tree has no names", () => {
    const binding = resolveExplorerBinding(postgresProperties, { catalogs: [] });
    expect(binding.includeProperties).toEqual([]);
    expect(binding.scopePhrase).toBe("table");
  });
});

describe("candidateExplorerManagedProperties", () => {
  it("hides every include list the catalog defines, before the tree is known", () => {
    expect(candidateExplorerManagedProperties(postgresProperties)).toEqual([
      "database.include.list",
      "database.exclude.list",
      "schema.include.list",
      "schema.exclude.list",
      "table.include.list",
      "table.exclude.list",
    ]);
  });
});

describe("selectionFromSchemaValues and applyExplorerSelection", () => {
  const binding = resolveExplorerBinding(
    postgresProperties,
    tree({ catalog: null, schema: "public", leaf: "public.orders" }),
  );

  it("seeds explorer checks from include-list strings and writes them back", () => {
    const selection = selectionFromSchemaValues(
      {
        "schema.include.list": "public, other",
        "table.include.list": "public.orders",
        "column.include.list": "id",
      },
      binding,
    );

    expect(selection).toEqual({
      schemas: ["public", "other"],
      tables: ["public.orders"],
      values: {
        "schema.include.list": ["public", "other"],
        "table.include.list": ["public.orders"],
      },
    });

    const next = applyExplorerSelection(
      { "column.include.list": "id" },
      {
        schemas: ["public"],
        tables: [],
        values: { "schema.include.list": ["public"] },
      },
      binding,
    );

    expect(next).toEqual({
      "column.include.list": "id",
      "schema.include.list": "public",
    });
  });

  it("returns the same object when the selection already matches", () => {
    const current = { "schema.include.list": "public", "table.include.list": "" };
    const selection = selectionFromSchemaValues(current, binding);
    expect(applyExplorerSelection(current, selection, binding)).toBe(current);
  });
});
