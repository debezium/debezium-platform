import * as React from "react";
import { Label, LabelColor, LabelStatus } from "@patternfly/react-core";
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InfoCircleIcon,
} from "@patternfly/react-icons";
import {
  AlertOperator,
  AlertSeverity,
  FOR_DURATION_OPTIONS,
  OPERATOR_OPTIONS,
  ReduceFunction,
  REDUCE_FUNCTION_OPTIONS,
  secondsToIsoDuration,
} from "./alertsTypes";
import { Severity, SeverityType } from "@patternfly/react-component-groups";
import { capitalize } from "lodash";

const SEVERITY_META: Record<
  AlertSeverity,
  { status: LabelStatus; icon: React.ReactElement; label: string, color: LabelColor }
> = {
  CRITICAL: {
    status: LabelStatus.danger,
    icon: <ExclamationCircleIcon />,
    label: "Critical",
    color: LabelColor.red
  },
  WARNING: {
    status: LabelStatus.warning,
    icon: <ExclamationTriangleIcon />,
    label: "Warning",
    color: LabelColor.yellow
  },
  INFO: {
    status: LabelStatus.info,
    icon: <InfoCircleIcon />,
    label: "Info",
    color: LabelColor.blue
  },
};

const SEVERITY_ICON: Record<
  AlertSeverity,
  { label: SeverityType }
> = {
  CRITICAL: {
    label: "critical",
  },
  WARNING: {
    label: "moderate",
  },
  INFO: {
    label: "none",
  },
};

export const getSeverityMeta = (severity: AlertSeverity) => SEVERITY_META[severity];

export const getSeverityIcon = (severity: AlertSeverity) => SEVERITY_ICON[severity];

export const SeverityLabel: React.FC<{ severity: AlertSeverity; isCompact?: boolean }> = ({
  severity,
  isCompact,
}) => {
  const meta = getSeverityMeta(severity);
  return (
   <Label  
  //  color={meta.color}
  status={meta.status}
    icon={meta.icon} isCompact={isCompact}>
      {meta.label}
    </Label>
  );
};

export const SeverityIcon: React.FC<{ severity: AlertSeverity; isCompact?: boolean }> = ({
  severity,
  isCompact,
}) => {
  const meta = getSeverityIcon(severity);
  return (
    isCompact ? <Severity severity={meta.label} label=""/>  : <Severity severity={meta.label} label={capitalize(severity)} />
  );
};

export const getOperatorSymbol = (operator: AlertOperator) =>
  OPERATOR_OPTIONS.find((o) => o.value === operator)?.symbol ?? operator;

export const getOperatorLabel = (operator: AlertOperator) =>
  OPERATOR_OPTIONS.find((o) => o.value === operator)?.label ?? operator;

export const getReduceLabel = (reduceFunction: ReduceFunction) =>
  REDUCE_FUNCTION_OPTIONS.find((o) => o.value === reduceFunction)?.label ?? reduceFunction;

export const getDurationShortLabel = (duration: string) =>
  FOR_DURATION_OPTIONS.find((o) => o.value === duration)?.shortLabel ?? duration;

export const getDurationLabel = (duration: string) =>
  FOR_DURATION_OPTIONS.find((o) => o.value === duration)?.label ?? duration;

/** Formats a rule's condition, e.g. "last > 10 for 5m". */
export const formatCondition = (rule: {
  reduceFunction: ReduceFunction;
  operator: AlertOperator;
  threshold: number;
  forDuration: number;
}) => {
  const reduce = getReduceLabel(rule.reduceFunction);
  const symbol = getOperatorSymbol(rule.operator);
  const isoDuration = secondsToIsoDuration(rule.forDuration);
  const forLabel = getDurationShortLabel(isoDuration);
  const forSuffix = rule.forDuration === 0 ? "" : ` for ${forLabel}`;
  return `${reduce} ${symbol} ${rule.threshold}${forSuffix}`;
};

export const formatDurationSeconds = (totalSeconds: number, ongoing: boolean) => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  let text: string;
  if (hours > 0) {
    text = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    text = `${minutes}m`;
  } else {
    text = `${secs}s`;
  }

  return ongoing ? `${text} (ongoing)` : text;
};

export const formatDateTime = (iso: string | null) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
};
