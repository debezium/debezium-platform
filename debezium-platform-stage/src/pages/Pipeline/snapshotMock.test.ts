import { describe, expect, it } from "vitest";
import {
  advanceSnapshotProgress,
  createSnapshotProgress,
  getSnapshotHistory,
  getSnapshotHistoryDetail,
} from "./snapshotMock";

describe("snapshotMock", () => {
  it("starts a running initial snapshot at 7 of 12 tables", () => {
    const progress = createSnapshotProgress("running");

    expect(progress.status).toBe("RUNNING");
    expect(progress.type).toBe("INITIAL");
    expect(progress.globalProgress).toEqual({
      totalTables: 12,
      completedTables: 7,
      percentage: 58.3,
    });
    expect(progress.tables).toHaveLength(12);
    expect(progress.tables.filter((table) => table.status === "COMPLETED")).toHaveLength(7);
  });

  it("keeps the snapshot running while rows and chunk progress move forward", () => {
    const progress = createSnapshotProgress("running");
    const next = advanceSnapshotProgress(progress);
    const reviews = next.tables.find((table) => table.name === "inventory.reviews");

    expect(next.status).toBe("RUNNING");
    expect(reviews?.status).toBe("IN_PROGRESS");
    expect(reviews?.rowsScanned).toBe(28900);
    expect(reviews?.progress?.percentage).toBe(59);
    expect(next.globalProgress?.completedTables).toBe(7);
  });

  it("pages history most recent first and loads per-table detail", async () => {
    const page = await getSnapshotHistory("7", 0, 2);

    expect(page.data?.items.map((item) => item.id)).toEqual([42, 41]);
    expect(page.data?.totalElements).toBe(3);
    expect(page.data?.items[0].tables).toEqual([]);

    const detail = await getSnapshotHistoryDetail("7", 42);
    expect(detail.data?.tables?.[0]).toMatchObject({
      tableName: "inventory.products",
      outcome: "COMPLETED",
      rowsScanned: 12000,
    });
  });
});
