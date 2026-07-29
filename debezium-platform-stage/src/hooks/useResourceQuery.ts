import { useEffect, useRef } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryFunction,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from "react-query";
import { shouldRefetchOnIntervalChange } from "../utils/getPollingInterval";
import type { PollingProfile } from "../utils/pollingConfig";
import { useAdaptivePollingInterval } from "./useAdaptivePollingInterval";

type ResourceQueryOptions<TData, TError> = Omit<
  UseQueryOptions<TData, TError>,
  "refetchInterval" | "refetchIntervalInBackground"
> & {
  profile?: PollingProfile;
};

export function useResourceQuery<TData, TError = Error>(
  queryKey: QueryKey,
  queryFn: QueryFunction<TData>,
  options?: ResourceQueryOptions<TData, TError>
): UseQueryResult<TData, TError> {
  const { profile = "default", ...queryOptions } = options ?? {};
  const interval = useAdaptivePollingInterval(profile);
  const queryClient = useQueryClient();
  const previousIntervalRef = useRef<number | false>(interval);

  useEffect(() => {
    const previous = previousIntervalRef.current;

    if (shouldRefetchOnIntervalChange(previous, interval, profile)) {
      void queryClient.refetchQueries(queryKey);
    }

    previousIntervalRef.current = interval;
  }, [interval, profile, queryClient, queryKey]);

  return useQuery<TData, TError>(queryKey, queryFn, {
    ...queryOptions,
    refetchInterval: interval,
    refetchIntervalInBackground: false,
  });
}
