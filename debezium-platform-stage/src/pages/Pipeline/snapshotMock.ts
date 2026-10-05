import type {
  PagedSnapshotHistoryResponse,
  SnapshotHistoryResponse,
  SnapshotHistoryTable,
  SnapshotProgressResponse,
  SnapshotTable,
} from "./snapshotModel";

/**
 * Stand-in for the conductor snapshot APIs, which are not available yet.
 * Change this to preview the other screens: "running", "paused", or "idle".
 */
export type SnapshotMockScenario = "running" | "paused" | "idle";

export const snapshotMockScenario: SnapshotMockScenario = "paused";

export type SnapshotMockResponse<T> = {
  data?: T;
  error?: string;
};

const IDLE_PROGRESS: SnapshotProgressResponse = {
  type: null,
  status: "IDLE",
  globalProgress: null,
  tables: [],
};

const table = (
  name: string,
  status: SnapshotTable["status"],
  rowsScanned: number | null = null,
  progress: SnapshotTable["progress"] = null,
  skipReason: string | null = null
): SnapshotTable => ({
  name,
  status,
  rowsScanned,
  progress,
  skipReason,
});

const runningTables = (): SnapshotTable[] => [
  table("inventory.products", "COMPLETED", 12000),
  table("inventory.customers", "COMPLETED", 8500),
  table("inventory.orders", "COMPLETED", 95000),
  table("inventory.order_items", "COMPLETED", 42000),
  table("inventory.payments", "COMPLETED", 31200),
  table("inventory.shipments", "COMPLETED", 11300),
  table("inventory.returns", "COMPLETED", 45000),
  table("inventory.reviews", "IN_PROGRESS", 28400, {
    chunkIndex: 3,
    totalChunks: 10,
    percentage: 58,
  }),
  table("inventory.temp_data", "SKIPPED", null, null, "No primary key"),
  table("inventory.categories", "PENDING"),
  table("inventory.suppliers", "PENDING"),
  table("inventory.warehouses", "PENDING"),
];

const pausedTables = (): SnapshotTable[] => [
  table("inventory.products", "COMPLETED", 12000),
  table("inventory.customers", "COMPLETED", 8500),
  table("inventory.orders", "COMPLETED", 95000),
  table("inventory.reviews", "IN_PROGRESS", 9000, {
    chunkIndex: 3,
    totalChunks: 10,
    percentage: 30,
  }),
  table("inventory.categories", "PENDING"),
  table("inventory.suppliers", "PENDING"),
  table("inventory.warehouses", "PENDING"),
  table("inventory.shipments", "PENDING"),
  table("inventory.payments", "PENDING"),
  table("inventory.returns", "PENDING"),
];

const historyTables: Record<number, SnapshotHistoryTable[]> = {
  42: [
    { tableName: "inventory.products", outcome: "COMPLETED", rowsScanned: 12000, skipReason: null, durationSeconds: 15 },
    { tableName: "inventory.customers", outcome: "COMPLETED", rowsScanned: 8500, skipReason: null, durationSeconds: 12 },
    { tableName: "inventory.orders", outcome: "COMPLETED", rowsScanned: 95000, skipReason: null, durationSeconds: 165 },
  ],
  41: [
    { tableName: "inventory.orders", outcome: "COMPLETED", rowsScanned: 22000, skipReason: null, durationSeconds: 40 },
    { tableName: "inventory.customers", outcome: "COMPLETED", rowsScanned: 15200, skipReason: null, durationSeconds: 14 },
    { tableName: "inventory.products", outcome: "COMPLETED", rowsScanned: 8000, skipReason: null, durationSeconds: 8 },
  ],
  40: [
    { tableName: "inventory.orders", outcome: "COMPLETED", rowsScanned: 8100, skipReason: null, durationSeconds: 32 },
    { tableName: "inventory.legacy_log", outcome: "FAILED", rowsScanned: 0, skipReason: "SQL exception", durationSeconds: 4 },
  ],
};

const historyRuns: SnapshotHistoryResponse[] = [
  {
    id: 42,
    pipelineId: 7,
    type: "INITIAL",
    outcome: "COMPLETED",
    totalTables: 12,
    completedTables: 12,
    totalRowsScanned: 1245000,
    startedAt: "2026-08-05T10:00:00Z",
    completedAt: "2026-08-05T10:12:34Z",
    durationSeconds: 754,
  },
  {
    id: 41,
    pipelineId: 7,
    type: "INCREMENTAL",
    outcome: "COMPLETED",
    totalTables: 3,
    completedTables: 3,
    totalRowsScanned: 45200,
    startedAt: "2026-08-04T16:29:00Z",
    completedAt: "2026-08-04T16:30:02Z",
    durationSeconds: 62,
  },
  {
    id: 40,
    pipelineId: 7,
    type: "INCREMENTAL",
    outcome: "ABORTED",
    totalTables: 5,
    completedTables: 1,
    totalRowsScanned: 8100,
    startedAt: "2026-08-03T09:14:28Z",
    completedAt: "2026-08-03T09:15:00Z",
    durationSeconds: 32,
  },
];

