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

/**
 * Reconnect delay when the stream did not send one. A `retry:` field on an
 * event replaces this until a later event sets another.
 */
const RETRY_DELAY_MS = 3000;

export type EventStreamHandlers = {
  /** One `data:` payload. */
  onMessage: (data: string) => void;
  onOpen?: () => void;
  /** A transient failure. The stream will try again. */
  onRetry?: (error: unknown) => void;
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
 * The media type, without parameters. `text/event-stream; charset=utf-8` matches
 * `text/event-stream`. A longer name such as `text/event-streaming` does not.
 */
const mediaType = (contentType: string): string =>
  contentType.split(";")[0].trim().toLowerCase();

/**
 * `Retry-After` as a delay in milliseconds. The value is either delta-seconds
 * or an HTTP date. An unreadable header is ignored so the caller can fall back.
 */
const retryAfterDelay = (response: Response): number | undefined => {
  const header = response.headers.get("Retry-After")?.trim();
  if (!header) {
    return undefined;
  }
  if (/^\d+(\.\d+)?$/.test(header)) {
    return Math.round(Number(header) * 1000);
  }
  const when = Date.parse(header);
  if (Number.isNaN(when)) {
    return undefined;
  }
  return Math.max(0, when - Date.now());
};

/**
 * A 4xx other than 429, or a finished response that is not an event stream (a
 * `200` HTML page from a proxy). Reconnecting cannot fix those. A 429 is a
 * temporary limit. A 5xx and a dropped connection are transient too.
 */
const isFatal = (error: unknown): boolean =>
  isApiRequestError(error) && error.status < 500 && error.status !== 429;

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
  // Last `retry:` value from the server, in milliseconds. The library stores
  // the same number, then throws it away when `onerror` returns its own delay.
  let serverRetryMs: number | undefined;
  // Delay from the `Retry-After` header on the 429 currently being handled.
  let retryAfterMs: number | undefined;

  void fetchEventSource(url, {
    signal: controller.signal,
    headers: streamHeaders(),
    // Keep streaming while the browser tab is in the background. The default
    // drops the connection when the page is hidden, which would silently gap
    // the log view.
    openWhenHidden: true,

    async onopen(response) {
      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && mediaType(contentType) === EventStreamContentType) {
        handlers.onOpen?.();
        return;
      }
      if (response.status === 429) {
        retryAfterMs = retryAfterDelay(response);
      }
      throw await httpFailure(response);
    },

    onmessage(event) {
      if (typeof event.retry === "number") {
        serverRetryMs = event.retry;
      }
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
      handlers.onRetry?.(error);
      if (isApiRequestError(error) && error.status === 429 && retryAfterMs !== undefined) {
        const delay = retryAfterMs;
        retryAfterMs = undefined;
        return delay;
      }
      return serverRetryMs ?? RETRY_DELAY_MS;
    },
  }).catch((error: unknown) => {
    if (!controller.signal.aborted) {
      handlers.onError?.(error);
    }
  });

  return () => controller.abort();
};
