import { LabelStatus } from "@patternfly/react-core";
import { describe, it, expect } from "vitest";
import { AlertStatusResponse } from "./alertsTypes";
import {
  ALERTS_DEFAULT_PATH,
  FIRING_ALERTS_PATH,
  getAlertBadgeAriaLabel,
  getAlertBadgeLabelStatus,
  getAlertBadgePresentation,
  getAlertNavPath,
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

  it("is idle when only INFO alerts fire, matching the no-alert state", () => {
    expect(
      getAlertBadgePresentation(
        statusResponse({ CRITICAL: 0, WARNING: 0, INFO: 5 })
      )
    ).toEqual({ count: 0, tone: "idle" });
  });

  it("is idle when CRITICAL, WARNING, and INFO are all zero", () => {
    expect(
      getAlertBadgePresentation(
        statusResponse({ CRITICAL: 0, WARNING: 0, INFO: 0 })
      )
    ).toEqual({ count: 0, tone: "idle" });
    expect(getAlertBadgePresentation(undefined)).toEqual({ count: 0, tone: "idle" });
  });
});

describe("getAlertBadgeLabelStatus", () => {
  it("maps critical to danger, warning to warning, and idle to undefined", () => {
    expect(getAlertBadgeLabelStatus("critical")).toBe(LabelStatus.danger);
    expect(getAlertBadgeLabelStatus("warning")).toBe(LabelStatus.warning);
    expect(getAlertBadgeLabelStatus("idle")).toBeUndefined();
  });
});

describe("getAlertBadgeAriaLabel", () => {
  it("describes the firing count or idle state", () => {
    expect(getAlertBadgeAriaLabel(11, "critical")).toBe("11 firing alerts");
    expect(getAlertBadgeAriaLabel(0, "idle")).toBe(
      "No firing critical or warning alerts"
    );
  });
});

describe("getAlertNavPath", () => {
  it("opens events filtered to FIRING when there are firing alerts, otherwise the default events path", () => {
    expect(getAlertNavPath(true)).toBe(FIRING_ALERTS_PATH);
    expect(getAlertNavPath(false)).toBe(ALERTS_DEFAULT_PATH);
  });
});
