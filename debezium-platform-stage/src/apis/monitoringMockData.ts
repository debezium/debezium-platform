import mockData from "../__fixtures__/monitoringMockData.json";
import type { PanelQueryResponse } from "./types";

export type MonitoringMockDataMap = Record<string, PanelQueryResponse>;

export const monitoringMockData = mockData as unknown as MonitoringMockDataMap;

export const getMockPanelData = (
  panelId: string,
  pipelineName: string,
  start: string,
  end: string,
  step?: string
): PanelQueryResponse | null => {
  const entry = monitoringMockData[panelId];
  if (!entry) {
    return null;
  }

  return {
    ...entry,
    pipelineId: pipelineName,
    timeRange: {
      start,
      end,
      step: step ?? entry.timeRange.step,
    },
  };
};
