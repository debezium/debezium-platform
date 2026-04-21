import { describe, it, expect } from "vitest";
import {
  getDataExplorerScopePhrase,
  getIncludeList,
  getTableManagedFilterPropertyNames,
  getTableManagedIncludeListPropertyNames,
} from "./Datatype";

describe("getDataExplorerScopePhrase", () => {
  it("returns schema and table wording for PostgreSQL-like ids", () => {
    expect(
      getDataExplorerScopePhrase("io.debezium.connector.postgresql.PostgresConnector"),
    ).toBe("schema and table");
  });

  it("returns database and collection for MongoDB-like ids", () => {
    expect(
      getDataExplorerScopePhrase("io.debezium.connector.mongodb.MongoDbConnector"),
    ).toBe("database and collection");
  });

  it("falls back when segment is missing or unknown", () => {
    expect(getDataExplorerScopePhrase("")).toBe("schema and table");
    expect(getDataExplorerScopePhrase("io.debezium.connector.unknown.Foo")).toBe("schema and table");
  });
});

describe("getTableManagedFilterPropertyNames", () => {
  it("returns include and exclude list keys for postgres-like types", () => {
    expect(getTableManagedFilterPropertyNames("postgresql")).toEqual(
      expect.arrayContaining([
        "schema.include.list",
        "table.include.list",
        "schema.exclude.list",
        "table.exclude.list",
      ]),
    );
  });

  it("returns empty array when type is not mapped", () => {
    expect(getTableManagedFilterPropertyNames("unknown-db")).toEqual([]);
  });
});

describe("getTableManagedIncludeListPropertyNames", () => {
  it("returns only include keys for mapped database types", () => {
    expect(getTableManagedIncludeListPropertyNames("mysql")).toEqual([
      "database.include.list",
      "table.include.list",
    ]);
  });

  it("returns mongo collection include list keys", () => {
    expect(getTableManagedIncludeListPropertyNames("mongodb")).toEqual([
      "database.include.list",
      "collection.include.list",
    ]);
  });

  it("returns db2 schema and table include keys", () => {
    expect(getTableManagedIncludeListPropertyNames("db2")).toEqual([
      "schema.include.list",
      "table.include.list",
    ]);
  });

  it("returns empty array when include-list mapping is missing", () => {
    expect(getTableManagedIncludeListPropertyNames("cassandra")).toEqual([]);
  });
});

describe("getIncludeList", () => {
  it("returns empty object when database type is not mapped", () => {
    expect(getIncludeList({ schemas: ["a"], tables: ["b"] }, "unknown")).toEqual({});
  });

  it("maps schemas and tables for PostgreSQL", () => {
    expect(
      getIncludeList(
        { schemas: ["public", "other"], tables: ["t1", "t2"] },
        "postgresql",
      ),
    ).toEqual({
      "schema.include.list": "public,other",
      "table.include.list": "t1,t2",
    });
  });

  it("includes only schemas when tables are absent", () => {
    expect(getIncludeList({ schemas: ["s1"], tables: [] }, "mysql")).toEqual({
      "database.include.list": "s1",
    });
  });

  it("includes only tables when schemas are absent", () => {
    expect(getIncludeList({ schemas: [], tables: ["t"] }, "sqlserver")).toEqual({
      "table.include.list": "t",
    });
  });

  it("returns empty object when selection is undefined", () => {
    expect(getIncludeList(undefined, "oracle")).toEqual({});
  });

  it("returns empty object when include lists are empty arrays", () => {
    expect(getIncludeList({ schemas: [], tables: [] }, "db2")).toEqual({});
  });
});
