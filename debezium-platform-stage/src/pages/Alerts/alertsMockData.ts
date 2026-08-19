// Hardcoded, in-memory seed data for the Alerting POC.
//
// Channels don't have their Conductor backend (/api/alerts/channels) wired up
// yet, so that page is still exercised with local React state seeded from the
// fixtures below. Rules and History talk to the real /api/alerts/rules|events|status
// endpoints.

import { NotificationChannel } from "./alertsTypes";

export const initialChannels: NotificationChannel[] = [
  {
    id: 1,
    name: "ops-email",
    type: "EMAIL",
    config: {
      recipients: ["ops@example.com", "oncall@example.com"],
      subjectTemplate: "Debezium Alert: {{rule_name}} - {{severity}}",
    },
    enabled: true,
    createdAt: "2026-07-20T09:00:00Z",
    updatedAt: "2026-07-20T09:00:00Z",
  },
  {
    id: 2,
    name: "slack-webhook",
    type: "WEBHOOK",
    config: {
      url: "https://hooks.slack.com/services/T00000/B00000/xxxxxxxxxxxx",
      method: "POST",
      headers: { Authorization: "Bearer <redacted>" },
    },
    enabled: true,
    createdAt: "2026-07-20T09:05:00Z",
    updatedAt: "2026-07-20T09:05:00Z",
  },
];
