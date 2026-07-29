import { useSyncExternalStore } from "react";
import { getPollingInterval } from "../utils/getPollingInterval";
import { subscribePollingState, getPollingState } from "../utils/activityTracker";
import type { PollingProfile } from "../utils/pollingConfig";

export function useAdaptivePollingInterval(
  profile: PollingProfile = "default"
): number | false {
  const state = useSyncExternalStore(subscribePollingState, getPollingState);
  return getPollingInterval(state, profile);
}