const clone = <T>(value: T): T => structuredClone(value);

const pipelineNumber = (pipelineId: string): number => {
  const parsed = Number(pipelineId);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const createSnapshotProgress = (
  scenario: SnapshotMockScenario = snapshotMockScenario
): SnapshotProgressResponse => {
  if (scenario === "idle") {
    return clone(IDLE_PROGRESS);
  }

  if (scenario === "paused") {
    return {
      type: "INCREMENTAL",
      status: "PAUSED",
      globalProgress: { totalTables: 10, completedTables: 3, percentage: 30 },
      tables: pausedTables(),
      startedAt: new Date(Date.now() - 135_000).toISOString(),
      elapsedSeconds: 135,
      totalRowsScanned: 124500,
    };
  }

  return {
    type: "INITIAL",
    status: "RUNNING",
    globalProgress: { totalTables: 12, completedTables: 7, percentage: 58.3 },
    tables: runningTables(),
    startedAt: new Date(Date.now() - 332_000).toISOString(),
    elapsedSeconds: 332,
    totalRowsScanned: 245000,
  };
};

/** Returns the next full aggregate. The mock stays on the active snapshot. */
export const advanceSnapshotProgress = (
  current: SnapshotProgressResponse
): SnapshotProgressResponse => {
  if (current.status !== "RUNNING") {
    return clone(current);
  }

  const tables = current.tables.map((item) => ({
    ...item,
    progress: item.progress ? { ...item.progress } : null,
  }));
  const active = tables.find((item) => item.status === "IN_PROGRESS");
  if (!active) {
    return clone(current);
  }

  active.rowsScanned = (active.rowsScanned ?? 0) + 500;
  if (active.progress?.percentage != null) {
    const nextPercentage = Math.min(90, active.progress.percentage + 1);
    active.progress = {
      ...active.progress,
      percentage: nextPercentage,
      chunkIndex: Math.min(
        (active.progress.totalChunks ?? 10) - 1,
        Math.floor(nextPercentage / 10)
      ),
    };
  }

  const totalRowsScanned = tables.reduce(
    (sum, item) => sum + (item.rowsScanned ?? 0),
    0
  );

  return {
    ...current,
    tables,
    totalRowsScanned,
    lastUpdatedAt: new Date().toISOString(),
  };
};

export const getSnapshotProgress = (
  _pipelineId: string
): Promise<SnapshotMockResponse<SnapshotProgressResponse>> =>
  Promise.resolve({ data: createSnapshotProgress() });

export const subscribeSnapshotProgress = (
  _pipelineId: string,
  onProgress: (progress: SnapshotProgressResponse) => void
): (() => void) => {
  let current = createSnapshotProgress();
  onProgress(clone(current));

  if (current.status !== "RUNNING") {
    return () => undefined;
  }

  const timer = window.setInterval(() => {
    current = advanceSnapshotProgress(current);
    onProgress(clone(current));
    if (current.status !== "RUNNING") {
      window.clearInterval(timer);
    }
  }, 1000);

  return () => window.clearInterval(timer);
};

export const getSnapshotHistory = (
  pipelineId: string,
  page: number,
  size: number
): Promise<SnapshotMockResponse<PagedSnapshotHistoryResponse>> => {
  const start = Math.max(0, page) * size;
  const items = historyRuns.slice(start, start + size).map((item) => ({
    ...item,
    pipelineId: pipelineNumber(pipelineId),
    tables: [],
  }));

  return Promise.resolve({
    data: {
      items,
      page,
      size,
      totalElements: historyRuns.length,
      totalPages: Math.ceil(historyRuns.length / size),
    },
  });
};

export const getSnapshotHistoryDetail = (
  pipelineId: string,
  historyId: number
): Promise<SnapshotMockResponse<SnapshotHistoryResponse>> => {
  const item = historyRuns.find((run) => run.id === historyId);
  if (!item) {
    return Promise.resolve({ error: "Snapshot history is unavailable." });
  }

  return Promise.resolve({
    data: {
      ...item,
      pipelineId: pipelineNumber(pipelineId),
      tables: clone(historyTables[historyId] ?? []),
    },
  });
};
