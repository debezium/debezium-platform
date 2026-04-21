import { describe, it, expect } from "vitest";
import {
  getActiveConnectionCount,
  getActiveResourceName,
} from "./connectionsUtils";
import type { Source } from "../apis/apis";

const src = (overrides: Partial<Source> = {}): Source =>
  ({
    id: 1,
    name: "S1",
    type: "mysql",
    schema: "",
    vaults: [],
    config: {},
    connection: { id: 10, name: "c1" },
    ...overrides,
  }) as Source;

describe("getActiveConnectionCount", () => {
  it("counts resources bound to a connection id", () => {
    const list = [src(), src({ id: 2, name: "S2", connection: { id: 10, name: "c1" } })];
    expect(getActiveConnectionCount(list, 10)).toBe(2);
    expect(getActiveConnectionCount(list, 99)).toBe(0);
  });

  it("ignores resources without a connection", () => {
    expect(getActiveConnectionCount([src({ connection: undefined })], 10)).toBe(0);
  });
});

describe("getActiveResourceName", () => {
  it("joins names for resources using the connection", () => {
    const list = [
      src({ name: "Alpha" }),
      src({ id: 2, name: "Beta", connection: { id: 10, name: "c1" } }),
    ];
    expect(getActiveResourceName(list, 10)).toBe("Alpha, Beta");
  });

  it("joins empty slots when connection is missing on some rows", () => {
    const list = [src({ name: "Only", connection: undefined })];
    expect(getActiveResourceName(list, 10)).toBe("");
  });
});
