import * as React from "react";
import { useLocation } from "react-router-dom";
import { FeatureGate } from "@components/FeatureGate";
import { ALERT_STATUS_QUERY_KEY, fetchAlertStatus } from "../../apis/alerts";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import { AlertStatusResponse } from "./alertsTypes";
import AlertRules from "./AlertRules";
import AlertChannels from "./AlertChannels";
import AlertHistory from "./AlertEvents";
import "./Alerts.css";

type AlertsTab = "rules" | "channels" | "history";


const getActiveTab = (pathname: string): AlertsTab => {
  if (pathname.endsWith("/channels")) return "channels";
  if (pathname.endsWith("/rules")) return "rules";
  return "history";
};

const Alerts: React.FunctionComponent = () => {
  const location = useLocation();
  const activeTab = getActiveTab(location.pathname);

  const { data: alertStatus } = useResourceQuery<AlertStatusResponse, Error>(
    ALERT_STATUS_QUERY_KEY,
    fetchAlertStatus
  );

  const firingRuleIds = React.useMemo(
    () =>
      new Set(
        (alertStatus?.activeAlerts ?? [])
          .filter((alert) => alert.state === "FIRING")
          .map((alert) => alert.ruleId)
      ),
    [alertStatus]
  );

  return (
    <FeatureGate flag="Alerts">
      {activeTab === "rules" && <AlertRules firingRuleIds={firingRuleIds} />}
      {activeTab === "channels" && <AlertChannels />}
      {activeTab === "history" && <AlertHistory />}
    </FeatureGate>
  );
};

export { Alerts };
