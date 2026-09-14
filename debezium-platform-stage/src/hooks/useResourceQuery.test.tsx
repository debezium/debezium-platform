import type { ReactNode } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { resetActivityTrackerForTests } from "../utils/activityTracker";
import { POLLING } from "../utils/pollingConfig";
import { useResourceQuery } from "./useResourceQuery";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { cacheTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useResourceQuery", () => {
  beforeEach(() => {
    resetActivityTrackerForTests();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetActivityTrackerForTests();
  });

  it("holds the spinner through the attempts, then reports the failure and stops polling", async () => {
    const queryFn = vi.fn().mockRejectedValue(new Error("network down"));

    const { result } = renderHook(
      () => useResourceQuery<string[]>("resource-failing", queryFn),
      { wrapper }
    );

    // A failed attempt is not reported while further attempts remain.
    await waitFor(() => expect(result.current.consecutiveFailures).toBe(1));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();

    for (let attempt = 2; attempt <= POLLING.maxFailures; attempt++) {
      await vi.advanceTimersByTimeAsync(POLLING.failureInterval);
      await waitFor(() =>
        expect(result.current.consecutiveFailures).toBe(attempt)
      );
    }

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe("network down");
    expect(result.current.hasPollingStopped).toBe(true);
    expect(queryFn).toHaveBeenCalledTimes(POLLING.maxFailures);

    // No further attempts once polling has given up.
    await vi.advanceTimersByTimeAsync(POLLING.active * 3);
    expect(queryFn).toHaveBeenCalledTimes(POLLING.maxFailures);
  });

  it("keeps showing data it already has while attempts run", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce(["cached"])
      .mockRejectedValue(new Error("network down"));

    const { result } = renderHook(
      () => useResourceQuery<string[]>("resource-with-data", queryFn),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toEqual(["cached"]));

    // The failing attempts must not replace the rendered data with a spinner.
    await vi.advanceTimersByTimeAsync(POLLING.active);
    await waitFor(() => expect(result.current.consecutiveFailures).toBe(1));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(["cached"]);
  });

  it("still forwards a consumer's own onSuccess and onError", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const queryFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(["ok"]);

    const { result } = renderHook(
      () =>
        useResourceQuery<string[]>("resource-callbacks", queryFn, {
          onSuccess,
          onError,
        }),
      { wrapper }
    );

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);

    await vi.advanceTimersByTimeAsync(POLLING.failureInterval);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenCalledWith(["ok"]);
    expect(result.current.data).toEqual(["ok"]);
  });

  it("reports no loading state for a disabled query", async () => {
    const queryFn = vi.fn();

    const { result } = renderHook(
      () =>
        useResourceQuery<string[]>("resource-disabled", queryFn, {
          enabled: false,
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("restores the attempt budget and resumes polling on retry", async () => {
    const queryFn = vi.fn().mockRejectedValue(new Error("network down"));

    const { result } = renderHook(
      () => useResourceQuery<string[]>("resource-retry", queryFn),
      { wrapper }
    );

    await waitFor(() => expect(result.current.consecutiveFailures).toBe(1));
    for (let attempt = 2; attempt <= POLLING.maxFailures; attempt++) {
      await vi.advanceTimersByTimeAsync(POLLING.failureInterval);
      await waitFor(() =>
        expect(result.current.consecutiveFailures).toBe(attempt)
      );
    }
    expect(result.current.hasPollingStopped).toBe(true);

    queryFn.mockResolvedValue(["back"]);
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.data).toEqual(["back"]));
    expect(result.current.hasPollingStopped).toBe(false);
    expect(result.current.consecutiveFailures).toBe(0);
    expect(result.current.error).toBeNull();
  });

});
