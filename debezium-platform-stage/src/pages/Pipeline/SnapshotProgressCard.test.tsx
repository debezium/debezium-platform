import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../__test__/unit/test-utils";
import SnapshotProgressCard from "./SnapshotProgressCard";
import type { SnapshotProgressResponse } from "./snapshotModel";

const runningProgress: SnapshotProgressResponse = {
  type: "INITIAL",
  status: "RUNNING",
  globalProgress: { totalTables: 12, completedTables: 7, percentage: 58.3 },
  tables: [],
  startedAt: new Date().toISOString(),
  elapsedSeconds: 332,
  totalRowsScanned: 245000,
};

const pausedProgress: SnapshotProgressResponse = {
  type: "INCREMENTAL",
  status: "PAUSED",
  globalProgress: { totalTables: 10, completedTables: 3, percentage: 30 },
  tables: [],
  startedAt: "2026-08-05T10:00:00Z",
  elapsedSeconds: 135,
  totalRowsScanned: 1000,
};

describe("SnapshotProgressCard", () => {
  it("shows the running snapshot summary and opens details", async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();

    render(
      <SnapshotProgressCard progress={runningProgress} onViewDetails={onViewDetails} />
    );

    expect(screen.getByText("Snapshot in progress")).toBeInTheDocument();
    expect(screen.getByText("Initial snapshot")).toBeInTheDocument();
    expect(screen.getByText("(7/12 tables)")).toBeInTheDocument();
    expect(screen.getByText("58.3%")).toBeInTheDocument();
    expect(screen.getByText(/Running for/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View details" }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it("shows a static paused summary", () => {
    render(
      <SnapshotProgressCard progress={pausedProgress} onViewDetails={vi.fn()} />
    );

    expect(screen.getByText("Snapshot paused")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Incremental snapshot")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("(3/10 tables)")).toBeInTheDocument();
    expect(screen.getByText("Paused after 2m 15s")).toBeInTheDocument();
  });

  it("uses an indeterminate bar when the table total is not known yet", () => {
    render(
      <SnapshotProgressCard
        progress={{
          ...runningProgress,
          globalProgress: { totalTables: 0, completedTables: 0, percentage: null },
        }}
        onViewDetails={vi.fn()}
      />
    );

    expect(
      screen.getByRole("progressbar", {
        name: "Snapshot progress is still being calculated",
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/\(\d+\/\d+ tables\)/)).not.toBeInTheDocument();
  });
});
