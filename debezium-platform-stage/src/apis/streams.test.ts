import { afterEach, describe, expect, it, vi } from "vitest";
import { EventStreamContentType } from "@microsoft/fetch-event-source";
import { subscribeToEventStream } from "./streams";

const { fetchEventSource } = vi.hoisted(() => ({ fetchEventSource: vi.fn() }));

vi.mock("@microsoft/fetch-event-source", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@microsoft/fetch-event-source")
  >();
  return { ...actual, fetchEventSource };
});

/** The options object the wrapper hands to fetchEventSource. */
type Captured = Parameters<
  typeof import("@microsoft/fetch-event-source").fetchEventSource
>[1];

const lastCall = (): { url: string; options: Captured } => {
  const call = fetchEventSource.mock.calls.at(-1);
  if (!call) throw new Error("fetchEventSource was not called");
  return { url: call[0] as string, options: call[1] as Captured };
};

const sseResponse = (
  init: { status?: number; contentType?: string; retryAfter?: string } = {}
) =>
  new Response(init.status && init.status >= 400 ? "nope" : "", {
    status: init.status ?? 200,
    statusText: init.status === 403 ? "Forbidden" : init.status === 429 ? "Too Many Requests" : "OK",
    headers: {
      "Content-Type": init.contentType ?? EventStreamContentType,
      ...(init.retryAfter !== undefined ? { "Retry-After": init.retryAfter } : {}),
    },
  });

