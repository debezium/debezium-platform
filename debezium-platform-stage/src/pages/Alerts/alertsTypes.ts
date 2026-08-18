// Types mirror the REST contracts documented in DDD-57 (Alerting for Debezium Platform).
// The backend for these endpoints does not exist yet - this file is the "contract" the
// mock data layer and forms are built against so swapping in real `fetch` calls later
// (see src/apis/apis.tsx) should not require changing any UI component.

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

export interface AlertRule {
  id: number;
  name: string;
  description?: string;
  panelId: string;
  panelTitle: string;
  panelUnit: string;
  operator: AlertOperator;
  threshold: number;
  forDuration: string;
  reduceFunction: ReduceFunction;
  evaluationWindow: string;
  severity: AlertSeverity;
  enabled: boolean;
  channels: NotificationChannelRef[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailChannelConfig {
  recipients: string[];
  subjectTemplate?: string;
}

export interface WebhookChannelConfig {
  url: string;
  method: "POST" | "PUT";
  headers?: Record<string, string>;
}

export type NotificationChannelConfig = EmailChannelConfig | WebhookChannelConfig;

export interface NotificationChannel {
  id: number;
  name: string;
  type: NotificationChannelType;
  config: NotificationChannelConfig;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AlertEventStatus = "firing" | "resolved";

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

export const SEVERITY_OPTIONS: { value: AlertSeverity; label: string }[] = [
  { value: "CRITICAL", label: "Critical" },
  { value: "WARNING", label: "Warning" },
  { value: "INFO", label: "Info" },
];

export const DATE_RANGE_PRESETS = [
  "Last hour",
  "Last 24 hours",
  "Last 7 days",
  "Last 30 days",
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];
