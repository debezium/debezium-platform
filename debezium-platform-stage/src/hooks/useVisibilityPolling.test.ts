import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVisibilityPolling } from "./useVisibilityPolling";

describe("useVisibilityPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polls at the configured interval while visible", () => {
    const onPoll = vi.fn();

    renderHook(() => useVisibilityPolling(1000, onPoll, true));

    vi.advanceTimersByTime(3000);

    expect(onPoll).toHaveBeenCalledTimes(3);
  });

  it("does not poll when disabled", () => {
    const onPoll = vi.fn();

    renderHook(() => useVisibilityPolling(1000, onPoll, false));

    vi.advanceTimersByTime(3000);

    expect(onPoll).not.toHaveBeenCalled();
  });

  it("pauses polling when tab is hidden and refetches when visible", () => {
    const onPoll = vi.fn();

    renderHook(() => useVisibilityPolling(1000, onPoll, true));

    vi.advanceTimersByTime(1000);
    expect(onPoll).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    vi.advanceTimersByTime(3000);
    expect(onPoll).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(onPoll).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1000);
    expect(onPoll).toHaveBeenCalledTimes(3);
  });
});
