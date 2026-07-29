import { POLLING, type PollingProfile } from "./pollingConfig";

export type PollingState = {
  isVisible: boolean;
  isIdle: boolean;
};

export function getPollingInterval(
  state: PollingState,
  profile: PollingProfile = "default"
): number | false {
  if (!state.isVisible) {
    return false;
  }

  if (state.isIdle) {
    return profile === "slow" ? POLLING.slow : POLLING.idle;
  }

  return profile === "slow" ? POLLING.slow : POLLING.active;
}

export function shouldRefetchOnIntervalChange(
  previous: number | false,
  current: number | false,
  profile: PollingProfile = "default"
): boolean {
  if (current === false) {
    return false;
  }

  if (previous === false) {
    return true;
  }

  if (
    profile === "default" &&
    previous === POLLING.idle &&
    current === POLLING.active
  ) {
    return true;
  }

  return false;
}
