import { afterEach, describe, expect, it, vi } from "vitest";
import { createPost, editPut } from "./apis";

const httpResponse = (
  body: unknown,
  init: { ok?: boolean; statusText?: string; jsonFails?: boolean } = {}
) =>
  ({
    ok: init.ok ?? true,
    statusText: init.statusText ?? (init.ok === false ? "Bad Request" : "OK"),
    json: init.jsonFails
      ? async () => {
          throw new Error("not json");
        }
      : async () => body,
  }) as Response;

describe("createPost and editPut error copy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not describe a failed create as a source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(httpResponse(null, { ok: false, jsonFails: true }))
    );

    const response = await createPost("/api/destinations", {});

    expect(response.error).toBe("Failed to create resource: Bad Request");
    expect(response.error).not.toMatch(/creating source/i);
  });

  it("does not describe a failed update as creating a source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(httpResponse(null, { ok: false, jsonFails: true }))
    );

    const response = await editPut("/api/pipelines/1", {});

    expect(response.error).toBe("Failed to update resource: Bad Request");
    expect(response.error).not.toMatch(/creating source/i);
  });

  it("prefers a server error body over the fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        httpResponse({ details: ["name already exists"] }, { ok: false })
      )
    );

    const response = await createPost("/api/sources", {});

    expect(response.error).toBe("name already exists");
  });

  it("returns the created body without touching a query cache", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(httpResponse({ id: 1, name: "orders" }))
    );

    const response = await createPost<{ id: number; name: string }>(
      "/api/destinations",
      { name: "orders" }
    );

    expect(response).toEqual({ data: { id: 1, name: "orders" } });
  });

  it("uses a caller-supplied fallback for network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await editPut(
      "/api/connections/1",
      {},
      "Failed to update connection"
    );

    expect(response.error).toBe("Failed to update connection");
  });
});
