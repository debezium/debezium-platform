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
 * Reconnect delay before the stream has sent one of its own. Once it sends a
 * `retry:` field the library's value takes over, so this is only the opening
 * default, not a ceiling.
 */
const RETRY_DELAY_MS = 3000;

/**
 * `window.setTimeout` takes a signed 32-bit delay. A larger one overflows and can
 * fire immediately, turning a long wait into a reconnect loop, so every delay
 * returned from here is capped at the timer's own limit.
 *
 * This covers the delays this module computes, which is where an arbitrary
 * intermediary's `Retry-After` arrives. A `retry:` field from the stream itself is
 * stored by the library and handed to its timer directly, out of reach from here.
 */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

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
 * When `Retry-After` expires, as a timestamp. Delta-seconds are counted from
 * now. An HTTP date is already a deadline. An unreadable header is ignored so
 * the caller can fall back. The remaining wait is computed later, after the
 * error body has been read.
 */
const retryAfterDeadline = (response: Response): number | undefined => {
  const header = response.headers.get("Retry-After")?.trim();
  if (!header) {
    return undefined;
  }
  if (/^\d+(\.\d+)?$/.test(header)) {
    return Date.now() + Math.round(Number(header) * 1000);
  }
  const when = Date.parse(header);
  if (Number.isNaN(when)) {
    return undefined;
  }
  return when;
};

/**
 * Statuses a client may retry. `408` and `429` are the temporary 4xx codes.
 * Every `5xx` is temporary. Every other status below 500 is terminal, including
 * a `403` and a `200` that is not an event stream.
 */
const retries = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

const isFatal = (error: unknown): boolean =>
  isApiRequestError(error) && !retries(error.status);

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
  // Whether the stream has ever sent a `retry:` field. Only the fact is tracked,
  // not the value: the library updates its own interval as each line is parsed,
  // including one in an event that never completed and so never reached
  // `onmessage`. Its number is therefore at least as fresh as anything captured
  // here, and returning nothing lets it win.
  let sawServerRetry = false;
  // When `Retry-After` on the response being handled expires.
  let retryDeadlineMs: number | undefined;

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
      // Any retryable status may carry Retry-After. A terminal status cannot.
      retryDeadlineMs = retries(response.status) ? retryAfterDeadline(response) : undefined;
      throw await httpFailure(response);
    },

    onmessage(event) {
      if (typeof event.retry === "number") {
        sawServerRetry = true;
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
      if (retryDeadlineMs !== undefined) {
        const delay = Math.max(0, retryDeadlineMs - Date.now());
        retryDeadlineMs = undefined;
        return Math.min(delay, MAX_TIMER_DELAY_MS);
      }
      // Returning nothing keeps whatever the stream last asked for; the opening
      // default only applies until it asks for something.
      return sawServerRetry ? undefined : RETRY_DELAY_MS;
    },
  }).catch((error: unknown) => {
    if (!controller.signal.aborted) {
      handlers.onError?.(error);
    }
  });

  return () => controller.abort();
};
