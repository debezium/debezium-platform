import { fetchResult } from "src/apis/apis";
import { API_URL } from "@utils/constants";
import {
  snapshotHistoryPath,
  snapshotProgressPath,
  snapshotProgressStreamPath,
  type PagedSnapshotHistoryResponse,
  type SnapshotHistoryResponse,
  type SnapshotHistoryTable,
  type SnapshotOutcome,
  type SnapshotProgressResponse,
  type SnapshotTable,
  type SnapshotTableChunkProgress,
  type SnapshotType,
} from "./snapshotModel";

export type SnapshotClientResponse<T> = {
  data?: T;
  error?: string;
};

type RawChunkProgress = {
  chunkNumber?: number | null;
  chunkIndex?: number | null;
  totalChunks?: number | null;
  percentage?: number | null;
};

type RawSnapshotTable = {
  name?: string;
  status?: SnapshotTable["status"];
  progress?: RawChunkProgress | null;
  rowsScanned?: number | null;
  skipReason?: string | null;
};

type RawSnapshotProgress = {
  type?: SnapshotProgressResponse["type"];
  status?: SnapshotProgressResponse["status"];
  globalProgress?: SnapshotProgressResponse["globalProgress"];
  tables?: RawSnapshotTable[] | null;
  startedAt?: string | null;
  lastUpdatedAt?: string | null;
  elapsedSeconds?: number | null;
  totalRowsScanned?: number | null;
};

const normalizeChunk = (
  progress: RawChunkProgress | null | undefined
): SnapshotTableChunkProgress | null => {
  if (!progress) {
    return null;
  }

  const chunkIndex = progress.chunkNumber ?? progress.chunkIndex;

  return {
    ...(chunkIndex != null ? { chunkIndex } : {}),
    ...(progress.totalChunks != null ? { totalChunks: progress.totalChunks } : {}),
    percentage: progress.percentage ?? null,
  };
};

/** Maps the conductor progress payload onto the view model. */
export const normalizeSnapshotProgress = (
  raw: RawSnapshotProgress
): SnapshotProgressResponse => ({
  type: raw.type ?? null,
  status: raw.status ?? "UNKNOWN",
  globalProgress: raw.globalProgress ?? null,
  tables: (raw.tables ?? []).map((table) => ({
    name: table.name ?? "",
    status: table.status ?? "PENDING",
    progress: normalizeChunk(table.progress),
    rowsScanned: table.rowsScanned ?? null,
    skipReason: table.skipReason ?? null,
  })),
  startedAt: raw.startedAt ?? null,
  lastUpdatedAt: raw.lastUpdatedAt ?? null,
  elapsedSeconds: raw.elapsedSeconds ?? null,
  totalRowsScanned: raw.totalRowsScanned ?? null,
});

export const getSnapshotProgress = async (
  pipelineId: string
): Promise<SnapshotClientResponse<SnapshotProgressResponse>> => {
  const response = await fetchResult<RawSnapshotProgress>(
    `${API_URL}${snapshotProgressPath(pipelineId)}`
  );

  if (response.error || response.data == null) {
    return { error: response.error ?? "An error occurred while fetching data" };
  }

  return { data: normalizeSnapshotProgress(response.data) };
};

const SNAPSHOT_OUTCOMES = new Set<SnapshotOutcome>([
  "COMPLETED",
  "ABORTED",
  "SKIPPED",
  "UNKNOWN",
]);

type RawHistoryTable = {
  tableName?: string;
  outcome?: string | null;
  rowsScanned?: number | null;
  skipReason?: string | null;
  durationSeconds?: number | null;
};

type RawSnapshotHistory = {
  id?: number;
  pipelineId?: number;
  pipelineName?: string | null;
  type?: SnapshotType;
  outcome?: string | null;
  totalTables?: number;
  completedTables?: number;
  totalRowsScanned?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  durationSeconds?: number | null;
  tables?: RawHistoryTable[] | null;
};

