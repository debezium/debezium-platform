import type { ComponentProps } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../__test__/unit/test-utils";
import PipelineSnapshots from "./PipelineSnapshots";
import type {
  PagedSnapshotHistoryResponse,
  SnapshotHistoryResponse,
  SnapshotProgressResponse,
} from "../../apis/snapshots";

const { getSnapshotHistory, getSnapshotHistoryDetail } = vi.hoisted(() => ({
  getSnapshotHistory: vi.fn(),
  getSnapshotHistoryDetail: vi.fn(),
}));

vi.mock("../../apis/snapshots", () => ({
  getSnapshotHistory,
  getSnapshotHistoryDetail,
}));

const runningProgress: SnapshotProgressResponse = {
  type: "INITIAL",
  status: "RUNNING",
  globalProgress: { totalTables: 12, completedTables: 7, percentage: 58.3 },
  tables: [
    {
      name: "inventory.categories",
      status: "PENDING",
      progress: null,
      rowsScanned: null,
      skipReason: null,
    },
    {
      name: "inventory.orders",
      status: "IN_PROGRESS",
      progress: null,
      rowsScanned: 28400,
      skipReason: null,
    },
    {
      name: "inventory.temp_data",
      status: "SKIPPED",
      progress: null,
      rowsScanned: null,
      skipReason: "No primary key",
    },
    {
      name: "inventory.products",
      status: "COMPLETED",
      progress: null,
      rowsScanned: 12000,
      skipReason: null,
    },
  ],
  startedAt: "2026-08-05T10:00:12Z",
  elapsedSeconds: 332,
  totalRowsScanned: 245000,
};

const idleProgress: SnapshotProgressResponse = {
  type: null,
  status: "IDLE",
  globalProgress: null,
  tables: [],
};

const historyPage: PagedSnapshotHistoryResponse = {
  items: [
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
      tables: [],
    },
  ],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

const historyDetail: SnapshotHistoryResponse = {
  ...historyPage.items[0],
  tables: [
    {
      tableName: "inventory.products",
      outcome: "COMPLETED",
      rowsScanned: 12000,
      skipReason: null,
      durationSeconds: 15,
    },
  ],
};

const renderSnapshots = (
  overrides: Partial<ComponentProps<typeof PipelineSnapshots>> = {}
) =>
  render(
    <PipelineSnapshots
      pipelineId="7"
      activeTabKey="snapshots"
      progress={idleProgress}
      isProgressLoading={false}
      progressError={null}
      onRetryProgress={vi.fn()}
      {...overrides}
    />
  );

