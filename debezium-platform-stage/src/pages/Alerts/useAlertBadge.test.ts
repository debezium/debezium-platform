import { NotificationBadgeVariant } from "@patternfly/react-core";
import { describe, it, expect } from "vitest";
import { AlertStatusResponse } from "./alertsTypes";
import {
  getAlertBadgeAriaLabel,
  getAlertBadgePresentation,
  getAlertBadgeVariant,
} from "./useAlertBadge";

const statusResponse = (
  firingBySeverity: AlertStatusResponse["firingBySeverity"]
): AlertStatusResponse => ({
  totalFiring:
    firingBySeverity.CRITICAL + firingBySeverity.WARNING + firingBySeverity.INFO,
  totalPending: 0,
  firingBySeverity,
  activeAlerts: [],
});

describe("getAlertBadgePresentation", () => {
  it("counts CRITICAL + WARNING and uses critical tone when any critical alerts fire", () => {
    expect(
      getAlertBadgePresentation(
        statusResponse({ CRITICAL: 1, WARNING: 2, INFO: 2 })
      )
    ).toEqual({ count: 3, tone: "critical" });
  });

  it("uses warning tone when only warning alerts fire", () => {
    expect(
      getAlertBadgePresentation(
        statusResponse({ CRITICAL: 0, WARNING: 4, INFO: 1 })
      )
    ).toEqual({ count: 4, tone: "warning" });
  });

  it("uses info tone when only INFO alerts fire", () => {
    expect(
      getAlertBadgePresentation(
        statusResponse({ CRITICAL: 0, WARNING: 0, INFO: 5 })
      )
    ).toEqual({ count: 0, tone: "info" });
  });

  it("is idle only when CRITICAL, WARNING, and INFO are all zero", () => {
    expect(
      getAlertBadgePresentation(
        statusResponse({ CRITICAL: 0, WARNING: 0, INFO: 0 })
      )
    ).toEqual({ count: 0, tone: "idle" });
    expect(getAlertBadgePresentation(undefined)).toEqual({ count: 0, tone: "idle" });
  });
});

describe("getAlertBadgeVariant", () => {
  it("maps critical to attention, info to unread, warning to unread (custom CSS), and idle to read", () => {
    expect(getAlertBadgeVariant("critical")).toBe(NotificationBadgeVariant.attention);
    expect(getAlertBadgeVariant("info")).toBe(NotificationBadgeVariant.unread);
    expect(getAlertBadgeVariant("warning")).toBe(NotificationBadgeVariant.unread);
    expect(getAlertBadgeVariant("idle")).toBe(NotificationBadgeVariant.read);
  });
});

describe("getAlertBadgeAriaLabel", () => {
  it("describes the firing count, info-only, or idle state", () => {
    expect(getAlertBadgeAriaLabel(11, "critical")).toBe("11 firing alerts");
    expect(getAlertBadgeAriaLabel(0, "info")).toBe("Info alerts firing");
    expect(getAlertBadgeAriaLabel(0, "idle")).toBe(
      "No firing critical or warning alerts"
    );
  });
});
