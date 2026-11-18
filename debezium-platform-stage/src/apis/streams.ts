import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import { httpFailure, isApiRequestError } from "./client";

/**
 * Server-sent event streams
 *
 * This is the second place the app talks to the conductor. The bearer token can be added in `streamHeaders` below and every
 * stream in the app carries it.
 */

/** Reconnect delay after a transient failure. */
const RETRY_DELAY_MS = 3000;

export type EventStreamHandlers = {
  /** One `data:` payload. */
  onMessage: (data: string) => void;
  onOpen?: () => void;
  /** The stream stopped and will not retry. Not called on a normal unsubscribe. */
  onError?: (error: unknown) => void;
};

/**
 * Adds `Authorization: Bearer <token>` here.
 */
const streamHeaders = (): Record<string, string> => ({
  Accept: EventStreamContentType,
});

/**
 * A 4xx says the request itself is wrong — a missing pipeline today, a denied
 * permission once IAM is on. Reconnecting cannot fix it, so it ends the stream
 * instead of retrying forever. 5xx and dropped connections are transient.
 */
const isFatal = (error: unknown): boolean =>
  isApiRequestError(error) && error.status >= 400 && error.status < 500;

/**
 * Subscribe to an SSE endpoint. Returns an unsubscribe function; calling it
 * aborts the request and suppresses `onError`, so a React cleanup does not
 * report a teardown as a failure.
 */
export const subscribeToEventStream = (
  url: string,
  handlers: EventStreamHandlers
): (() => void) => {
  const controller = new AbortController();

  void fetchEventSource(url, {
    signal: controller.signal,
    headers: streamHeaders(),
    // Keep streaming while the browser tab is in the background. The default
    // drops the connection when the page is hidden, which would silently gap
    // the log view.
    openWhenHidden: true,

    async onopen(response) {
      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.startsWith(EventStreamContentType)) {
        handlers.onOpen?.();
        return;
      }
      throw await httpFailure(response);
    },

    onmessage(event) {
      handlers.onMessage(event.data);
    },

    onclose() {
      // A finished body is a success to the library, so it would stop the tail
      // while the Logs tab is still open. Throwing makes `onerror` schedule the
      // same retry as a dropped connection. Unsubscribe aborts first, so this
      // does not run for a tab change, and a retry that is already waiting is
      // cleared with the abort.
      throw new Error("Event stream closed");
    },

    onerror(error) {
      // Throwing stops retrying; returning a number schedules a reconnect.
      if (isFatal(error)) {
        throw error;
      }
      return RETRY_DELAY_MS;
    },
  }).catch((error: unknown) => {
    if (!controller.signal.aborted) {
      handlers.onError?.(error);
    }
  });

  return () => controller.abort();
};
