/**
 * Time Range Utilities for Pipeline Monitoring
 * 
 * Provides functions to calculate time ranges, format timestamps,
 * and determine appropriate step resolutions for monitoring queries.
 */

export type TimeRangePreset =
  | "Last 5 minutes"
  | "Last 15 minutes"
  | "Last 30 minutes"
  | "Last 1 hour"
  | "Last 3 hours"
  | "Last 6 hours"
  | "Last 12 hours"
  | "Last 24 hours"
  | "Custom";

export type RefreshInterval =
  | "Off"
  | "5 seconds"
  | "10 seconds"
  | "15 seconds"
  | "30 seconds"
  | "1 minute"
  | "5 minutes";

export interface CalculatedTimeRange {
  start: string; // ISO 8601 format
  end: string;   // ISO 8601 format
  step: string;  // Duration format (e.g., "15s", "1m")
}

/**
 * Calculate time range based on preset selection
 * @param preset - The time range preset (e.g., "Last 5 minutes")
 * @returns Object with start, end (ISO 8601), and suggested step
 */
export const calculateTimeRange = (preset: TimeRangePreset): CalculatedTimeRange => {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  let step: string;

  switch (preset) {
    case "Last 5 minutes":
      start = new Date(now.getTime() - 5 * 60 * 1000);
      step = "15s";
      break;
    case "Last 15 minutes":
      start = new Date(now.getTime() - 15 * 60 * 1000);
      step = "15s";
      break;
    case "Last 30 minutes":
      start = new Date(now.getTime() - 30 * 60 * 1000);
      step = "30s";
      break;
    case "Last 1 hour":
      start = new Date(now.getTime() - 60 * 60 * 1000);
      step = "1m";
      break;
    case "Last 3 hours":
      start = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      step = "5m";
      break;
    case "Last 6 hours":
      start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      step = "10m";
      break;
    case "Last 12 hours":
      start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      step = "30m";
      break;
    case "Last 24 hours":
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      step = "1h";
      break;
    default:
      // Default to last 5 minutes
      start = new Date(now.getTime() - 5 * 60 * 1000);
      step = "15s";
  }

  return {
    start: start.toISOString(),
    end,
    step,
  };
};

/**
 * Format a Date object to ISO 8601 string for API
 * @param date - The date to format
 * @returns ISO 8601 formatted string
 */
export const formatTimeForAPI = (date: Date): string => {
  return date.toISOString();
};

/**
 * Calculate appropriate step resolution based on time range duration
 * @param startTime - Start time in ISO 8601 format
 * @param endTime - End time in ISO 8601 format
 * @returns Suggested step duration (e.g., "15s", "1m")
 */
export const getStepResolution = (startTime: string, endTime: string): string => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();
  const durationMinutes = durationMs / (60 * 1000);

  if (durationMinutes <= 15) {
    return "15s";
  } else if (durationMinutes <= 30) {
    return "30s";
  } else if (durationMinutes <= 60) {
    return "1m";
  } else if (durationMinutes <= 180) {
    return "5m";
  } else if (durationMinutes <= 360) {
    return "10m";
  } else if (durationMinutes <= 720) {
    return "30m";
  } else {
    return "1h";
  }
};

/**
 * Parse refresh interval string to milliseconds
 * @param interval - Refresh interval string (e.g., "15 seconds")
 * @returns Interval in milliseconds, or null if "Off"
 */
export const parseRefreshInterval = (interval: RefreshInterval): number | null => {
  switch (interval) {
    case "Off":
      return null;
    case "5 seconds":
      return 5000;
    case "10 seconds":
      return 10000;
    case "15 seconds":
      return 15000;
    case "30 seconds":
      return 30000;
    case "1 minute":
      return 60000;
    case "5 minutes":
      return 300000;
    default:
      return null;
  }
};

/**
 * Convert datetime-local input value to ISO 8601 string
 * @param datetimeLocal - Value from datetime-local input (e.g., "2026-06-23T10:00")
 * @returns ISO 8601 formatted string
 */
export const datetimeLocalToISO = (datetimeLocal: string): string => {
  const date = new Date(datetimeLocal);
  return date.toISOString();
};

/**
 * Convert ISO 8601 string to datetime-local input value
 * @param isoString - ISO 8601 formatted string
 * @returns Value for datetime-local input (e.g., "2026-06-23T10:00")
 */
export const isoToDatetimeLocal = (isoString: string): string => {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Format timestamp for chart display
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted time string (e.g., "10:30:45")
 */
export const formatChartTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
};

/**
 * Format timestamp for chart display (short version without seconds)
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted time string (e.g., "10:30")
 */
export const formatChartTimestampShort = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};
