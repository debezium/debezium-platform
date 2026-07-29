import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  resetActivityTrackerForTests,
  setPollingStateForTests,
  subscribePollingState,
} from "../utils/activityTracker";
import { useAdaptivePollingInterval } from "./useAdaptivePollingInterval";
import { POLLING } from "../utils/pollingConfig";

describe("useAdaptivePollingInterval", () => {
  beforeEach(() => {
    resetActivityTrackerForTests();
  });

  afterEach(() => {
    resetActivityTrackerForTests();
    vi.restoreAllMocks();
  });

  it("returns active interval by default", () => {
    const { result } = renderHook(() => useAdaptivePollingInterval());
    expect(result.current).toBe(POLLING.active);
  });

  it("returns false when tab is hidden", () => {
    setPollingStateForTests({ isVisible: false });

    const { result } = renderHook(() => useAdaptivePollingInterval());
    expect(result.current).toBe(false);
  });

  it("returns idle interval when user is idle", () => {
    setPollingStateForTests({ isIdle: true });

    const { result } = renderHook(() => useAdaptivePollingInterval());
    expect(result.current).toBe(POLLING.idle);
  });

  it("returns slow interval for slow profile", () => {
    const { result } = renderHook(() => useAdaptivePollingInterval("slow"));
    expect(result.current).toBe(POLLING.slow);
  });

  it("updates subscribers when polling state changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePollingState(listener);

    act(() => {
      setPollingStateForTests({ isIdle: true });
      listener();
    });

    unsubscribe();
    expect(listener).toHaveBeenCalled();
  });
});
