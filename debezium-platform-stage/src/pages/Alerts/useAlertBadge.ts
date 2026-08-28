import { LabelStatus } from "@patternfly/react-core";
import { ALERT_STATUS_QUERY_KEY, fetchAlertStatus } from "../../apis/alerts";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import { isFeatureEnabled } from "@utils/featureFlag";
import { AlertStatusResponse } from "./alertsTypes";

export type AlertBadgeTone = "critical" | "warning" | "idle";

export const ALERTS_DEFAULT_PATH = "/alerts/history";
export const FIRING_ALERTS_PATH = `${ALERTS_DEFAULT_PATH}?status=FIRING`;

export const getAlertBadgePresentation = (
  status: AlertStatusResponse | undefined
): { count: number; tone: AlertBadgeTone } => {
  const critical = status?.firingBySeverity?.CRITICAL ?? 0;
  const warning = status?.firingBySeverity?.WARNING ?? 0;
  const count = critical + warning;
  if (critical > 0) {
    return { count, tone: "critical" };
  }
  if (warning > 0) {
    return { count, tone: "warning" };
  }
  return { count: 0, tone: "idle" };
};

export const getAlertBadgeLabelStatus = (
  tone: AlertBadgeTone
): LabelStatus | undefined => {
  if (tone === "critical") {
    return LabelStatus.danger;
  }
  if (tone === "warning") {
    return LabelStatus.warning;
  }
  return undefined;
};

export const getAlertBadgeAriaLabel = (count: number): string => {
  if (count > 0) {
    return `${count} firing alerts`;
  }
  return "No firing critical or warning alerts";
};

export const getAlertNavPath = (hasFiringAlerts: boolean): string =>
  hasFiringAlerts ? FIRING_ALERTS_PATH : ALERTS_DEFAULT_PATH;

export const useAlertBadge = () => {
  const enabled = isFeatureEnabled("Alerts");
  const { data } = useResourceQuery<AlertStatusResponse, Error>(
    ALERT_STATUS_QUERY_KEY,
    fetchAlertStatus,
    { enabled }
  );
  const { count, tone } = getAlertBadgePresentation(data);
  const isClickable = tone !== "idle";

  return {
    enabled,
    count,
    tone,
    labelStatus: getAlertBadgeLabelStatus(tone),
    ariaLabel: getAlertBadgeAriaLabel(count, tone),
    isClickable,
    navPath: getAlertNavPath(isClickable),
  };
};
