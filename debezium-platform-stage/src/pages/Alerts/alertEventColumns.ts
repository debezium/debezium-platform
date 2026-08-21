export type AlertEventColumnId =
  | "severity"
  | "rule"
  | "pipeline"
  | "status"
  | "value"
  | "threshold"
  | "firedAt"
  | "resolvedAt"
  | "createdAt"
  | "duration";

export interface AlertEventColumn {
  id: AlertEventColumnId;
  label: string;
}

/** Canonical order when every column is selected. */
export const ALERT_EVENT_COLUMNS: AlertEventColumn[] = [
  { id: "severity", label: "Severity" },
  { id: "rule", label: "Rule" },
  { id: "pipeline", label: "Pipeline" },
  { id: "status", label: "Status" },
  { id: "value", label: "Value" },
  { id: "threshold", label: "Threshold" },
  { id: "firedAt", label: "Fired at" },
  { id: "resolvedAt", label: "Resolved at" },
  { id: "createdAt", label: "Created at" },
  { id: "duration", label: "Duration" },
];

export const DEFAULT_ALERT_EVENT_COLUMN_IDS: AlertEventColumnId[] = [
  "severity",
  "rule",
  "pipeline",
  "status",
  "firedAt",
  "duration",
];
