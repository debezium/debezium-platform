import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createPost, deleteData, editPut } from "./apis";
import { ApiRequestError, isApiRequestError } from "./client";
import {
  useCreateResource,
  useDeleteData,
  useUpdateResource,
} from "./mutations";

vi.mock("./apis", () => ({
  deleteData: vi.fn(),
  createPost: vi.fn(),
  editPut: vi.fn(),
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("resource mutations", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.mocked(deleteData).mockReset();
    vi.mocked(createPost).mockReset();
    vi.mocked(editPut).mockReset();
  });

  it("invalidates the deleted resource and the pipeline list that embeds it", async () => {
    vi.mocked(deleteData).mockResolvedValue(undefined);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useDeleteData({ resource: "sources", onSuccess }),
      { wrapper }
    );

    act(() => {
      result.current.mutate("/api/sources/1");
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(deleteData).toHaveBeenCalledWith("/api/sources/1");
    // Pipelines embed a copy of their source, so that list goes stale too. Still
    // scoped: destinations, transforms and connections are left alone.
    expect(invalidate.mock.calls.map((call) => call[0])).toEqual([
      { queryKey: ["sources"] },
      { queryKey: ["source"] },
      { queryKey: ["pipelines"] },
    ]);
  });

  it("invalidates both connection list keys and the lists embedding a connection", async () => {
    vi.mocked(deleteData).mockResolvedValue(undefined);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(
      () => useDeleteData({ resource: "connections" }),
      { wrapper }
    );

    act(() => {
      result.current.mutate("/api/connections/42");
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(invalidate.mock.calls.map((call) => call[0])).toEqual([
      { queryKey: ["connections"] },
      { queryKey: ["connectionsList"] },
      { queryKey: ["sources"] },
      { queryKey: ["source"] },
      { queryKey: ["destinations"] },
      { queryKey: ["destination"] },
    ]);
  });

  it("reports delete failures without invalidating", async () => {
    const error = new Error("in use");
    vi.mocked(deleteData).mockRejectedValue(error);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const onError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(
      () => useDeleteData({ resource: "pipelines", onError }),
      { wrapper }
    );

    act(() => {
      result.current.mutate("/api/pipelines/3");
    });

    await waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    expect(invalidate).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("Error deleting data:", error);
    consoleError.mockRestore();
  });

  it("returns created data and invalidates the named resource", async () => {
    vi.mocked(createPost).mockResolvedValue({ id: 7, name: "orders" });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(
      () => useCreateResource<{ id: number; name: string }>(),
      { wrapper }
    );

    let created: { id: number; name: string } | null | undefined;
    await act(async () => {
      created = await result.current.mutateAsync({
        url: "/api/sources",
        payload: { name: "orders" },
        resource: "sources",
      });
    });

    expect(created).toEqual({ id: 7, name: "orders" });
    expect(createPost).toHaveBeenCalledWith(
      "/api/sources",
      { name: "orders" },
      undefined
    );
    expect(invalidate.mock.calls.map((call) => call[0])).toEqual([
      { queryKey: ["sources"] },
      { queryKey: ["source"] },
      { queryKey: ["pipelines"] },
    ]);
  });

  it("leaves the cache alone when a write names no resource", async () => {
    vi.mocked(createPost).mockResolvedValue({ valid: false });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateResource<{ valid: boolean }>(), {
      wrapper,
    });

    let validation: { valid: boolean } | null | undefined;
    await act(async () => {
      validation = await result.current.mutateAsync({
        url: "/api/connections/validate",
        payload: { name: "orders" },
      });
    });

    expect(validation).toEqual({ valid: false });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("passes a denied create through with its status intact and does not invalidate", async () => {
    vi.mocked(createPost).mockRejectedValue(
      new ApiRequestError({
        kind: "http",
        status: 403,
        statusText: "Forbidden",
        body: { error: "requires source:write" },
        contentType: "application/json",
        parsedJson: true,
        text: "",
        message: "requires source:write",
      })
    );
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateResource(), { wrapper });

    let caught: unknown;
    await act(async () => {
      caught = await result.current
        .mutateAsync({ url: "/api/sources", payload: {}, resource: "sources" })
        .catch((error: unknown) => error);
    });

    // The hook must not flatten this into a plain Error: With IAM needs the 403 to
    // render "requires source:write" rather than a generic failure.
    expect(isApiRequestError(caught)).toBe(true);
    expect((caught as ApiRequestError).status).toBe(403);
    expect((caught as ApiRequestError).message).toBe("requires source:write");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("invalidates pipelines after an update", async () => {
    vi.mocked(editPut).mockResolvedValue({ id: 3, name: "orders" });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateResource<{ id: number }>(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        url: "/api/pipelines/3",
        payload: { name: "orders" },
        fallback: "Failed to update",
        resource: "pipelines",
      });
    });

    expect(editPut).toHaveBeenCalledWith(
      "/api/pipelines/3",
      { name: "orders" },
      "Failed to update"
    );
    expect(invalidate.mock.calls.map((call) => call[0])).toEqual([
      { queryKey: ["pipelines"] },
    ]);
  });
});