describe("PipelineSnapshots", () => {
  beforeEach(() => {
    getSnapshotHistory.mockReset();
    getSnapshotHistoryDetail.mockReset();
    getSnapshotHistory.mockResolvedValue({ data: historyPage });
    getSnapshotHistoryDetail.mockResolvedValue({ data: historyDetail });
  });

  it("shows the live table list while a snapshot is running", () => {
    renderSnapshots({ progress: runningProgress });

    expect(screen.getByRole("tab", { name: "Snapshot progress", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Snapshot history" })).toBeInTheDocument();
    expect(screen.getByText("Initial snapshot")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Snapshot progress" })).toHaveAttribute(
      "aria-valuetext",
      "58.3%"
    );
    expect(screen.getByText(/Tables: 7 of 12 completed/)).toBeInTheDocument();
    expect(screen.getByText(/Total rows scanned: 245,000/)).toBeInTheDocument();
    expect(screen.getByText("No primary key")).toBeInTheDocument();
    expect(screen.getByText("28,400 rows")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();

    const rowText = screen.getAllByRole("row").map((row) => row.textContent ?? "").join("\n");
    expect(rowText.indexOf("inventory.products")).toBeLessThan(rowText.indexOf("inventory.orders"));
    expect(rowText.indexOf("inventory.orders")).toBeLessThan(
      rowText.indexOf("inventory.categories")
    );
    expect(getSnapshotHistory).not.toHaveBeenCalled();
  });

  it("opens snapshot history while a snapshot is still running", async () => {
    const user = userEvent.setup();

    renderSnapshots({ progress: runningProgress });

    await user.click(screen.getByRole("tab", { name: "Snapshot history" }));

    expect(await screen.findByText("Initial")).toBeInTheDocument();
    expect(screen.queryByText("Initial snapshot")).not.toBeInTheDocument();
    expect(getSnapshotHistory).toHaveBeenCalledWith("7", { page: 0, size: 20 });
  });

  it("lists history and expands a run into its tables", async () => {
    const user = userEvent.setup();

    renderSnapshots();

    expect(screen.getByRole("tab", { name: "Snapshot history", selected: true })).toBeInTheDocument();
    expect(screen.queryByText("No active snapshot")).not.toBeInTheDocument();

    expect(await screen.findByText("Initial")).toBeInTheDocument();
    expect(screen.getByText("12/12")).toBeInTheDocument();
    expect(screen.getByText("12m 34s")).toBeInTheDocument();
    expect(screen.getByText("1,245,000")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Details" }));

    expect(await screen.findByText("inventory.products")).toBeInTheDocument();
    expect(screen.getByText("0m 15s")).toBeInTheDocument();
  });

  it("shows an empty history list when the pipeline has no completed runs", async () => {
    getSnapshotHistory.mockResolvedValue({
      data: { ...historyPage, items: [], totalElements: 0, totalPages: 0 },
    });

    renderSnapshots();

    expect(await screen.findByRole("heading", { name: "No completed snapshots yet." })).toBeInTheDocument();
    expect(screen.getByText("Completed snapshot runs will appear here.")).toBeInTheDocument();
  });

  it("shows an empty state that can clear filters when nothing matches", async () => {
    const user = userEvent.setup();
    getSnapshotHistory.mockImplementation(async (_pipelineId: string, query?: { type?: string }) => {
      if (query?.type) {
        return {
          data: { ...historyPage, items: [], totalElements: 0, totalPages: 0 },
        };
      }
      return { data: historyPage };
    });

    renderSnapshots();

    expect(await screen.findByText("Initial")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filter by type" }));
    await user.click(await screen.findByRole("option", { name: "Incremental snapshot" }));

    const emptyHeading = await screen.findByRole("heading", {
      name: "No snapshots match these filters.",
    });
    const emptyState = emptyHeading.closest(".pf-v6-c-empty-state");
    expect(emptyState).not.toBeNull();

    await user.click(
      within(emptyState as HTMLElement).getByRole("button", { name: "Clear all filters" })
    );

    await waitFor(() => {
      expect(getSnapshotHistory).toHaveBeenCalledWith("7", { page: 0, size: 20 });
    });
    expect(await screen.findByText("Initial")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No snapshots match these filters." })).not.toBeInTheDocument();
  });

  it("shows a retry state when progress cannot be loaded", async () => {
    const user = userEvent.setup();
    const onRetryProgress = vi.fn();

    renderSnapshots({
      progress: null,
      progressError: "Failed to fetch data: Not Found",
      onRetryProgress,
    });

    expect(screen.getByRole("heading", { name: "Failed to load" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Snapshot history" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryProgress).toHaveBeenCalledTimes(1);
  });

  it("does not request history until the snapshots tab is open", async () => {
    renderSnapshots({ activeTabKey: "overview" });

    await waitFor(() => {
      expect(getSnapshotHistory).not.toHaveBeenCalled();
    });
  });

  it("filters history by type and outcome and keeps pagination visible", async () => {
    const user = userEvent.setup();

    renderSnapshots();

    expect(await screen.findByText("Initial")).toBeInTheDocument();
    expect(getSnapshotHistory).toHaveBeenCalledWith("7", { page: 0, size: 20 });
    expect(screen.getAllByLabelText("Pagination").length).toBeGreaterThan(0);

    expect(screen.getByRole("button", { name: "Filter by type" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filter by outcome" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filter by type" }));
    await user.click(await screen.findByRole("option", { name: "Incremental snapshot" }));

    await waitFor(() => {
      expect(getSnapshotHistory).toHaveBeenCalledWith(
        "7",
        expect.objectContaining({ page: 0, size: 20, type: "INCREMENTAL" })
      );
    });

    await user.click(screen.getByRole("button", { name: "Type" }));
    await user.click(await screen.findByRole("option", { name: "Outcome" }));
    await user.click(screen.getByRole("button", { name: "Filter by outcome" }));
    await user.click(await screen.findByRole("option", { name: "Aborted" }));

    await waitFor(() => {
      expect(getSnapshotHistory).toHaveBeenCalledWith(
        "7",
        expect.objectContaining({
          page: 0,
          size: 20,
          type: "INCREMENTAL",
          outcome: "ABORTED",
        })
      );
    });

    await user.click(screen.getByRole("button", { name: "All time" }));
    await user.click(await screen.findByRole("option", { name: "Last 24 hours" }));

    await waitFor(() => {
      expect(getSnapshotHistory).toHaveBeenCalledWith(
        "7",
        expect.objectContaining({
          type: "INCREMENTAL",
          outcome: "ABORTED",
          from: expect.stringMatching(/^\d{4}-/),
          to: expect.stringMatching(/^\d{4}-/),
        })
      );
    });
  });
});
