import { API_URL } from "../utils/constants";

/**
 * Absolute conductor URLs. Call sites use these instead of writing `/api/...`.
 * Permission tags and `/api/me` land here when IAM arrives.
 */
const apiUrl = (path: string): string => `${API_URL}${path}`;

/** Call sites sometimes interpolate an id before it is known. The URL text matches the old templates. */
type PathId = string | number | null | undefined;

export const catalogPath = (): string => apiUrl("/api/catalog");

export const catalogDescriptorPath = (descriptor: PathId): string =>
  apiUrl(`/api/catalog/${descriptor}`);

export const sourcesPath = (): string => apiUrl("/api/sources");

export const sourcePath = (id: PathId): string => apiUrl(`/api/sources/${id}`);

export const sourceSignalsVerifyPath = (): string => apiUrl("/api/sources/signals/verify");

export const destinationsPath = (): string => apiUrl("/api/destinations");

export const destinationPath = (id: PathId): string => apiUrl(`/api/destinations/${id}`);

export const transformsPath = (): string => apiUrl("/api/transforms");

export const transformPath = (id: PathId): string => apiUrl(`/api/transforms/${id}`);

export const connectionsPath = (): string => apiUrl("/api/connections");

export const connectionPath = (id: PathId): string => apiUrl(`/api/connections/${id}`);

export const connectionSchemasPath = (): string => apiUrl("/api/connections/schemas");

export const connectionValidatePath = (): string => apiUrl("/api/connections/validate");

export const connectionCollectionsPath = (id: PathId): string =>
  apiUrl(`/api/connections/${id}/collections`);

export const pipelinesPath = (): string => apiUrl("/api/pipelines");

export const pipelinePath = (id: PathId): string => apiUrl(`/api/pipelines/${id}`);

export const pipelineLogsPath = (id: PathId): string => apiUrl(`/api/pipelines/${id}/logs`);

export const toWebSocketUrl = (httpUrl: string): string => httpUrl.replace(/^http/, "ws");

/** WebSocket URL for live pipeline logs, until the conductor exposes an SSE endpoint. */
export const pipelineLogsStreamUrl = (id: PathId): string =>
  `${toWebSocketUrl(API_URL)}/api/pipelines/${id}/logs/stream`;

export const pipelineSignalsPath = (id: PathId): string =>
  apiUrl(`/api/pipelines/${id}/signals`);

export const snapshotProgressPath = (pipelineId: string): string =>
  apiUrl(`/api/pipelines/${pipelineId}/snapshots/progress`);

export const snapshotProgressStreamPath = (pipelineId: string): string =>
  `${snapshotProgressPath(pipelineId)}/stream`;

export const snapshotHistoryPath = (pipelineId: string, query?: string): string => {
  const path = apiUrl(`/api/pipelines/${pipelineId}/snapshots/history`);
  return query ? `${path}?${query}` : path;
};

export const snapshotHistoryDetailPath = (
  pipelineId: string,
  historyId: number
): string => apiUrl(`/api/pipelines/${pipelineId}/snapshots/history/${historyId}`);

export const alertEventsPath = (query: string): string =>
  apiUrl(`/api/alerts/events?${query}`);

export const alertStatusPath = (): string => apiUrl("/api/alerts/status");

export const alertRulesPath = (): string => apiUrl("/api/alerts/rules");

export const alertRulePath = (id: number): string => apiUrl(`/api/alerts/rules/${id}`);

export const alertRuleActionPath = (id: number, action: "enable" | "disable"): string =>
  apiUrl(`/api/alerts/rules/${id}/${action}`);

export const alertChannelsPath = (): string => apiUrl("/api/alerts/channels");

export const alertChannelPath = (id: number): string => apiUrl(`/api/alerts/channels/${id}`);

export const alertChannelTestPath = (id: number): string =>
  apiUrl(`/api/alerts/channels/${id}/test`);

export const monitoringPanelsPath = (): string => apiUrl("/api/monitoring/panels");

export const monitoringPanelQueryPath = (panelId: string, query: string): string =>
  apiUrl(`/api/monitoring/panels/${panelId}/query?${query}`);

/** Singular resource name as used by the server-config flow: `source` → `/api/sources`. */
export const resourceCollectionPath = (resource: string): string =>
  apiUrl(`/api/${resource}s`);
