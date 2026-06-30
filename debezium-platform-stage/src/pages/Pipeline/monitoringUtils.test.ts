import { describe, expect, it } from "vitest";
import {
  computeSnapshotTableProgress,
  extractSnapshotStatusFromLabels,
  formatDurationAxis,
  formatDurationTooltip,
  formatSecondsAxis,
  formatSecondsTooltip,
  formatYAxisTick,
  buildChartLegendTooltipData,
  getActiveSnapshotStatus,
  getChartTooltipFormat,
  getSeriesChildName,
  getSeriesTooltipLabel,
  getYAxisTickFormat,
  transformToChartData,
  usesDurationAxisFormat,
} from "./monitoringUtils";
import { SNAPSHOT_PANELS, STREAMING_PANELS } from "./panelConfig";

describe("getActiveSnapshotStatus", () => {
  const makeSeries = (status: string, latestValue: number) => ({
    labels: {
      debezium_snapshot_status: status,
    },
    datapoints: [[1700000000, latestValue] as [number, number]],
  });

  const makeResponse = (series: ReturnType<typeof makeSeries>[]) => ({
    panelId: "snapshot-status",
    pipelineId: "test",
    timeRange: { start: "", end: "", step: "15s" },
    series,
    metadata: { queryDurationMs: 1 },
  });

  it("returns the status whose series latest value is 1", () => {
    expect(
      getActiveSnapshotStatus(
        makeResponse([
          makeSeries("aborted", 0),
          makeSeries("completed", 1),
          makeSeries("running", 0),
          makeSeries("skipped", 0),
        ])
      )
    ).toBe("completed");
  });

  it("returns null when no series is active", () => {
    expect(
      getActiveSnapshotStatus(
        makeResponse([makeSeries("running", 0), makeSeries("completed", 0)])
      )
    ).toBeNull();
  });

  it("extracts status from state labels when status label is absent", () => {
    expect(
      extractSnapshotStatusFromLabels({
        debezium_snapshot_running_state: "running",
      })
    ).toBe("running");
  });
});

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

describe("getSeriesTooltipLabel", () => {
  it("prefers host_name over other distinguishing labels", () => {
    expect(
      getSeriesTooltipLabel({
        host_name: "test-pipeline-6bfd4dd8b7-jptcq",
        debezium_event_type: "create",
      })
    ).toBe("test-pipeline-6bfd4dd8b7-jptcq");
  });

  it("falls back to getSeriesLabel when host_name is absent", () => {
    expect(getSeriesTooltipLabel({ debezium_event_type: "delete" })).toBe("Delete");
    expect(getSeriesTooltipLabel({ debezium_context: "streaming" })).toBe("Streaming");
  });
});

describe("transformToChartData", () => {
  it("uses host_name as the tooltip series name", () => {
    const chartData = transformToChartData([
      {
        labels: {
          host_name: "test-pipeline-2-865db774f-mqx65",
          debezium_event_type: "create",
        },
        datapoints: [[1700000000, 12.5] as [number, number]],
      },
    ]);

    expect(chartData).toHaveLength(1);
    expect(chartData[0].name).toBe("test-pipeline-2-865db774f-mqx65");
    expect(chartData[0].y).toBe(12.5);
  });
});

describe("buildChartLegendTooltipData", () => {
  it("maps series index to childName and host_name to legend label", () => {
    expect(getSeriesChildName(2)).toBe("series-2");
    expect(
      buildChartLegendTooltipData([
        {
          labels: { host_name: "pod-a", debezium_event_type: "create" },
          datapoints: [],
        },
        {
          labels: { host_name: "test-pipeline-6bfd4dd8b7-jptcq", debezium_event_type: "delete" },
          datapoints: [],
        },
      ])
    ).toEqual([
      { childName: "series-0", name: "pod-a" },
      { childName: "series-1", name: "test-pipeline-6bfd4dd8b7-jptcq" },
    ]);
  });
});
