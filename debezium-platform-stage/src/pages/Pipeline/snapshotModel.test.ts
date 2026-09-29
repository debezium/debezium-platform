import { describe, expect, it } from "vitest";
import {
  clampPercent,
  formatCount,
  formatDuration,
  formatPercent,
  formatSnapshotDate,
  formatSnapshotTime,
  isSnapshotActive,
  sortSnapshotTables,
  type SnapshotTable,
} from "./snapshotModel";

const table = (
  name: string,
  status: SnapshotTable["status"]
): SnapshotTable => ({
  name,
  status,
  progress: null,
  rowsScanned: null,
  skipReason: null,
});

describe("snapshotModel", () => {
  it("treats running and paused snapshots as active", () => {
    expect(isSnapshotActive("RUNNING")).toBe(true);
    expect(isSnapshotActive("PAUSED")).toBe(true);
    expect(isSnapshotActive("IDLE")).toBe(false);
    expect(isSnapshotActive("COMPLETED")).toBe(false);
    expect(isSnapshotActive(null)).toBe(false);
  });

  it("formats durations the way the snapshot views show them", () => {
    expect(formatDuration(332)).toBe("5m 32s");
    expect(formatDuration(754)).toBe("12m 34s");
    expect(formatDuration(15)).toBe("0m 15s");
    expect(formatDuration(62)).toBe("1m 02s");
    expect(formatDuration(3662)).toBe("1h 1m 02s");
    expect(formatDuration(null)).toBeNull();
  });

  it("shows one decimal for partial percentages and clamps the bar", () => {
    expect(formatPercent(58.3)).toBe("58.3%");
    expect(formatPercent(30)).toBe("30%");
    expect(formatPercent(140)).toBe("100%");
    expect(clampPercent(-4)).toBe(0);
  });

  it("formats counts and UTC timestamps", () => {
    expect(formatCount(245000, "en-US")).toBe("245,000");
    expect(formatCount(null)).toBe("—");
    expect(formatSnapshotTime("2026-08-05T10:00:12Z", "en-US")).toBe("10:00:12 UTC");
    expect(formatSnapshotDate("2026-08-05T10:12:34Z", "en-US")).toBe("Aug 5 10:12");
  });

  it("orders tables as completed, skipped or failed, in progress, then pending", () => {
    const ordered = sortSnapshotTables([
      table("inventory.categories", "PENDING"),
      table("inventory.orders", "IN_PROGRESS"),
      table("inventory.temp_data", "SKIPPED"),
      table("inventory.products", "COMPLETED"),
      table("inventory.legacy_log", "FAILED"),
    ]);

    expect(ordered.map((item) => item.name)).toEqual([
      "inventory.products",
      "inventory.temp_data",
      "inventory.legacy_log",
      "inventory.orders",
      "inventory.categories",
    ]);
  });
});
