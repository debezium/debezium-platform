export const POLLING = {
  active: 7_000,
  idle: 30_000,
  idleThresholdMs: 2 * 60 * 1000,
  /** Slower profile for low-churn resources. */
  slow: 70_000,
  /** Consecutive failed attempts after which polling stops and the failure is reported. */
  maxFailures: 3,
  /** Gap between the attempts that count towards `maxFailures`. */
  failureInterval: 1_000,
} as const;

export type PollingProfile = "default" | "slow";
