import { useCallback, useEffect, useRef, useState } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryFunction,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from "react-query";
import { shouldRefetchOnIntervalChange } from "../utils/getPollingInterval";
import { POLLING, type PollingProfile } from "../utils/pollingConfig";
import { useAdaptivePollingInterval } from "./useAdaptivePollingInterval";

type ResourceQueryOptions<TData, TError> = Omit<
  UseQueryOptions<TData, TError>,
  "refetchInterval" | "refetchIntervalInBackground" | "retry" | "retryDelay"
> & {
  profile?: PollingProfile;
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
  queryKey: QueryKey,
  queryFn: QueryFunction<TData>,
  options?: ResourceQueryOptions<TData, TError>
): ResourceQueryResult<TData, TError> {
  const { profile = "default", ...queryOptions } = options ?? {};
  const interval = useAdaptivePollingInterval(profile);
  const queryClient = useQueryClient();
  const previousIntervalRef = useRef<number | false>(interval);
  const [failure, setFailure] = useState<FailureState<TError>>(NO_FAILURE);

  useEffect(() => {
    const previous = previousIntervalRef.current;

    if (shouldRefetchOnIntervalChange(previous, interval, profile)) {
      void queryClient.refetchQueries(queryKey);
    }

    previousIntervalRef.current = interval;
  }, [interval, profile, queryClient, queryKey]);

  const { onError, onSuccess } = queryOptions;

  const handleError = useCallback(
    (error: TError) => {
      setFailure((previous) => ({ count: previous.count + 1, error }));
      onError?.(error);
    },
    [onError]
  );

  const handleSuccess = useCallback(
    (data: TData) => {
      setFailure((previous) => (previous.count === 0 ? previous : NO_FAILURE));
      onSuccess?.(data);
    },
    [onSuccess]
  );

  const result = useQuery<TData, TError>(queryKey, queryFn, {
    ...queryOptions,
    retry: false,
    refetchInterval: failurePollingInterval(interval, failure.count),
    refetchIntervalInBackground: false,
    onError: handleError,
    onSuccess: handleSuccess,
  });

  const { refetch } = result;

  const retry = useCallback(() => {
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
    isLoading: result.isLoading || isRetrying,
    isError: hasPollingStopped && (result.isError || failure.error !== null),
    error: hasPollingStopped ? result.error ?? failure.error : null,
    consecutiveFailures: failure.count,
    hasPollingStopped,
    retry,
  } as ResourceQueryResult<TData, TError>;
}
