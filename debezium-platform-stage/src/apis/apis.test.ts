import { afterEach, describe, expect, it, vi } from "vitest";
import { createPost, editPut } from "./apis";

const httpResponse = (
  body: unknown,
  init: { ok?: boolean; statusText?: string; jsonFails?: boolean } = {}
) => {
  const ok = init.ok ?? true;
  // `jsonFails` models a server that labels its body JSON but does not send JSON.
  return new Response(init.jsonFails ? "not json" : JSON.stringify(body), {
    status: ok ? 200 : 400,
    statusText: init.statusText ?? (ok ? "OK" : "Bad Request"),
    headers: { "Content-Type": "application/json" },
  });
};

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

    await expect(createPost("/api/destinations", {})).rejects.toMatchObject({
      message: "Failed to create resource: Bad Request",
    });
    await expect(createPost("/api/destinations", {})).rejects.not.toMatchObject({
      message: expect.stringMatching(/creating source/i),
    });
  });

  it("does not describe a failed update as creating a source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(httpResponse(null, { ok: false, jsonFails: true }))
    );

    await expect(editPut("/api/pipelines/1", {})).rejects.toMatchObject({
      message: "Failed to update resource: Bad Request",
    });
  });

  it("prefers a server error body over the fallback, and keeps the status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        httpResponse({ details: ["name already exists"] }, { ok: false })
      )
    );

    // The reworded message is for display; `status` is what a permission check reads.
    await expect(createPost("/api/sources", {})).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 400,
      message: "name already exists",
      body: { details: ["name already exists"] },
    });
  });

  it("keeps the status on a denied write so a 403 stays distinguishable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "requires pipeline:write" }), {
          status: 403,
          statusText: "Forbidden",
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(editPut("/api/pipelines/1", {})).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 403,
      message: "requires pipeline:write",
    });
  });

  it("resolves with the created body without touching a query cache", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(httpResponse({ id: 1, name: "orders" }))
    );

    await expect(
      createPost<{ id: number; name: string }>("/api/destinations", { name: "orders" })
    ).resolves.toEqual({ id: 1, name: "orders" });
  });

  it("uses a caller-supplied fallback for network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(
      editPut("/api/connections/1", {}, "Failed to update connection")
    ).rejects.toMatchObject({
      kind: "network",
      message: "Failed to update connection",
    });
  });
});