describe("subscribeToEventStream", () => {
  afterEach(() => {
    fetchEventSource.mockReset();
    vi.restoreAllMocks();
  });

  it("requests the event stream and stays open while the tab is hidden", () => {
    fetchEventSource.mockReturnValue(Promise.resolve());

    subscribeToEventStream("/api/pipelines/7/logs/stream", { onMessage: vi.fn() });

    const { url, options } = lastCall();
    expect(url).toBe("/api/pipelines/7/logs/stream");
    expect(options.openWhenHidden).toBe(true);
    // Add Authorization header.
    expect(options.headers).toMatchObject({ Accept: EventStreamContentType });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("forwards each message payload", () => {
    fetchEventSource.mockReturnValue(Promise.resolve());
    const onMessage = vi.fn();

    subscribeToEventStream("/stream", { onMessage });
    const { options } = lastCall();
    options.onmessage?.({ id: "", event: "", data: "line one" });
    options.onmessage?.({ id: "", event: "", data: "line two" });

    expect(onMessage.mock.calls.map((call) => call[0])).toEqual([
      "line one",
      "line two",
    ]);
  });

  it("aborts the request when unsubscribed", () => {
    fetchEventSource.mockReturnValue(Promise.resolve());

    const unsubscribe = subscribeToEventStream("/stream", { onMessage: vi.fn() });
    const { options } = lastCall();

    expect(options.signal?.aborted).toBe(false);
    unsubscribe();
    expect(options.signal?.aborted).toBe(true);
  });

  it("does not report an error for a normal unsubscribe", async () => {
    let reject: (error: unknown) => void = () => undefined;
    fetchEventSource.mockReturnValue(
      new Promise((_resolve, rejectFn) => {
        reject = rejectFn;
      })
    );
    const onError = vi.fn();

    const unsubscribe = subscribeToEventStream("/stream", {
      onMessage: vi.fn(),
      onError,
    });
    unsubscribe();
    // Aborting rejects the underlying promise; that is teardown, not a failure.
    reject(new DOMException("aborted", "AbortError"));
    await Promise.resolve();

    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onOpen for a real event stream", async () => {
    fetchEventSource.mockReturnValue(Promise.resolve());
    const onOpen = vi.fn();

    subscribeToEventStream("/stream", { onMessage: vi.fn(), onOpen });
    await lastCall().options.onopen?.(sseResponse());

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("accepts an event stream whose media type has a charset", async () => {
    fetchEventSource.mockReturnValue(Promise.resolve());
    const onOpen = vi.fn();

    subscribeToEventStream("/stream", { onMessage: vi.fn(), onOpen });
    await lastCall().options.onopen?.(
      sseResponse({ contentType: "text/event-stream; charset=utf-8" })
    );

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("rejects a media type that only shares the event-stream prefix", async () => {
    fetchEventSource.mockReturnValue(Promise.resolve());
    const onOpen = vi.fn();

    subscribeToEventStream("/stream", { onMessage: vi.fn(), onOpen });

    await expect(
      lastCall().options.onopen?.(sseResponse({ contentType: "text/event-streaming" }))
    ).rejects.toMatchObject({ name: "ApiRequestError" });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("stops retrying when a 200 is not an event stream", async () => {
    fetchEventSource.mockReturnValue(Promise.resolve());
    const onRetry = vi.fn();

    subscribeToEventStream("/stream", { onMessage: vi.fn(), onRetry });
    const { options } = lastCall();

    // An HTML login page from a proxy is a finished 200 of the wrong type.
    const failure = await options
      .onopen?.(sseResponse({ contentType: "text/html" }))
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ name: "ApiRequestError", status: 200 });
    expect(() => options.onerror?.(failure)).toThrow();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("stops retrying on a 4xx, keeping the status for a later auth layer", async () => {
    fetchEventSource.mockReturnValue(Promise.resolve());

    subscribeToEventStream("/stream", { onMessage: vi.fn() });
    const { options } = lastCall();

    const failure = await options
      .onopen?.(sseResponse({ status: 403 }))
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ name: "ApiRequestError", status: 403 });
    // Throwing out of onerror is what ends the stream instead of reconnecting.
    expect(() => options.onerror?.(failure)).toThrow();
  });

  it("retries a 429, waiting for Retry-After when the response has one", async () => {
    fetchEventSource.mockReturnValue(Promise.resolve());
    const onRetry = vi.fn();

    subscribeToEventStream("/stream", { onMessage: vi.fn(), onRetry });
    const { options } = lastCall();

    const limited = await options
      .onopen?.(sseResponse({ status: 429, retryAfter: "15" }))
      .catch((error: unknown) => error);

    expect(limited).toMatchObject({ name: "ApiRequestError", status: 429 });
    expect(options.onerror?.(limited)).toBe(15000);
    expect(onRetry).toHaveBeenCalledTimes(1);

    const again = await options
      .onopen?.(sseResponse({ status: 429 }))
      .catch((error: unknown) => error);

    expect(options.onerror?.(again)).toBe(3000);
  });

  it("retries a 5xx", async () => {
    fetchEventSource.mockReturnValue(Promise.resolve());
    const onRetry = vi.fn();

    subscribeToEventStream("/stream", { onMessage: vi.fn(), onRetry });
    const { options } = lastCall();

    const failure = await options
      .onopen?.(sseResponse({ status: 503 }))
      .catch((error: unknown) => error);

    expect(options.onerror?.(failure)).toBe(3000);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("uses the retry interval the stream sent", () => {
    fetchEventSource.mockReturnValue(Promise.resolve());

    subscribeToEventStream("/stream", { onMessage: vi.fn() });
    const { options } = lastCall();

    // Conductor sends this on log-stream-failure before ending the response.
    // Returning 3000 here would start a new reader sooner than it asked.
    options.onmessage?.({
      id: "",
      event: "log-stream-failure",
      data: "",
      retry: 15000,
    });

    expect(options.onerror?.(new TypeError("read failed"))).toBe(15000);
    // The value stays in effect when a later event does not replace it.
    options.onmessage?.({ id: "", event: "message", data: "line" });
    expect(options.onerror?.(new TypeError("read failed"))).toBe(15000);
  });

  it("reconnects after a transient failure", () => {
    fetchEventSource.mockReturnValue(Promise.resolve());
    const onRetry = vi.fn();

    subscribeToEventStream("/stream", { onMessage: vi.fn(), onRetry });
    const { options } = lastCall();

    // A dropped connection returns a retry delay rather than throwing.
    expect(options.onerror?.(new TypeError("network error"))).toBe(3000);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("reconnects when the server finishes the response", () => {
    fetchEventSource.mockReturnValue(Promise.resolve());

    subscribeToEventStream("/stream", { onMessage: vi.fn() });
    const { options } = lastCall();

    // The library stops after a clean close unless onclose throws. The thrown
    // error must take the same retry path as a dropped connection.
    const dropped = options.onerror?.(new TypeError("network error"));
    let closed: unknown;
    try {
      options.onclose?.();
    } catch (error) {
      closed = error;
    }

    expect(closed).toBeInstanceOf(Error);
    expect(options.onerror?.(closed)).toBe(dropped);
  });
});
