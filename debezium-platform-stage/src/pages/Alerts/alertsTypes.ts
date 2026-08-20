// Types mirror the Conductor alerting REST contracts (`/api/alerts/*`).
// `forDuration` and `evaluationWindow` are durations in seconds on the wire
// (Jackson serializes `java.time.Duration` as a fractional-second number).
// The form still uses ISO-8601 option values (`PT5M`); convert at the API boundary
// with `isoDurationToSeconds` / `secondsToIsoDuration`.

export type AlertOperator =
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUAL"
  | "EQUAL"
  | "NOT_EQUAL";

export type ReduceFunction = "LAST" | "AVG" | "MIN" | "MAX" | "SUM";

export type AlertSeverity = "CRITICAL" | "WARNING" | "INFO";

export type NotificationChannelType = "EMAIL" | "WEBHOOK";

export interface NotificationChannelRef {
  id: number;
  name: string;
  type: NotificationChannelType;
}

/** Response body of `GET/POST/PUT /api/alerts/rules`. */
export interface AlertRule {
  id: number;
  name: string;
  description?: string | null;
  panelId: string;
  panelTitle: string;
  operator: AlertOperator;
  threshold: number;
  /** Duration in seconds. */
  forDuration: number;
  reduceFunction: ReduceFunction;
  /** Duration in seconds. Ignored by the backend when `reduceFunction` is `LAST`. */
  evaluationWindow: number;
  severity: AlertSeverity;
  enabled: boolean;
  channels: NotificationChannelRef[];
  createdAt: string;
  updatedAt: string;
}

/** Create/update request body of `POST/PUT /api/alerts/rules`. */
export interface AlertRuleRequest {
  name: string;
  description?: string;
  panelId: string;
  operator: AlertOperator;
  threshold: number;
  /** Duration in seconds. */
  forDuration: number;
  reduceFunction: ReduceFunction;
  /** Duration in seconds. */
  evaluationWindow: number;
  severity: AlertSeverity;
  enabled: boolean;
  channelIds: number[];
}

export interface EmailChannelConfig {
  recipients: string[];
  /** Optional prefix prepended to the alert email subject. */
  subjectPrefix?: string;
}

export interface WebhookChannelConfig {
  url: string;
  method: "POST" | "PUT";
  headers?: Record<string, string>;
}

export type NotificationChannelConfig = EmailChannelConfig | WebhookChannelConfig;

/** Response body of `GET/POST/PUT /api/alerts/channels`. */
export interface NotificationChannel {
  id: number;
  name: string;
  type: NotificationChannelType;
  config: NotificationChannelConfig;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Create/update request body of `POST/PUT /api/alerts/channels`. */
export interface NotificationChannelRequest {
  name: string;
  type: NotificationChannelType;
  config: NotificationChannelConfig;
  enabled: boolean;
}

/** Response body of `POST /api/alerts/channels/{id}/test`. */
export interface AlertChannelTestResponse {
  success: boolean;
  message: string;
}

export type AlertEventStatus = "FIRING" | "RESOLVED";

export interface AlertEvent {
  id: number;
  ruleId: number;
  ruleName: string;
  pipelineId: string;
  pipelineName: string;
  status: AlertEventStatus;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  message: string;
  firedAt: string;
  resolvedAt: string | null;
  durationSeconds: number;
  createdAt: string;
}

// ---- GET /api/alerts/events (paginated) ----

export interface PagedAlertEventResponse {
  events: AlertEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ---- GET /api/alerts/status ----

export type ActiveAlertState = "FIRING" | "PENDING";

export interface ActiveAlert {
  ruleId: number;
  ruleName: string;
  pipelineId: string;
  state: ActiveAlertState;
  severity: AlertSeverity;
  value: number;
  threshold: number;
  since: string;
}

export interface AlertStatusResponse {
  totalFiring: number;
  totalPending: number;
  firingBySeverity: Record<AlertSeverity, number>;
  activeAlerts: ActiveAlert[];
}

// ---- Static, frontend-owned option lists (per DDD-57: "not provided by a platform API endpoint") ----

export const OPERATOR_OPTIONS: { value: AlertOperator; label: string; symbol: string }[] = [
  { value: "GREATER_THAN", label: "greater than", symbol: ">" },
  { value: "GREATER_THAN_OR_EQUAL", label: "greater than or equal to", symbol: "\u2265" },
  { value: "LESS_THAN", label: "less than", symbol: "<" },
  { value: "LESS_THAN_OR_EQUAL", label: "less than or equal to", symbol: "\u2264" },
  { value: "EQUAL", label: "equal to", symbol: "=" },
  { value: "NOT_EQUAL", label: "not equal to", symbol: "\u2260" },
];

export const REDUCE_FUNCTION_OPTIONS: { value: ReduceFunction; label: string }[] = [
  { value: "LAST", label: "last" },
  { value: "AVG", label: "avg" },
  { value: "MIN", label: "min" },
  { value: "MAX", label: "max" },
  { value: "SUM", label: "sum" },
];

export const FOR_DURATION_OPTIONS: { value: string; label: string; shortLabel: string }[] = [
  { value: "PT0S", label: "Immediately", shortLabel: "0m" },
  { value: "PT1M", label: "1 minute", shortLabel: "1m" },
  { value: "PT2M", label: "2 minutes", shortLabel: "2m" },
  { value: "PT5M", label: "5 minutes", shortLabel: "5m" },
  { value: "PT10M", label: "10 minutes", shortLabel: "10m" },
  { value: "PT15M", label: "15 minutes", shortLabel: "15m" },
  { value: "PT30M", label: "30 minutes", shortLabel: "30m" },
];

export const EVALUATION_WINDOW_OPTIONS: { value: string; label: string }[] = [
  { value: "PT1M", label: "1 minute" },
  { value: "PT2M", label: "2 minutes" },
  { value: "PT5M", label: "5 minutes" },
  { value: "PT10M", label: "10 minutes" },
  { value: "PT15M", label: "15 minutes" },
  { value: "PT30M", label: "30 minutes" },
  { value: "PT1H", label: "1 hour" },
];

export const SEVERITY_OPTIONS: AlertSeverity[] =  ["CRITICAL", "WARNING", "INFO"];

const ISO_DURATION_PATTERN = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/;

/** Convert a frontend ISO-8601 duration option (`PT5M`) to seconds for the API. */
export const isoDurationToSeconds = (iso: string): number => {
  const match = iso.match(ISO_DURATION_PATTERN);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
};

/** Convert API duration-in-seconds back to an ISO-8601 string for the form selects. */
export const secondsToIsoDuration = (seconds: number): string => {
  const total = Math.round(seconds);
  if (total === 0) return "PT0S";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  let iso = "PT";
  if (hours) iso += `${hours}H`;
  if (minutes) iso += `${minutes}M`;
  if (secs) iso += `${secs}S`;
  return iso;
};

export const DATE_RANGE_PRESETS = [
  "Last 6 hours",
  "Last 12 hours",
  "Last 24 hours",
  "Custom",
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];
