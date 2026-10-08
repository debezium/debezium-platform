import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryFunction,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { shouldRefetchOnIntervalChange } from "../utils/getPollingInterval";
import { POLLING, type PollingProfile } from "../utils/pollingConfig";
import { useAdaptivePollingInterval } from "./useAdaptivePollingInterval";

type ResourceQueryKey = QueryKey | string;

const toQueryKey = (queryKey: ResourceQueryKey): QueryKey =>
  Array.isArray(queryKey) ? queryKey : [queryKey];

type ResourceQueryOptions<TData, TError> = Omit<
  UseQueryOptions<TData, TError>,
  | "queryKey"
  | "queryFn"
  | "refetchInterval"
  | "refetchIntervalInBackground"
  | "retry"
  | "retryDelay"
> & {
  profile?: PollingProfile;
  onSuccess?: (data: TData) => void;
  onError?: (error: TError) => void;
};

export type ResourceQueryResult<TData, TError> = UseQueryResult<
  TData,
  TError
> & {
  consecutiveFailures: number;
  hasPollingStopped: boolean;
  retry: () => void;
};

function failurePollingInterval(
  interval: number | false,
  consecutiveFailures: number
): number | false {
  if (interval === false || consecutiveFailures === 0) {
    return interval;
  }

  return consecutiveFailures >= POLLING.maxFailures
    ? false
    : POLLING.failureInterval;
}

type FailureState<TError> = {
  count: number;
  error: TError | null;
};

const NO_FAILURE = { count: 0, error: null };

export function useResourceQuery<TData, TError = Error>(
  queryKey: ResourceQueryKey,
  queryFn: QueryFunction<TData>,
  options?: ResourceQueryOptions<TData, TError>
): ResourceQueryResult<TData, TError> {
  const { profile = "default", onError, onSuccess, ...queryOptions } = options ?? {};
  const normalizedQueryKey = useMemo(() => toQueryKey(queryKey), [queryKey]);
  const interval = useAdaptivePollingInterval(profile);
  const queryClient = useQueryClient();
  const previousIntervalRef = useRef<number | false>(interval);
  const [failure, setFailure] = useState<FailureState<TError>>(NO_FAILURE);
  const [isManualRetrying, setIsManualRetrying] = useState(false);

  useEffect(() => {
    const previous = previousIntervalRef.current;

    if (shouldRefetchOnIntervalChange(previous, interval, profile)) {
      void queryClient.refetchQueries({ queryKey: normalizedQueryKey });
    }

    previousIntervalRef.current = interval;
  }, [interval, profile, queryClient, normalizedQueryKey]);

  const handleError = useCallback(
    (error: TError) => {
      setIsManualRetrying(false);
      setFailure((previous) => ({ count: previous.count + 1, error }));
      onError?.(error);
    },
    [onError]
  );

  const handleSuccess = useCallback(
    (data: TData) => {
      setIsManualRetrying(false);
      setFailure((previous) => (previous.count === 0 ? previous : NO_FAILURE));
      onSuccess?.(data);
    },
    [onSuccess]
  );

  const result = useQuery<TData, TError>({
    ...queryOptions,
    queryKey: normalizedQueryKey,
    retry: false,
    refetchInterval: failurePollingInterval(interval, failure.count),
    refetchIntervalInBackground: false,
    queryFn: async (context) => {
      try {
        const data = await queryFn(context);
        handleSuccess(data);
        return data;
      } catch (error) {
        handleError(error as TError);
        throw error;
      }
    },
  });

  const { refetch } = result;

  const retry = useCallback(() => {
    setIsManualRetrying(true);
    setFailure(NO_FAILURE);
    void refetch();
  }, [refetch]);

  const hasPollingStopped = failure.count >= POLLING.maxFailures;

  const isRetrying =
    failure.count > 0 &&
    !hasPollingStopped &&
    !result.isSuccess &&
    result.data === undefined;

  return {
    ...result,
    isLoading: result.isLoading || isRetrying || isManualRetrying,
    isError: hasPollingStopped && (result.isError || failure.error !== null),
    error: hasPollingStopped ? result.error ?? failure.error : null,
    consecutiveFailures: failure.count,
    hasPollingStopped,
    retry,
  } as ResourceQueryResult<TData, TError>;
}
