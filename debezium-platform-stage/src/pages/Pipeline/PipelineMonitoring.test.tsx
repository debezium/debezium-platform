import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PanelResponse } from "../../apis/types";
import PipelineMonitoring from "./PipelineMonitoring";

const { fetchMonitoringPanels, fetchPanelData } = vi.hoisted(() => ({
  fetchMonitoringPanels: vi.fn(),
  fetchPanelData: vi.fn(),
}));

const makePanel = (
  id: string,
  category: "streaming" | "snapshot" = "streaming"
): PanelResponse => ({
  id,
  title: `${id} title`,
  description: `${id} description`,
  category,
  unit: "events/s",
  visualization: { type: "line", suggestedStep: "15s" },
});

const initialPanels = [makePanel("source-lag"), makePanel("streaming-event-count")];
const updatedPanels = [...initialPanels, makePanel("my-new-panel")];

vi.mock("../../apis/apis", () => ({
  fetchMonitoringPanels,
  fetchPanelData,
}));

describe("PipelineMonitoring refresh", () => {
  beforeEach(() => {
    fetchMonitoringPanels.mockReset();
    fetchPanelData.mockReset();

    fetchMonitoringPanels.mockResolvedValue({ data: { panels: initialPanels } });
    fetchPanelData.mockResolvedValue({
      data: {
        panelId: "source-lag",
        pipelineId: "test-pipeline",
        timeRange: { start: "2026-01-01T00:00:00Z", end: "2026-01-01T01:00:00Z", step: "15s" },
        series: [],
        metadata: { queryDurationMs: 1 },
      },
    });
  });

  it("reloads the panels list and renders newly added panels on manual refresh", async () => {
    const user = userEvent.setup();

    render(<PipelineMonitoring pipelineName="test-pipeline" activeTabKey="monitoring" />);

    expect(await screen.findByText("Streaming Metrics")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /refresh monitoring data/i })).toBeInTheDocument();
    expect(await screen.findByText("source-lag title")).toBeInTheDocument();
    expect(screen.queryByText("my-new-panel title")).not.toBeInTheDocument();

    fetchMonitoringPanels.mockResolvedValueOnce({ data: { panels: updatedPanels } });

    await user.click(screen.getByRole("button", { name: /refresh monitoring data/i }));

    await waitFor(() => {
      expect(fetchMonitoringPanels).toHaveBeenLastCalledWith({ bustCache: true });
    });

    expect(await screen.findByText("my-new-panel title")).toBeInTheDocument();
  });
});
