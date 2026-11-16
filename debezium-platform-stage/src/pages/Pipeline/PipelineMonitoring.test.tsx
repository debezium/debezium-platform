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

vi.mock("../../apis/monitoring", () => ({
  fetchMonitoringPanels,
  fetchPanelData,
}));

describe("PipelineMonitoring refresh", () => {
  beforeEach(() => {
    fetchMonitoringPanels.mockReset();
    fetchPanelData.mockReset();

    fetchMonitoringPanels.mockResolvedValue({ panels: initialPanels });
    fetchPanelData.mockResolvedValue({
      panelId: "source-lag",
      pipelineId: "test-pipeline",
      timeRange: { start: "2026-01-01T00:00:00Z", end: "2026-01-01T01:00:00Z", step: "15s" },
      series: [],
      metadata: { queryDurationMs: 1 },
    });
  });

  it("reloads the panels list and renders newly added panels on manual refresh", async () => {
    const user = userEvent.setup();

    render(<PipelineMonitoring pipelineName="test-pipeline" activeTabKey="monitoring" />);

    expect(await screen.findByText("Streaming Metrics")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /refresh monitoring data/i })).toBeInTheDocument();
    expect(await screen.findByText("source-lag title")).toBeInTheDocument();
    expect(screen.queryByText("my-new-panel title")).not.toBeInTheDocument();

    fetchMonitoringPanels.mockResolvedValueOnce({ panels: updatedPanels });

    await user.click(screen.getByRole("button", { name: /refresh monitoring data/i }));

    await waitFor(() => {
      expect(fetchMonitoringPanels).toHaveBeenLastCalledWith({ bustCache: true });
    });

    expect(await screen.findByText("my-new-panel title")).toBeInTheDocument();
  });

  it("keeps the other panels rendered when one panel's query fails", async () => {
    // Panels are fetched concurrently. A rejection that is not caught per panel
    // would reject the whole batch and blank the dashboard, so this asserts the
    // failure stays contained to the panel that caused it.
    fetchPanelData.mockImplementation((panelId: string) =>
      panelId === "source-lag"
        ? Promise.reject(new Error("panel query failed"))
        : Promise.resolve({
            panelId,
            pipelineId: "test-pipeline",
            timeRange: {
              start: "2026-01-01T00:00:00Z",
              end: "2026-01-01T01:00:00Z",
              step: "15s",
            },
            series: [],
            metadata: { queryDurationMs: 1 },
          })
    );

    render(<PipelineMonitoring pipelineName="test-pipeline" activeTabKey="monitoring" />);

    // Wait for the failing panel to settle into its error state, then assert the
    // rest of the dashboard is still standing.
    expect(await screen.findByText("panel query failed")).toBeInTheDocument();
    expect(screen.getByText("source-lag title")).toBeInTheDocument();
    expect(screen.getByText("streaming-event-count title")).toBeInTheDocument();
    expect(screen.getByText("Streaming Metrics")).toBeInTheDocument();
  });

  it("survives every panel query failing", async () => {
    fetchPanelData.mockRejectedValue(new Error("monitoring backend down"));

    render(<PipelineMonitoring pipelineName="test-pipeline" activeTabKey="monitoring" />);

    // The panel list itself loaded, so every card renders its own error rather
    // than the whole batch rejecting and taking the dashboard down.
    await waitFor(() =>
      expect(screen.getAllByText("monitoring backend down").length).toBeGreaterThan(0)
    );
    expect(screen.getByText("source-lag title")).toBeInTheDocument();
    expect(screen.getByText("streaming-event-count title")).toBeInTheDocument();
  });

  it("reports an error when the panel list itself cannot be loaded", async () => {
    fetchMonitoringPanels.mockRejectedValue(new Error("requires monitoring:read"));

    render(<PipelineMonitoring pipelineName="test-pipeline" activeTabKey="monitoring" />);

    expect(await screen.findByText(/requires monitoring:read/)).toBeInTheDocument();
  });
});
