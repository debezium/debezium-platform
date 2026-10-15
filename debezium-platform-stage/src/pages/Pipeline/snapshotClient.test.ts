import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL } from "@utils/constants";
import {
  getSnapshotHistory,
  getSnapshotHistoryDetail,
  getSnapshotProgress,
  normalizeSnapshotHistory,
  normalizeSnapshotProgress,
  subscribeSnapshotProgress,
} from "./snapshotClient";

const httpResponse = (body: unknown, ok = true) =>
  ({
    ok,
    statusText: ok ? "OK" : "Not Found",
    json: async () => body,
  }) as Response;

describe("snapshot progress client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps chunkNumber from the conductor payload onto chunkIndex", () => {
    const progress = normalizeSnapshotProgress({
      type: "INITIAL",
      status: "RUNNING",
      globalProgress: { totalTables: 2, completedTables: 0, percentage: 20 },
      tables: [
        {
          name: "inventory.orders",
          status: "IN_PROGRESS",
          progress: { chunkNumber: 3, totalChunks: 10, percentage: 20 },
          rowsScanned: 28400,
          skipReason: null,
        },
      ],
      startedAt: "2026-08-05T10:00:12Z",
      elapsedSeconds: 12,
      totalRowsScanned: 28400,
    });

    expect(progress.tables[0]?.progress).toEqual({
      chunkIndex: 3,
      totalChunks: 10,
      percentage: 20,
    });
    expect(progress.status).toBe("RUNNING");
  });

  it("reads current progress from the pipeline progress endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      httpResponse({
        type: null,
        status: "IDLE",
        globalProgress: null,
        tables: [],
        totalRowsScanned: 0,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await getSnapshotProgress("7");

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/pipelines/7/snapshots/progress`
    );
    expect(response.data).toMatchObject({
      type: null,
      status: "IDLE",
      globalProgress: null,
      tables: [],
      totalRowsScanned: 0,
    });
  });

  it("returns the fetch error when progress is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(httpResponse(null, false))
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await getSnapshotProgress("7");

    expect(response.data).toBeUndefined();
    expect(response.error).toBe("Failed to fetch data: Not Found");
  });

  it("keeps a history table outcome that is not a snapshot outcome", () => {
    const run = normalizeSnapshotHistory({
      id: 4,
      pipelineId: 7,
      type: "INITIAL",
      outcome: "COMPLETED",
      totalTables: 1,
      completedTables: 0,
      totalRowsScanned: 0,
      startedAt: "2026-09-01T10:00:00Z",
      completedAt: "2026-09-01T10:01:00Z",
      durationSeconds: 60,
      tables: [
        {
          tableName: "inventory.audit",
          outcome: "SKIPPED",
          rowsScanned: 0,
          skipReason: "Table is empty",
          durationSeconds: 0,
        },
      ],
    });

    expect(run.tables?.[0]).toEqual({
      tableName: "inventory.audit",
      outcome: "SKIPPED",
      rowsScanned: 0,
      skipReason: "Table is empty",
      durationSeconds: 0,
    });
  });

  it("omits tables when the history list leaves them out", () => {
    const run = normalizeSnapshotHistory({
      id: 4,
      pipelineId: 7,
      type: "INCREMENTAL",
      outcome: "ABORTED",
      tables: null,
    });

    expect(run.tables).toBeUndefined();
    expect(run.outcome).toBe("ABORTED");
  });

  it("reads a page of snapshot history", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      httpResponse({
        items: [
          {
            id: 9,
            pipelineId: 7,
            type: "INITIAL",
            outcome: "COMPLETED",
            totalTables: 2,
            completedTables: 2,
            totalRowsScanned: 300,
            startedAt: "2026-09-01T10:00:00Z",
            completedAt: "2026-09-01T10:05:00Z",
            durationSeconds: 300,
            tables: null,
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await getSnapshotHistory("7", 0, 20);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/pipelines/7/snapshots/history?page=0&size=20`
    );
    expect(response.data?.items).toHaveLength(1);
    expect(response.data?.items[0]?.tables).toBeUndefined();
    expect(response.data?.totalElements).toBe(1);
  });

  it("reads one snapshot run with its tables", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      httpResponse({
        id: 9,
        pipelineId: 7,
        type: "INITIAL",
        outcome: "COMPLETED",
        totalTables: 1,
        completedTables: 1,
        totalRowsScanned: 250,
        startedAt: "2026-09-01T10:00:00Z",
        completedAt: "2026-09-01T10:05:00Z",
        durationSeconds: 300,
        tables: [
          {
            tableName: "inventory.orders",
            outcome: "COMPLETED",
            rowsScanned: 250,
            skipReason: null,
            durationSeconds: 30,
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await getSnapshotHistoryDetail("7", 9);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/pipelines/7/snapshots/history/9`
    );
    expect(response.data?.tables).toEqual([
      {
        tableName: "inventory.orders",
        outcome: "COMPLETED",
        rowsScanned: 250,
        skipReason: null,
        durationSeconds: 30,
      },
    ]);
  });

  it("returns the fetch error when a history run is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(httpResponse(null, false))
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await getSnapshotHistoryDetail("7", 999);

    expect(response.data).toBeUndefined();
    expect(response.error).toBe("Failed to fetch data: Not Found");
  });

  it("applies named snapshot-progress events and closes the stream", () => {
    const instances: FakeEventSource[] = [];

    class FakeEventSource {
      url: string;
      closed = false;
      listeners = new Map<string, Set<(event: Event) => void>>();

      constructor(url: string) {
        this.url = url;
        instances.push(this);
      }

      addEventListener(type: string, listener: (event: Event) => void) {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(type: string, listener: (event: Event) => void) {
        this.listeners.get(type)?.delete(listener);
      }

      close() {
        this.closed = true;
      }

      emit(type: string, data: string) {
        for (const listener of this.listeners.get(type) ?? []) {
          listener({ data } as MessageEvent);
        }
      }
    }

    vi.stubGlobal("EventSource", FakeEventSource);

    const onProgress = vi.fn();
    const unsubscribe = subscribeSnapshotProgress("7", onProgress);
    const source = instances[0];

    expect(source?.url).toBe(
      `${API_URL}/api/pipelines/7/snapshots/progress/stream`
    );

    source?.emit(
      "message",
      JSON.stringify({ status: "RUNNING", tables: [] })
    );
    expect(onProgress).not.toHaveBeenCalled();

    source?.emit(
      "snapshot-progress",
      JSON.stringify({
        type: "INITIAL",
        status: "RUNNING",
        globalProgress: { totalTables: 2, completedTables: 1, percentage: 50 },
        tables: [
          {
            name: "inventory.orders",
            status: "IN_PROGRESS",
            progress: { chunkNumber: 2, totalChunks: 4, percentage: 25 },
            rowsScanned: 10,
            skipReason: null,
          },
        ],
        totalRowsScanned: 10,
      })
    );

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "RUNNING",
        tables: [
          expect.objectContaining({
            progress: { chunkIndex: 2, totalChunks: 4, percentage: 25 },
          }),
        ],
      })
    );

    source?.emit("snapshot-progress", "{");
    expect(onProgress).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(source?.closed).toBe(true);
  });
});
