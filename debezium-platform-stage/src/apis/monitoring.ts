import { request } from "./client";
import { monitoringPanelQueryPath, monitoringPanelsPath } from "./endpoints";
import type { PanelQueryResponse, PanelsListResponse } from "./types";

/**
 * Throws {@link ApiRequestError} like every other client call, so a `monitoring:read`
 * denial arrives with its status rather than as a generic failure.
 *
 * Callers that fan out over several panels must catch per panel: one failing panel
 * should not blank the dashboard. See `fetchPanelData`.
 */
export const fetchMonitoringPanels = (options?: {
  bustCache?: boolean;
}): Promise<PanelsListResponse> => {
  let url = monitoringPanelsPath();
  if (options?.bustCache) {
    url += `?_${Date.now()}`;
  }

  return request<PanelsListResponse>(url, { cache: "no-store" });
};

/**
 * One panel's series.
 *
 * Panels are loaded concurrently, and each one fails independently — a single
 * unavailable metric must leave the other panels rendered. Callers therefore wrap
 * each call in its own catch rather than letting one rejection collapse the batch.
 */
export const fetchPanelData = (
  panelId: string,
  pipelineName: string,
  start: string,
  end: string,
  step?: string
): Promise<PanelQueryResponse> => {
  const params = new URLSearchParams({
    pipeline_id: pipelineName,
    start,
    end,
  });

  if (step) {
    params.append("step", step);
  }

  return request<PanelQueryResponse>(
    monitoringPanelQueryPath(panelId, params.toString())
  );
};
