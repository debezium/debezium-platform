/**
 * Snapshot reads go through this module.
 * It returns mock payloads until the conductor `/snapshots` APIs exist.
 */
export {
  getSnapshotHistory,
  getSnapshotHistoryDetail,
  getSnapshotProgress,
  subscribeSnapshotProgress,
} from "./snapshotMock";

export type { SnapshotMockResponse as SnapshotClientResponse } from "./snapshotMock";
