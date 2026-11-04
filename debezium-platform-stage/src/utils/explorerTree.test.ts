import { describe, expect, it } from "vitest";
import type { TableData } from "../apis/types";
import { resolveExplorerBinding } from "./Datatype";
import { buildExplorerTree, extractExplorerSelections } from "./explorerTree";

const databaseAndTable = [
  { name: "database.include.list" },
  { name: "table.include.list" },
];

function checkAll(node: { checkProps: { checked?: boolean | null }; children?: { checkProps: { checked?: boolean | null } }[] }) {
  node.checkProps.checked = true;
  node.children?.forEach((child) => {
    child.checkProps.checked = true;
    if ("children" in child && Array.isArray(child.children)) {
      child.children.forEach((grand) => {
        grand.checkProps.checked = true;
      });
    }
  });
}

describe("extractExplorerSelections", () => {
  it("writes a fully checked schema to schema.include.list and omits its tables", () => {
    const data: TableData = {
      catalogs: [
        {
          name: null,
          totalCollections: 1,
          schemas: [
            {
              name: "public",
              collectionCount: 1,
              collections: [{ name: "orders", fullyQualifiedName: "public.orders" }],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(
      [
        { name: "database.include.list" },
        { name: "schema.include.list" },
        { name: "table.include.list" },
      ],
      data,
    );
    const tree = buildExplorerTree(data, binding);
    checkAll(tree[0]);

    expect(extractExplorerSelections(tree)).toEqual({
      schemas: ["public"],
      tables: [],
      values: { "schema.include.list": ["public"] },
    });
  });

  it("writes child table names when a schema has no schema.include.list", () => {
    const data: TableData = {
      catalogs: [
        {
          name: "sales",
          totalCollections: 3,
          schemas: [
            {
              name: "dbo",
              collectionCount: 2,
              collections: [
                { name: "orders", fullyQualifiedName: "sales.dbo.orders" },
                { name: "customers", fullyQualifiedName: "sales.dbo.customers" },
              ],
            },
            {
              name: "audit",
              collectionCount: 1,
              collections: [{ name: "events", fullyQualifiedName: "sales.audit.events" }],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(databaseAndTable, data);
    const tree = buildExplorerTree(data, binding);
    const schema = tree[0].children?.[0];
    expect(schema?.propertyName).toBeNull();
    if (!schema) throw new Error("expected schema group");
    checkAll(schema);
    tree[0].checkProps.checked = null;

    expect(extractExplorerSelections(tree)).toEqual({
      schemas: [],
      tables: ["sales.dbo.orders", "sales.dbo.customers"],
      values: {
        "table.include.list": ["sales.dbo.orders", "sales.dbo.customers"],
      },
    });
  });

  it("writes the catalog name when the whole database is selected", () => {
    const data: TableData = {
      catalogs: [
        {
          name: "sales",
          totalCollections: 1,
          schemas: [
            {
              name: "dbo",
              collectionCount: 1,
              collections: [{ name: "orders", fullyQualifiedName: "sales.dbo.orders" }],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(databaseAndTable, data);
    const tree = buildExplorerTree(data, binding);
    checkAll(tree[0]);

    expect(extractExplorerSelections(tree)).toEqual({
      schemas: ["sales"],
      tables: [],
      values: { "database.include.list": ["sales"] },
    });
  });

  it("hoists collections onto the catalog when the schema name is blank", () => {
    const data: TableData = {
      catalogs: [
        {
          name: "inventory",
          totalCollections: 1,
          schemas: [
            {
              name: null,
              collectionCount: 1,
              collections: [{ name: "customers", fullyQualifiedName: "inventory.customers" }],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(
      [...databaseAndTable, { name: "collection.include.list" }],
      data,
    );
    const tree = buildExplorerTree(data, binding);

    expect(tree).toHaveLength(1);
    expect(tree[0].level).toBe("catalog");
    expect(tree[0].children?.[0].level).toBe("collection");
    expect(tree[0].children?.[0].propertyName).toBe("table.include.list");
  });
});
