import type { ApiResponse } from "./apis";
import type { PanelQueryResponse } from "./types";

/**
 * Mock panel queries for local UI development without a metrics backend.
 * Set to true to enable mock data for all panels.
 */
export const USE_MOCK_PANEL_QUERY = false;

/**
 * Panels that are not yet backed by live metrics — served from mock data instead.
 * Add panel IDs to this set to always use mock data for specific panels.
 */
export const MOCK_ONLY_PANEL_IDS = new Set<string>([]);

/**
 * Fetches mock panel data for development/testing purposes.
 * Dynamically imports the mock data generator and returns formatted data.
 * 
 * @param panelId - The unique identifier for the panel
 * @param pipelineName - The name of the pipeline
 * @param start - Start time for the data range
 * @param end - End time for the data range
 * @param step - Optional step interval for data points
 * @returns Promise resolving to ApiResponse with mock panel data or error
 */
export const fetchMockPanelData = async (
  panelId: string,
  pipelineName: string,
  start: string,
  end: string,
  step?: string
): Promise<ApiResponse<PanelQueryResponse>> => {
  const { getMockPanelData } = await import("./monitoringMockData");
  const data = getMockPanelData(panelId, pipelineName, start, end, step);

  if (!data) {
    return { error: `No mock data available for panel ${panelId}` };
  }

  return { data };
};

/**
 * Determines if a panel should use mock data based on global settings
 * or panel-specific configuration.
 * 
 * @param panelId - The unique identifier for the panel
 * @returns true if mock data should be used, false otherwise
 */
export const shouldUseMockData = (panelId: string): boolean => {
  return USE_MOCK_PANEL_QUERY || MOCK_ONLY_PANEL_IDS.has(panelId);
};
