import * as React from "react";
import { useLocation } from "react-router-dom";
import { FeatureGate } from "@components/FeatureGate";
import { fetchAlertStatus } from "../../apis/alerts";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import { AlertStatusResponse, NotificationChannel } from "./alertsTypes";
import { initialChannels } from "./alertsMockData";
import AlertRules from "./AlertRules";
import AlertChannels from "./AlertChannels";
import AlertHistory from "./AlertEvents";
import "./Alerts.css";

type AlertsTab = "rules" | "channels" | "history";

// Sub-navigation between Rules/Channels/History now lives in the sidebar
// (NavExpandable), so the active tab is derived from the URL rather than
// owned as local state.
const getActiveTab = (pathname: string): AlertsTab => {
  if (pathname.endsWith("/channels")) return "channels";
  if (pathname.endsWith("/history")) return "history";
  return "rules";
};

const Alerts: React.FunctionComponent = () => {
  const location = useLocation();
  const activeTab = getActiveTab(location.pathname);

  // Channels remain a POC data layer: hardcoded local state seeded from
  // alertsMockData.ts, standing in for GET/POST/PUT/DELETE /api/alerts/channels
  // until that part of the integration lands. Rules and History talk to the
  // live /api/alerts/rules|events|status endpoints.
  const [channels, setChannels] = React.useState<NotificationChannel[]>(initialChannels);

  const { data: alertStatus } = useResourceQuery<AlertStatusResponse, Error>(
    ["alertStatus"],
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
      {activeTab === "channels" && (
        <AlertChannels channels={channels} setChannels={setChannels} />
      )}
      {activeTab === "history" && <AlertHistory />}
    </FeatureGate>
  );
};

export { Alerts };
