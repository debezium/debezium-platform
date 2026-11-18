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

const sseResponse = (init: { status?: number; contentType?: string } = {}) =>
  new Response(init.status && init.status >= 400 ? "nope" : "", {
    status: init.status ?? 200,
    statusText: init.status === 403 ? "Forbidden" : "OK",
    headers: { "Content-Type": init.contentType ?? EventStreamContentType },
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

  it("rejects a response that is not an event stream", async () => {
    fetchEventSource.mockReturnValue(Promise.resolve());
    const onOpen = vi.fn();

    subscribeToEventStream("/stream", { onMessage: vi.fn(), onOpen });

    // An HTML login page from a proxy would be a 200 of the wrong type.
    await expect(
      lastCall().options.onopen?.(sseResponse({ contentType: "text/html" }))
    ).rejects.toMatchObject({ name: "ApiRequestError" });
    expect(onOpen).not.toHaveBeenCalled();
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

  it("reconnects after a transient failure", () => {
    fetchEventSource.mockReturnValue(Promise.resolve());

    subscribeToEventStream("/stream", { onMessage: vi.fn() });
    const { options } = lastCall();

    // A dropped connection returns a retry delay rather than throwing.
    expect(options.onerror?.(new TypeError("network error"))).toBeGreaterThan(0);
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
