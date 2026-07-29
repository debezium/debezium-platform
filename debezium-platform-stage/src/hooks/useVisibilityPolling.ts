import { useEffect, useRef } from "react";

/**
 * Runs at a fixed interval while the tab is visible,
 * pauses when hidden, and refetches immediately when the tab becomes visible.
 */
export function useVisibilityPolling(
  intervalMs: number | null,
  onPoll: () => void,
  enabled = true
) {
  const onPollRef = useRef(onPoll);

  useEffect(() => {
    onPollRef.current = onPoll;
  });

  useEffect(() => {
    if (!enabled || intervalMs === null) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const startPolling = () => {
      if (intervalId !== null) {
        return;
      }

      intervalId = setInterval(() => {
        onPollRef.current();
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }

      onPollRef.current();
      startPolling();
    };

    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
