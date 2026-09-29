import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { render } from "../../__test__/unit/test-utils";
import { useSnapshotProgress } from "./useSnapshotProgress";
import type { SnapshotProgressResponse } from "./snapshotModel";

const { getSnapshotProgress, subscribeSnapshotProgress } = vi.hoisted(() => ({
  getSnapshotProgress: vi.fn(),
  subscribeSnapshotProgress: vi.fn(),
}));

vi.mock("./snapshotClient", () => ({
  getSnapshotProgress,
  subscribeSnapshotProgress,
}));

const idleProgress: SnapshotProgressResponse = {
  type: null,
  status: "IDLE",
  globalProgress: null,
  tables: [],
};

const runningProgress: SnapshotProgressResponse = {
  type: "INITIAL",
  status: "RUNNING",
  globalProgress: { totalTables: 12, completedTables: 7, percentage: 58.3 },
  tables: [],
  elapsedSeconds: 10,
};

const Probe = ({ pipelineId }: { pipelineId?: string }) => {
  const { progress, isLoading, error } = useSnapshotProgress(pipelineId);
  return (
    <div>
      <span>{progress?.status ?? "empty"}</span>
      <span>{isLoading ? "loading" : "ready"}</span>
      <span>{error ?? ""}</span>
    </div>
  );
};

describe("useSnapshotProgress", () => {
  const unsubscribe = vi.fn();
  let emit: (progress: SnapshotProgressResponse) => void = () => undefined;

  beforeEach(() => {
    unsubscribe.mockReset();
    getSnapshotProgress.mockReset();
    subscribeSnapshotProgress.mockReset();
    emit = () => undefined;
    subscribeSnapshotProgress.mockImplementation(
      (_pipelineId: string, onProgress: (progress: SnapshotProgressResponse) => void) => {
        emit = onProgress;
        return unsubscribe;
      }
    );
  });

  it("replaces state from live updates and ignores a slower first read", async () => {
    let resolveFetch: (value: { data: SnapshotProgressResponse }) => void = () => undefined;
    getSnapshotProgress.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    render(<Probe pipelineId="7" />);

    await waitFor(() => expect(subscribeSnapshotProgress).toHaveBeenCalledWith("7", expect.any(Function)));
    act(() => {
      emit(runningProgress);
    });
    expect(await screen.findByText("RUNNING")).toBeInTheDocument();

    await act(async () => {
      resolveFetch({ data: idleProgress });
    });
    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
    expect(screen.queryByText("IDLE")).not.toBeInTheDocument();
  });

  it("paints the first read when no live update has arrived", async () => {
    getSnapshotProgress.mockResolvedValue({ data: idleProgress });

    render(<Probe pipelineId="7" />);

    expect(await screen.findByText("IDLE")).toBeInTheDocument();
    expect(screen.getByText("ready")).toBeInTheDocument();
  });

  it("does not subscribe when no pipeline is selected", async () => {
    render(<Probe />);

    expect(await screen.findByText("empty")).toBeInTheDocument();
    expect(getSnapshotProgress).not.toHaveBeenCalled();
    expect(subscribeSnapshotProgress).not.toHaveBeenCalled();
  });
});
