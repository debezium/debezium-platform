import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { requestErrorMessage } from "./client";
import { createPost, deleteData, editPut } from "./apis";

export type CachedResource =
  | "sources"
  | "destinations"
  | "transforms"
  | "connections"
  | "pipelines";

// List keys match useResourceQuery("sources") -> ["sources"].
// The singular prefix also matches detail queries such as ["source", id].
// connectionsList is the name-uniqueness query on the connection forms.
const RESOURCE_QUERY_KEYS: Record<CachedResource, readonly QueryKey[]> = {
  sources: [["sources"], ["source"]],
  destinations: [["destinations"], ["destination"]],
  transforms: [["transforms"], ["transform"]],
  connections: [["connections"], ["connectionsList"]],
  pipelines: [["pipelines"]],
};

/**
 * Resources whose cached rows embed a copy of another resource, and so go stale
 * when it changes: a `Pipeline` carries its `source`, `destination` and
 * `transforms`; a `Source` and a `Destination` each carry their `connection`.
 *
 * This matters in two ways. Renaming a source leaves every pipeline row showing
 * the old name, which happens routinely. Deleting one would do the same, but the
 * conductor rejects deleting a resource that is still referenced, so that path
 * should be unreachable — it is covered here anyway rather than trusting a remote
 * check we do not control. The cost either way is one refetch of a short list.
 */
const EMBEDDED_IN: Record<CachedResource, readonly CachedResource[]> = {
  sources: ["pipelines"],
  destinations: ["pipelines"],
  transforms: ["pipelines"],
  connections: ["sources", "destinations"],
  pipelines: [], // nothing embeds a pipeline
};

export type ResourceWriteVariables = {
  url: string;
  payload: unknown;
  fallback?: string;
  resource?: CachedResource;
};

export const mutationErrorMessage = requestErrorMessage;

/** Query keys for a resource plus every list that embeds a copy of it. */
const staleQueryKeys = (resource: CachedResource): readonly QueryKey[] =>
  [resource, ...EMBEDDED_IN[resource]].flatMap(
    (name) => RESOURCE_QUERY_KEYS[name]
  );

const invalidateCachedResource = (
  queryClient: QueryClient,
  resource: CachedResource | undefined
): Promise<void> => {
  if (!resource) {
    return Promise.resolve();
  }
  return Promise.all(
    staleQueryKeys(resource).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey })
    )
  ).then(() => undefined);
};

export const useDeleteData = ({
  resource,
  onSuccess,
  onError,
}: {
  resource: CachedResource;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (url: string) => deleteData(url),

    onSuccess: () => {
      // Start the refetch, then notify the caller. Delete modals close from
      // onSuccess and should not wait on the list request.
      void invalidateCachedResource(queryClient, resource);
      onSuccess?.();
    },

    onError: (error) => {
      console.error("Error deleting data:", error);
      onError?.(error);
    },
  });
};

/**
 * The write itself throws {@link ApiRequestError}, and this lets it through
 * untouched: react-query hands it to the caller, who can read `status` to tell a
 * permission denial from a validation failure. The cache is only invalidated once
 * the write has actually succeeded.
 */
const writeResource = async <T,>(
  queryClient: QueryClient,
  write: (url: string, payload: unknown, fallback?: string) => Promise<T>,
  { url, payload, fallback, resource }: ResourceWriteVariables
): Promise<T> => {
  const data = await write(url, payload, fallback);
  await invalidateCachedResource(queryClient, resource);
  return data;
};

export const useCreateResource = <T = unknown,>() => {
  const queryClient = useQueryClient();

  return useMutation<T, Error, ResourceWriteVariables>({
    mutationFn: (variables) =>
      writeResource<T>(queryClient, createPost<T>, variables),
  });
};

export const useUpdateResource = <T = unknown,>() => {
  const queryClient = useQueryClient();

  return useMutation<T, Error, ResourceWriteVariables>({
    mutationFn: (variables) =>
      writeResource<T>(queryClient, editPut<T>, variables),
  });
};
