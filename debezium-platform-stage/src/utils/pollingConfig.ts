export const POLLING = {
  active: 7_000,
  idle: 30_000,
  idleThresholdMs: 2 * 60 * 1000,
  /** Slower profile for low-churn resources. */
  slow: 70_000,
} as const;

export type PollingProfile = "default" | "slow";