type RawPagedSnapshotHistory = {
  items?: RawSnapshotHistory[] | null;
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
};

const asSnapshotOutcome = (outcome: string | null | undefined): SnapshotOutcome =>
  outcome && SNAPSHOT_OUTCOMES.has(outcome as SnapshotOutcome)
    ? (outcome as SnapshotOutcome)
    : "UNKNOWN";

const normalizeHistoryTable = (table: RawHistoryTable): SnapshotHistoryTable => ({
  tableName: table.tableName ?? "",
  outcome: table.outcome ?? "",
  rowsScanned: table.rowsScanned ?? null,
  skipReason: table.skipReason ?? null,
  durationSeconds: table.durationSeconds ?? null,
});

/** Maps a conductor history run. List rows omit tables; the detail endpoint includes them. */
export const normalizeSnapshotHistory = (
  raw: RawSnapshotHistory
): SnapshotHistoryResponse => ({
  id: raw.id ?? 0,
  pipelineId: raw.pipelineId ?? 0,
  ...(raw.pipelineName ? { pipelineName: raw.pipelineName } : {}),
  type: raw.type ?? "INITIAL",
  outcome: asSnapshotOutcome(raw.outcome),
  totalTables: raw.totalTables ?? 0,
  completedTables: raw.completedTables ?? 0,
  totalRowsScanned: raw.totalRowsScanned ?? null,
  startedAt: raw.startedAt ?? "",
  completedAt: raw.completedAt ?? "",
  durationSeconds: raw.durationSeconds ?? 0,
  ...(raw.tables ? { tables: raw.tables.map(normalizeHistoryTable) } : {}),
});

export const getSnapshotHistory = async (
  pipelineId: string,
  page: number,
  size: number
): Promise<SnapshotClientResponse<PagedSnapshotHistoryResponse>> => {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  const response = await fetchResult<RawPagedSnapshotHistory>(
    `${API_URL}${snapshotHistoryPath(pipelineId)}?${params.toString()}`
  );

  if (response.error || response.data == null) {
    return { error: response.error ?? "An error occurred while fetching data" };
  }

  const data = response.data;
  return {
    data: {
      items: (data.items ?? []).map(normalizeSnapshotHistory),
      page: data.page ?? page,
      size: data.size ?? size,
      totalElements: data.totalElements ?? 0,
      totalPages: data.totalPages ?? 0,
    },
  };
};

export const getSnapshotHistoryDetail = async (
  pipelineId: string,
  historyId: number
): Promise<SnapshotClientResponse<SnapshotHistoryResponse>> => {
  const response = await fetchResult<RawSnapshotHistory>(
    `${API_URL}${snapshotHistoryPath(pipelineId)}/${historyId}`
  );

  if (response.error || response.data == null) {
    return { error: response.error ?? "An error occurred while fetching data" };
  }

  return { data: normalizeSnapshotHistory(response.data) };
};

const SNAPSHOT_PROGRESS_EVENT = "snapshot-progress";

/**
 * Each named `snapshot-progress` event is a full aggregate. The conductor sends
 * the current state as the first event, then replaces it on every later update.
 */
export const subscribeSnapshotProgress = (
  pipelineId: string,
  onProgress: (progress: SnapshotProgressResponse) => void
): (() => void) => {
  const source = new EventSource(
    `${API_URL}${snapshotProgressStreamPath(pipelineId)}`
  );

  const onEvent = (event: Event) => {
    const data = (event as MessageEvent<string>).data;
    if (typeof data !== "string" || data.length === 0) {
      return;
    }

    try {
      onProgress(normalizeSnapshotProgress(JSON.parse(data) as RawSnapshotProgress));
    } catch {
      // A later full-state event replaces a malformed one.
    }
  };

  source.addEventListener(SNAPSHOT_PROGRESS_EVENT, onEvent);

  return () => {
    source.removeEventListener(SNAPSHOT_PROGRESS_EVENT, onEvent);
    source.close();
  };
};
