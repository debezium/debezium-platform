import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FeatureGate } from "@components/FeatureGate";
import { AlertRule, AlertEvent, NotificationChannel } from "./alertsTypes";
import { initialChannels, initialEvents, initialRules } from "./alertsMockData";
import AlertRules from "./AlertRules";
import AlertChannels from "./AlertChannels";
import AlertHistory from "./AlertHistory";
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
  const navigate = useNavigate();
  const activeTab = getActiveTab(location.pathname);

  // POC data layer: hardcoded local state seeded from alertsMockData.ts, standing in for
  // GET/POST/PUT/DELETE /api/alerts/rules|channels|events until the Conductor backend exists.
  const [rules, setRules] = React.useState<AlertRule[]>(initialRules);
  const [channels, setChannels] = React.useState<NotificationChannel[]>(initialChannels);
  const [events] = React.useState<AlertEvent[]>(initialEvents);

  const firingRuleIds = React.useMemo(
    () => new Set(events.filter((e) => e.status === "firing").map((e) => e.ruleId)),
    [events]
  );

  return (
    <FeatureGate flag="Alerts">
      {activeTab === "rules" && (
        <AlertRules
          rules={rules}
          setRules={setRules}
          channels={channels}
          firingRuleIds={firingRuleIds}
          onGoToChannels={() => navigate("/alerts/channels")}
        />
      )}
      {activeTab === "channels" && (
        <AlertChannels channels={channels} setChannels={setChannels} />
      )}
      {activeTab === "history" && <AlertHistory events={events} rules={rules} />}
    </FeatureGate>
  );
};

export { Alerts };
