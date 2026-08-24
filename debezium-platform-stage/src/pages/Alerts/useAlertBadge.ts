import { NotificationBadgeVariant } from "@patternfly/react-core";
import { ALERT_STATUS_QUERY_KEY, fetchAlertStatus } from "../../apis/alerts";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import { isFeatureEnabled } from "@utils/featureFlag";
import { AlertStatusResponse } from "./alertsTypes";

export type AlertBadgeTone = "critical" | "warning" | "info" | "idle";

export const FIRING_ALERTS_PATH = "/alerts/history?status=FIRING";

export const getAlertBadgePresentation = (
  status: AlertStatusResponse | undefined
): { count: number; tone: AlertBadgeTone } => {
  const critical = status?.firingBySeverity?.CRITICAL ?? 0;
  const warning = status?.firingBySeverity?.WARNING ?? 0;
  const info = status?.firingBySeverity?.INFO ?? 0;
  const count = critical + warning;
  if (critical > 0) {
    return { count, tone: "critical" };
  }
  if (warning > 0) {
    return { count, tone: "warning" };
  }
  if (info > 0) {
    return { count: 0, tone: "info" };
  }
  return { count: 0, tone: "idle" };
};

export const getAlertBadgeVariant = (tone: AlertBadgeTone): NotificationBadgeVariant => {
  if (tone === "critical") {
    return NotificationBadgeVariant.attention;
  }
  if (tone === "info") {
    return NotificationBadgeVariant.unread;
  }
  if (tone === "warning") {
    // No PF warning notification variant; unread chrome is recolored in AppHeader.css.
    return NotificationBadgeVariant.unread;
  }
  return NotificationBadgeVariant.read;
};

export const getAlertBadgeAriaLabel = (count: number, tone: AlertBadgeTone): string => {
  if (count > 0) {
    return `${count} firing alerts`;
  }
  if (tone === "info") {
    return "Info alerts firing";
  }
  return "No firing critical or warning alerts";
};

export const useAlertBadge = () => {
  const enabled = isFeatureEnabled("Alerts");
  const { data } = useResourceQuery<AlertStatusResponse, Error>(
    ALERT_STATUS_QUERY_KEY,
    fetchAlertStatus,
    { enabled }
  );
  const { count, tone } = getAlertBadgePresentation(data);

  return {
    enabled,
    count,
    tone,
    variant: getAlertBadgeVariant(tone),
    ariaLabel: getAlertBadgeAriaLabel(count, tone),
    isClickable: tone !== "idle",
  };
};
