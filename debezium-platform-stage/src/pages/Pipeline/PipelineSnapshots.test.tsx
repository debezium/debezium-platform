import type { ComponentProps } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../__test__/unit/test-utils";
import PipelineSnapshots from "./PipelineSnapshots";
import type {
  PagedSnapshotHistoryResponse,
  SnapshotHistoryResponse,
  SnapshotProgressResponse,
} from "./snapshotModel";

const { getSnapshotHistory, getSnapshotHistoryDetail } = vi.hoisted(() => ({
  getSnapshotHistory: vi.fn(),
  getSnapshotHistoryDetail: vi.fn(),
}));

vi.mock("./snapshotClient", () => ({
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

    expect(screen.getByText("Initial snapshot")).toBeInTheDocument();
    expect(screen.getByText("58.3%")).toBeInTheDocument();
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

  it("lists history and expands a run into its tables", async () => {
    const user = userEvent.setup();

    renderSnapshots();

    expect(await screen.findByText("No active snapshot")).toBeInTheDocument();
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

    expect(await screen.findByText("No completed snapshots yet.")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryProgress).toHaveBeenCalledTimes(1);
  });

  it("does not request history until the snapshots tab is open", async () => {
    renderSnapshots({ activeTabKey: "overview" });

    await waitFor(() => {
      expect(getSnapshotHistory).not.toHaveBeenCalled();
    });
  });
});
