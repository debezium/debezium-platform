import { afterEach, describe, expect, it, vi } from "vitest";
import { createAlertChannel } from "./alerts";
import {
  createPost,
  deleteData,
  fetchData,
  fetchFile,
  fetchText,
  verifySignals,
} from "./apis";
import { isApiRequestError, request } from "./client";

const jsonResponse = (
  body: unknown,
  init: { status?: number; statusText?: string } = {}
) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? (init.status && init.status >= 400 ? "Error" : "OK"),
    headers: { "Content-Type": "application/json" },
  });

describe("request", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the url and an init every call, so a later auth layer has one place to add headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request<{ id: number }>("/api/sources")).resolves.toEqual({ id: 1 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sources");
    expect(init.headers).toBeInstanceOf(Headers);
    expect(init.method).toBeUndefined();
  });

  it("keeps 401 and 403 distinct and prefers details over the error category", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, { status: 401, statusText: "Unauthorized" }))
        .mockResolvedValueOnce(
          jsonResponse(
            { error: "forbidden", details: ["missing permission pipeline:update"] },
            { status: 403, statusText: "Forbidden" }
          )
        )
    );

    await expect(request("/api/pipelines")).rejects.toMatchObject({
      name: "ApiRequestError",
      kind: "http",
      status: 401,
      statusText: "Unauthorized",
      body: { error: "unauthorized" },
      message: "unauthorized",
    });

    await expect(request("/api/pipelines/1")).rejects.toMatchObject({
      kind: "http",
      status: 403,
      statusText: "Forbidden",
      body: { error: "forbidden", details: ["missing permission pipeline:update"] },
      message: "missing permission pipeline:update",
    });
  });

  it("prefers a field violation, then a detail, then error, then message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          violations: [{ field: "name", message: "required" }],
          details: ["ignored detail"],
          error: "ignored error",
        }, { status: 400, statusText: "Bad Request" })
      )
      .mockResolvedValueOnce(
        jsonResponse({ message: "connector offline" }, { status: 409, statusText: "Conflict" })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/api/signals")).rejects.toMatchObject({
      message: "name:required",
      parsedJson: true,
    });
    await expect(request("/api/signals")).rejects.toMatchObject({
      status: 409,
      message: "connector offline",
    });
  });

  it("keeps a non-JSON error body and its status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("disk full", {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "Content-Type": "text/plain" },
        })
      )
    );

    const error = await request("/api/pipelines").catch((caught: unknown) => caught);

    expect(isApiRequestError(error)).toBe(true);
    if (!isApiRequestError(error)) {
      return;
    }
    expect(error.kind).toBe("http");
    expect(error.status).toBe(500);
    expect(error.parsedJson).toBe(false);
    expect(error.body).toBe("disk full");
    expect(error.message).toBe("disk full");
  });

  it("classifies a rejected fetch as a network failure and keeps the cause", async () => {
    const offline = new Error("offline");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(offline));

    const error = await request("/api/sources").catch((caught: unknown) => caught);

    expect(isApiRequestError(error)).toBe(true);
    if (!isApiRequestError(error)) {
      return;
    }
    expect(error.kind).toBe("network");
    expect(error.status).toBe(0);
    expect(error.statusText).toBe("Network or unexpected error");
    expect(error.cause).toBe(offline);
  });

  it("returns null for an empty JSON body when asked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200, statusText: "OK" }))
    );

    await expect(request("/api/alerts/rules", { emptyBody: "null" })).resolves.toBeNull();
  });
});

describe("legacy helpers over request", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the parsed body on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "IDLE" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchData("/api/pipelines/7/snapshots/progress")).resolves.toEqual({
      status: "IDLE",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/pipelines/7/snapshots/progress");
  });

  it("throws ApiRequestError with the real status and does not log an HTTP failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, { status: 404, statusText: "Not Found" })
      )
    );

    await expect(fetchData("/missing")).rejects.toMatchObject({
      name: "ApiRequestError",
      kind: "http",
      status: 404,
      statusText: "Not Found",
      message: "Not Found",
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("keeps createPost on details and ignores a message-only body", async () => {
    const badRequest = { status: 400, statusText: "Bad Request" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ details: ["name already exists"], message: "unused" }, badRequest)
      )
      .mockResolvedValueOnce(jsonResponse({ message: "connector offline" }, badRequest));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPost("/api/sources", {})).rejects.toMatchObject({
      message: "name already exists",
    });
    await expect(
      createPost("/api/sources", {}, "Failed to create resource")
    ).rejects.toMatchObject({
      message: "Failed to create resource: Bad Request",
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe("{}");
  });

  it("throws ApiRequestError for an HTTP body and a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "missing" }, { status: 404, statusText: "Not Found" }))
    );

    await expect(fetchData("/api/sources")).rejects.toMatchObject({
      name: "ApiRequestError",
      kind: "http",
      status: 404,
      statusText: "Not Found",
      body: { error: "missing" },
      message: "missing",
    });

    const offline = new Error("offline");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(offline));
    await expect(fetchData("/api/sources")).rejects.toMatchObject({
      name: "ApiRequestError",
      kind: "network",
      status: 0,
      statusText: "Network or unexpected error",
      message: "offline",
      cause: offline,
    });
  });

  it("formats delete errors from message and details, and uses raw text otherwise", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse(
          { message: "cannot delete", details: ["in use", "pipeline orders"] },
          { status: 409, statusText: "Conflict" }
        )
      ).mockResolvedValueOnce(
        new Response("busy", {
          status: 409,
          statusText: "Conflict",
          headers: { "Content-Type": "text/plain" },
        })
      )
    );

    // Reworded for display, but still an ApiRequestError: `status` has to survive
    // so a caller can tell a permission denial from any other delete failure.
    await expect(deleteData("/api/sources/1")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 409,
      message: "cannot delete: in use\npipeline orders",
    });
    await expect(deleteData("/api/sources/1")).rejects.toMatchObject({
      status: 409,
      message: "busy",
    });
  });

  it("returns a plain-text body and rejects instead of returning an error page as text", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response("line one\nline two", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          })
        )
        .mockResolvedValueOnce(
          new Response("no such pipeline", {
            status: 404,
            statusText: "Not Found",
            headers: { "Content-Type": "text/plain" },
          })
        )
    );

    await expect(fetchText("/api/pipelines/7/logs")).resolves.toBe("line one\nline two");
    // The log view used to render this body as log lines; it has to reject instead.
    await expect(fetchText("/api/pipelines/9/logs")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 404,
    });
  });

  it("uses the first signal violation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { violations: [{ field: "data", message: "required" }], error: "bad" },
          { status: 400, statusText: "Bad Request" }
        )
      )
    );

    // Signal verify reads `violations` first, which the other writers ignore.
    await expect(verifySignals("/api/signals", {})).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 400,
      message: "data:required",
    });
  });

  it("returns a file error string without reading a blob", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({}, { status: 404, statusText: "Not Found" }))
    );

    await expect(fetchFile("/api/pipelines/1/logs")).resolves.toEqual({
      error: "Failed to fetch file: Not Found",
    });
  });

  it("keeps an empty alert create body as null data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200, statusText: "OK" }))
    );

    await expect(
      createAlertChannel({
        name: "ops",
        type: "EMAIL",
        enabled: true,
        config: { recipients: ["ops@example.com"] },
      })
    ).resolves.toBeNull();
  });
});
