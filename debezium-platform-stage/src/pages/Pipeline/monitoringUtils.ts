import type { PanelQueryResponse, TimeSeries } from "../../apis/types";
import { formatChartTimestamp } from "../../utils/timeRangeUtils";
import { SNAPSHOT_PANELS, STREAMING_PANELS } from "./panelConfig";

export const PANEL_EMPTY_MESSAGES: Record<string, string> = {
  "source-lag": "No lag detected — pipeline is processing in real-time",
  "time-since-last-event": "Events are being processed continuously",
  "queue-size-utilization": "Metric not available",
  "snapshot-duration": "Snapshot already completed",
};


const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const getSeriesLabel = (labels: Record<string, string>): string => {
  const eventType = labels.debezium_event_type ?? labels.event_type;
  const context = labels.debezium_context;

  if (eventType) {
    return capitalize(eventType);
  }

  if (context) {
    return capitalize(context);
  }

  return labels.__name__ ?? "value";
};

export const hasPanelData = (data?: PanelQueryResponse): boolean => {
  if (!data?.series?.length) {
    return false;
  }

  return data.series.some((series) => (series.datapoints?.length ?? 0) > 0);
};

/** Parse a metric datapoint; returns null for NaN, Infinity, null, and non-numeric values. */
export const parseMetricValue = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isNaN(value)) {
    return null;
  }

  if (typeof value === "string" && value.trim().toLowerCase() === "nan") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getLatestFromSeries = (series: TimeSeries): number | null => {
  if (!series.datapoints?.length) {
    return null;
  }

  for (let i = series.datapoints.length - 1; i >= 0; i--) {
    const value = parseMetricValue(series.datapoints[i][1]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

export const getLatestValue = (
  data?: PanelQueryResponse,
  seriesIndex = 0
): number | null => {
  if (!data?.series?.length) {
    return null;
  }

  const preferredSeries = data.series[seriesIndex];
  const preferredValue = preferredSeries ? getLatestFromSeries(preferredSeries) : null;
  if (preferredValue !== null) {
    return preferredValue;
  }

  for (const series of data.series) {
    const value = getLatestFromSeries(series);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

/** True when at least one series has a usable numeric value (checks latest-first per series). */
export const hasPlottableMetricData = (data?: PanelQueryResponse): boolean =>
  getLatestValue(data) !== null;

/** Latest value for boolean/status gauges; uses max across series when replicas differ. */
export const getStatusValue = (data?: PanelQueryResponse): number | null => {
  if (!data?.series?.length) {
    return null;
  }

  const values = data.series
    .map(getLatestFromSeries)
    .filter((value): value is number => value !== null);

  if (!values.length) {
    return null;
  }

  return Math.max(...values);
};

export const isStatusActive = (value: number | null | undefined): boolean =>
  value != null && value >= 1;

export const getCombinedLatestRate = (data?: PanelQueryResponse): number => {
  if (!data?.series?.length) {
    return 0;
  }

  return data.series.reduce((sum, series) => {
    const latest = getLatestFromSeries(series);
    return latest !== null ? sum + latest : sum;
  }, 0);
};

export const transformToChartData = (seriesList: TimeSeries[]) => {
  return seriesList.flatMap((series) =>
    (series.datapoints ?? []).flatMap(([timestamp, value]) => {
      const parsed = parseMetricValue(value);
      if (parsed === null) {
        return [];
      }

      return [
        {
          x: formatChartTimestamp(timestamp),
          y: parsed,
          name: getSeriesLabel(series.labels),
        },
      ];
    })
  );
};

export const collectChartYValues = (data: PanelQueryResponse): number[] =>
  data.series.flatMap(
    (series) =>
      series.datapoints?.flatMap(([, value]) => {
        const parsed = parseMetricValue(value);
        return parsed !== null ? [parsed] : [];
      }) ?? []
  );

const roundUpNice = (value: number): number => {
  if (value <= 0) {
    return 0.01;
  }

  const exponent = Math.floor(Math.log10(value));
  const scale = Math.pow(10, exponent);
  const fraction = value / scale;

  let niceFraction = 10;
  if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 5) {
    niceFraction = 5;
  }

  return niceFraction * scale;
};

/** Derive a readable Y-axis range from the panel's datapoints. */
export const getChartYDomain = (data: PanelQueryResponse): { min: number; max: number } => {
  const values = collectChartYValues(data);
  if (!values.length) {
    return { min: 0, max: 1 };
  }

  const dataMax = Math.max(...values, 0);
  const dataMin = Math.min(...values, 0);

  if (dataMax === 0 && dataMin === 0) {
    return { min: 0, max: 0.01 };
  }

  return {
    min: dataMin < 0 ? -roundUpNice(Math.abs(dataMin)) : 0,
    max: roundUpNice(dataMax * 1.05),
  };
};

const trimTrailingZeros = (fixed: string): string => fixed.replace(/\.?0+$/, "");

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

const DURATION_FORMAT_PANEL_IDS = new Set<string>([STREAMING_PANELS.timeSinceLastEvent]);

/** Panels whose Y-axis values are seconds and should show an "s" suffix. */
const SECONDS_SUFFIX_AXIS_PANEL_IDS = new Set<string>([
  STREAMING_PANELS.sourceLag,
  SNAPSHOT_PANELS.snapshotDuration,
]);

const formatDecimal = (value: number, decimals: number): string =>
  trimTrailingZeros(value.toFixed(decimals));

/** Adaptive duration labels for chart Y-axis ticks (e.g. 45s, 12m, 5.2h). */
export const formatDurationAxis = (tick: number | string): string => {
  const value = Number(tick);
  if (!Number.isFinite(value) || value <= 0) {
    return "0s";
  }

  if (value < 1) {
    return `${formatDecimal(value, 1)}s`;
  }

  if (value < SECONDS_PER_MINUTE) {
    return `${Math.round(value)}s`;
  }

  if (value < SECONDS_PER_HOUR) {
    const minutes = value / SECONDS_PER_MINUTE;
    return Number.isInteger(minutes) ? `${minutes}m` : `${formatDecimal(minutes, 1)}m`;
  }

  const hours = value / SECONDS_PER_HOUR;
  return Number.isInteger(hours) ? `${hours}h` : `${formatDecimal(hours, 1)}h`;
};

/** Richer duration labels for chart tooltips (e.g. 45.2s, 12m 30s, 5h 13m). */
export const formatDurationTooltip = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0s";
  }

  if (value < SECONDS_PER_MINUTE) {
    return `${formatDecimal(value, 1)}s`;
  }

  if (value < SECONDS_PER_HOUR) {
    const totalSeconds = Math.round(value);
    const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
    const seconds = totalSeconds % SECONDS_PER_MINUTE;
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  }

  const totalSeconds = Math.round(value);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.round((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  if (minutes === SECONDS_PER_MINUTE) {
    return `${hours + 1}h`;
  }
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};

export const usesDurationAxisFormat = (panelId: string): boolean =>
  DURATION_FORMAT_PANEL_IDS.has(panelId);

export const getYAxisTickFormat = (
  panelId: string
): ((tick: number | string) => string) => {
  if (usesDurationAxisFormat(panelId)) {
    return formatDurationAxis;
  }
  if (SECONDS_SUFFIX_AXIS_PANEL_IDS.has(panelId)) {
    return formatSecondsAxis;
  }
  return formatYAxisTick;
};

export const getChartTooltipFormat = (panelId: string): ((value: number) => string) => {
  if (usesDurationAxisFormat(panelId)) {
    return formatDurationTooltip;
  }
  if (SECONDS_SUFFIX_AXIS_PANEL_IDS.has(panelId)) {
    return formatSecondsTooltip;
  }
  return formatChartTooltipValue;
};

/** Format numbers with at most 3 decimal places; use K suffix above 999. */
const formatCompactNumber = (value: number): string => {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 1000) {
    return `${sign}${trimTrailingZeros((absValue / 1000).toFixed(3))}K`;
  }

  return `${sign}${trimTrailingZeros(absValue.toFixed(3))}`;
};

/** Format Y-axis ticks with at most 3 decimal places. */
export const formatYAxisTick = (tick: number | string): string => {
  const value = Number(tick);
  if (!Number.isFinite(value)) {
    return String(tick);
  }

  if (value === 0) {
    return "0";
  }

  return formatCompactNumber(value);
};

/** Y-axis ticks with an "s" suffix (e.g. 45s, 1.5Ks). */
export const formatSecondsAxis = (tick: number | string): string => {
  const base = formatYAxisTick(tick);
  return base === "0" ? "0s" : `${base}s`;
};

/** Tooltip values with an "s" suffix (e.g. 45s, 1.5Ks). */
export const formatSecondsTooltip = (value: number): string => formatSecondsAxis(value);

export const formatChartTooltipValue = (value: number): string =>
  formatYAxisTick(value);

export const formatValueWithUnit = (value: number, unit: string): string => {
  if (unit === "%") {
    return `${value.toFixed(1)}%`;
  }
  if (unit === "s") {
    return `${value.toFixed(1)}s`;
  }
  if (unit === "tables") {
    return `${value.toFixed(0)}`;
  }
  if (unit === "events/s" || unit === "transactions/s") {
    return `${value.toFixed(2)}`;
  }
  return value.toFixed(2);
};

export const getPanelEmptyMessage = (panelId: string): string =>
  PANEL_EMPTY_MESSAGES[panelId] ?? "";

export const computeSnapshotTableProgress = (
  totalRaw: number | null,
  remainingRaw: number | null
): {
  total: number;
  remaining: number;
  completed: number;
  progressPercent: number;
} => {
  const total = Math.max(0, totalRaw ?? 0);
  const remaining = Math.min(Math.max(0, remainingRaw ?? 0), total);
  const completed = Math.max(0, total - remaining);
  const progressPercent = total > 0 ? (completed / total) * 100 : 0;

  return { total, remaining, completed, progressPercent };
};

export const panelSeriesEqual = (
  a?: PanelQueryResponse,
  b?: PanelQueryResponse
): boolean => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return JSON.stringify(a.series) === JSON.stringify(b.series);
};
