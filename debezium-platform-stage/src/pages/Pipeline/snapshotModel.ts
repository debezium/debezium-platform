export type SnapshotType = "INITIAL" | "INCREMENTAL";

export type SnapshotState =
  | "IDLE"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "ABORTED"
  | "SKIPPED"
  | "UNKNOWN";

export type TableState =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED"
  | "FAILED";

export type SnapshotOutcome = "COMPLETED" | "ABORTED" | "SKIPPED" | "UNKNOWN";

export type SnapshotGlobalProgress = {
  totalTables: number;
  completedTables: number;
  percentage: number | null;
};

export type SnapshotTableChunkProgress = {
  chunkIndex?: number;
  totalChunks?: number;
  percentage: number | null;
};

export type SnapshotTable = {
  name: string;
  status: TableState;
  progress: SnapshotTableChunkProgress | null;
  rowsScanned: number | null;
  skipReason: string | null;
};

/** Full snapshot aggregate from the progress REST endpoint and each SSE event. */
export type SnapshotProgressResponse = {
  type: SnapshotType | null;
  status: SnapshotState;
  globalProgress: SnapshotGlobalProgress | null;
  tables: SnapshotTable[];
  startedAt?: string | null;
  lastUpdatedAt?: string | null;
  elapsedSeconds?: number | null;
  totalRowsScanned?: number | null;
};

export type SnapshotHistoryTable = {
  tableName: string;
  outcome: string;
  rowsScanned: number | null;
  skipReason: string | null;
  durationSeconds: number | null;
};

export type SnapshotHistoryResponse = {
  id: number;
  pipelineId: number;
  pipelineName?: string;
  type: SnapshotType;
  outcome: SnapshotOutcome;
  totalTables: number;
  completedTables: number;
  totalRowsScanned: number | null;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  tables?: SnapshotHistoryTable[];
};

export type PagedSnapshotHistoryResponse = {
  items: SnapshotHistoryResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

const TABLE_STATUS_ORDER: Record<TableState, number> = {
  COMPLETED: 0,
  SKIPPED: 1,
  FAILED: 2,
  IN_PROGRESS: 3,
  PENDING: 4,
};

export const snapshotProgressPath = (pipelineId: string): string =>
  `/api/pipelines/${pipelineId}/snapshots/progress`;

export const snapshotProgressStreamPath = (pipelineId: string): string =>
  `${snapshotProgressPath(pipelineId)}/stream`;

export const snapshotHistoryPath = (pipelineId: string): string =>
  `/api/pipelines/${pipelineId}/snapshots/history`;

export const isSnapshotActive = (
  status: SnapshotState | null | undefined
): boolean => status === "RUNNING" || status === "PAUSED";

export const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
};

/** Detail views show one decimal. Whole numbers stay unpadded. */
export const formatPercent = (value: number): string => {
  const rounded = Math.round(clampPercent(value) * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded}%`;
  }
  return `${rounded.toFixed(1)}%`;
};

export const formatCount = (
  value: number | null | undefined,
  locale = "en-US"
): string => {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat(locale).format(value);
};

/** Durations follow the design examples: `5m 32s`, `0m 15s`, `1h 5m 02s`. */
export const formatDuration = (
  totalSeconds: number | null | undefined
): string | null => {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) {
    return null;
  }

  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = (seconds % 60).toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainder}s`;
  }
  return `${minutes}m ${remainder}s`;
};

export const formatSnapshotTime = (
  iso: string | null | undefined,
  locale = "en-US"
): string | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
  return `${time} UTC`;
};

export const formatSnapshotDate = (
  iso: string | null | undefined,
  locale = "en-US"
): string | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const day = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
  return `${day} ${time}`;
};

/** Completed tables first, then skipped or failed, then in progress, then pending. */
export const sortSnapshotTables = (tables: SnapshotTable[]): SnapshotTable[] =>
  tables
    .map((table, index) => ({ table, index }))
    .sort((left, right) => {
      const statusOrder =
        TABLE_STATUS_ORDER[left.table.status] -
        TABLE_STATUS_ORDER[right.table.status];
      return statusOrder !== 0 ? statusOrder : left.index - right.index;
    })
    .map(({ table }) => table);
