import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getSnapshotProgress, subscribeSnapshotProgress } from "./snapshotClient";
import {
  isSnapshotActive,
  type SnapshotProgressResponse,
  type SnapshotState,
} from "./snapshotModel";

export type SnapshotProgressQuery = {
  progress: SnapshotProgressResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Loads the current snapshot aggregate, then replaces it with each later update.
 * A slower first read is ignored once a live update has arrived.
 * Data comes from the mock client until the snapshot APIs exist.
 */
export const useSnapshotProgress = (
  pipelineId: string | undefined
): SnapshotProgressQuery => {
  const [progress, setProgress] = useState<SnapshotProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const requestKey = pipelineId == null ? null : `${pipelineId}:${reloadToken}`;

  useEffect(() => {
    if (!pipelineId || requestKey == null) {
      return;
    }

    let cancelled = false;
    let sawStreamEvent = false;
    const key = requestKey;

    const apply = (next: SnapshotProgressResponse) => {
      if (cancelled) {
        return;
      }
      setProgress(next);
      setError(null);
      setResolvedKey(key);
    };

    void getSnapshotProgress(pipelineId).then((response) => {
      if (cancelled || sawStreamEvent) {
        return;
      }
      if (response.error || !response.data) {
        setError(response.error ?? "An error occurred while fetching data");
        setResolvedKey(key);
        return;
      }
      apply(response.data);
    });

    const unsubscribe = subscribeSnapshotProgress(pipelineId, (next) => {
      sawStreamEvent = true;
      apply(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [pipelineId, requestKey]);

  if (
    pipelineId == null &&
    (progress !== null || error !== null || resolvedKey !== null)
  ) {
    setProgress(null);
    setError(null);
    setResolvedKey(null);
  }

  if (!pipelineId) {
    return { progress: null, isLoading: false, error: null, refresh };
  }

  const isCurrent = resolvedKey === requestKey;
  return {
    progress,
    isLoading: !isCurrent,
    error: isCurrent ? error : null,
    refresh,
  };
};

const SnapshotProgressContext = createContext<SnapshotProgressQuery | null>(null);

export const SnapshotProgressProvider = ({
  pipelineId,
  children,
}: {
  pipelineId: string | undefined;
  children: ReactNode;
}) => {
  const value = useSnapshotProgress(pipelineId);
  return createElement(SnapshotProgressContext.Provider, { value }, children);
};

export const useSnapshotProgressState = (): SnapshotProgressQuery => {
  const value = useContext(SnapshotProgressContext);
  if (!value) {
    throw new Error("Snapshot progress is unavailable outside its provider.");
  }
  return value;
};

export const useOptionalSnapshotProgress = (): SnapshotProgressQuery | null =>
  useContext(SnapshotProgressContext);

export const useSnapshotElapsed = (
  progress: Pick<SnapshotProgressResponse, "status" | "startedAt" | "elapsedSeconds"> | null
): number | null => {
  const status: SnapshotState | undefined = progress?.status;
  const isRunning = status === "RUNNING";
  const startedAt = progress?.startedAt ?? null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning || !startedAt) {
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isRunning, startedAt]);

  if (!progress || !isSnapshotActive(status)) {
    return null;
  }

  if (isRunning && startedAt) {
    const parsed = Date.parse(startedAt);
    if (!Number.isNaN(parsed)) {
      return Math.max(0, Math.floor((now - parsed) / 1000));
    }
  }

  return progress.elapsedSeconds ?? null;
};
