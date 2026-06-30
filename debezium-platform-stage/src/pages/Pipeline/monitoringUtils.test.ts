import { describe, expect, it } from "vitest";
import {
  computeSnapshotTableProgress,
  formatDurationAxis,
  formatDurationTooltip,
  formatSecondsAxis,
  formatSecondsTooltip,
  formatYAxisTick,
  getChartTooltipFormat,
  getYAxisTickFormat,
  usesDurationAxisFormat,
} from "./monitoringUtils";
import { SNAPSHOT_PANELS, STREAMING_PANELS } from "./panelConfig";

describe("formatDurationAxis", () => {
  it("formats non-positive values as 0s", () => {
    expect(formatDurationAxis(0)).toBe("0s");
    expect(formatDurationAxis(-0.001)).toBe("0s");
  });

  it("formats sub-second values with one decimal", () => {
    expect(formatDurationAxis(0.5)).toBe("0.5s");
  });

  it("formats seconds", () => {
    expect(formatDurationAxis(45)).toBe("45s");
    expect(formatDurationAxis(59)).toBe("59s");
  });

  it("formats minutes", () => {
    expect(formatDurationAxis(60)).toBe("1m");
    expect(formatDurationAxis(750)).toBe("12.5m");
    expect(formatDurationAxis(720)).toBe("12m");
  });

  it("formats hours", () => {
    expect(formatDurationAxis(3600)).toBe("1h");
    expect(formatDurationAxis(18773)).toBe("5.2h");
    expect(formatDurationAxis(7200)).toBe("2h");
  });
});

describe("formatDurationTooltip", () => {
  it("formats non-positive values as 0s", () => {
    expect(formatDurationTooltip(0)).toBe("0s");
    expect(formatDurationTooltip(-1)).toBe("0s");
  });

  it("formats sub-minute values with one decimal", () => {
    expect(formatDurationTooltip(45.2)).toBe("45.2s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDurationTooltip(60)).toBe("1m");
    expect(formatDurationTooltip(750)).toBe("12m 30s");
  });

  it("formats hours and minutes", () => {
    expect(formatDurationTooltip(3600)).toBe("1h");
    expect(formatDurationTooltip(18773)).toBe("5h 13m");
  });
});

describe("computeSnapshotTableProgress", () => {
  it("derives completed counts and progress percentage", () => {
    expect(computeSnapshotTableProgress(12, 4)).toEqual({
      total: 12,
      remaining: 4,
      completed: 8,
      progressPercent: (8 / 12) * 100,
    });
  });

  it("handles zero totals as 0% of 0", () => {
    expect(computeSnapshotTableProgress(0, 0)).toEqual({
      total: 0,
      remaining: 0,
      completed: 0,
      progressPercent: 0,
    });
  });

  it("clamps remaining above total and avoids negative completed", () => {
    expect(computeSnapshotTableProgress(10, 15)).toEqual({
      total: 10,
      remaining: 10,
      completed: 0,
      progressPercent: 0,
    });
  });
});

describe("formatSecondsAxis", () => {
  it("appends s to Y-axis tick values", () => {
    expect(formatSecondsAxis(0)).toBe("0s");
    expect(formatSecondsAxis(45)).toBe("45s");
    expect(formatSecondsAxis(1.5)).toBe("1.5s");
    expect(formatSecondsAxis(1500)).toBe("1.5Ks");
  });
});

describe("formatSecondsTooltip", () => {
  it("appends s to tooltip values", () => {
    expect(formatSecondsTooltip(0)).toBe("0s");
    expect(formatSecondsTooltip(45.2)).toBe("45.2s");
    expect(formatSecondsTooltip(1500)).toBe("1.5Ks");
  });
});

describe("panel duration format helpers", () => {
  it("enables duration formatting only for time-since-last-event", () => {
    expect(usesDurationAxisFormat(STREAMING_PANELS.timeSinceLastEvent)).toBe(true);
    expect(usesDurationAxisFormat(STREAMING_PANELS.sourceLag)).toBe(false);
    expect(usesDurationAxisFormat(SNAPSHOT_PANELS.snapshotDuration)).toBe(false);
  });

  it("returns duration formatters for time-since-last-event", () => {
    expect(getYAxisTickFormat(STREAMING_PANELS.timeSinceLastEvent)(3600)).toBe("1h");
    expect(getChartTooltipFormat(STREAMING_PANELS.timeSinceLastEvent)(3600)).toBe("1h");
  });

  it("returns seconds-suffixed formatters for source-lag and snapshot-duration", () => {
    expect(getYAxisTickFormat(STREAMING_PANELS.sourceLag)(45)).toBe("45s");
    expect(getYAxisTickFormat(SNAPSHOT_PANELS.snapshotDuration)(120)).toBe("120s");
    expect(getChartTooltipFormat(STREAMING_PANELS.sourceLag)(45.2)).toBe("45.2s");
    expect(getChartTooltipFormat(SNAPSHOT_PANELS.snapshotDuration)(120)).toBe("120s");
  });

  it("returns default formatters for other panels", () => {
    expect(getYAxisTickFormat(STREAMING_PANELS.sourceLag)).not.toBe(formatYAxisTick);
    expect(getYAxisTickFormat(STREAMING_PANELS.streamingEventCount)(1500)).toBe("1.5K");
    expect(getChartTooltipFormat(STREAMING_PANELS.streamingEventCount)(1500)).toBe("1.5K");
  });
});
