import { describe, it, expect } from "vitest";
import {
  getPollingInterval,
  shouldRefetchOnIntervalChange,
} from "./getPollingInterval";
import { POLLING } from "./pollingConfig";

describe("getPollingInterval", () => {
  it("returns active interval when visible and not idle", () => {
    expect(getPollingInterval({ isVisible: true, isIdle: false })).toBe(
      POLLING.active
    );
  });

  it("returns idle interval when visible and idle for default profile", () => {
    expect(getPollingInterval({ isVisible: true, isIdle: true })).toBe(
      POLLING.idle
    );
  });

  it("returns slow interval when visible and not idle for slow profile", () => {
    expect(
      getPollingInterval({ isVisible: true, isIdle: false }, "slow")
    ).toBe(POLLING.slow);
  });

  it("keeps slow interval when idle for slow profile", () => {
    expect(getPollingInterval({ isVisible: true, isIdle: true }, "slow")).toBe(
      POLLING.slow
    );
  });

  it("pauses polling when tab is hidden", () => {
    expect(getPollingInterval({ isVisible: false, isIdle: false })).toBe(
      false
    );
    expect(getPollingInterval({ isVisible: false, isIdle: true }, "slow")).toBe(
      false
    );
  });
});

describe("shouldRefetchOnIntervalChange", () => {
  it("refetches when tab becomes visible", () => {
    expect(shouldRefetchOnIntervalChange(false, POLLING.active)).toBe(true);
  });

  it("refetches when user becomes active again", () => {
    expect(
      shouldRefetchOnIntervalChange(POLLING.idle, POLLING.active, "default")
    ).toBe(true);
  });

  it("does not refetch when tab is hidden", () => {
    expect(shouldRefetchOnIntervalChange(POLLING.active, false)).toBe(false);
  });

  it("does not refetch when interval stays the same", () => {
    expect(
      shouldRefetchOnIntervalChange(POLLING.active, POLLING.active)
    ).toBe(false);
  });

  it("refetches when slow profile tab becomes visible", () => {
    expect(
      shouldRefetchOnIntervalChange(false, POLLING.slow, "slow")
    ).toBe(true);
  });
});
