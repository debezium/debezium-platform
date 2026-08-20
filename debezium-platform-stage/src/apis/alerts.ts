import { API_URL } from "../utils/constants";
import { ApiResponse, deleteData, fetchData } from "./apis";
import {
  AlertChannelTestResponse,
  AlertEventStatus,
  AlertRule,
  AlertRuleRequest,
  AlertSeverity,
  AlertStatusResponse,
  NotificationChannel,
  NotificationChannelRequest,
  PagedAlertEventResponse,
} from "../pages/Alerts/alertsTypes";

export const DEFAULT_ALERT_EVENTS_PAGE = 0;
export const DEFAULT_ALERT_EVENTS_PAGE_SIZE = 20;

export const ALERT_RULES_QUERY_KEY = ["alertRules"] as const;
export const ALERT_CHANNELS_QUERY_KEY = ["alertChannels"] as const;

export interface AlertEventsQueryParams {
  /** Defaults to 0 */
  page?: number;
  /** Defaults to 20 */
  size?: number;
  severity?: AlertSeverity[];
  status?: AlertEventStatus[];
  pipelineId?: string[];
  ruleId?: number[];
  /** ISO-8601 timestamps. */
  from?: string;
  to?: string;
}

const buildAlertEventsSearchParams = (
  params: AlertEventsQueryParams
): URLSearchParams => {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? DEFAULT_ALERT_EVENTS_PAGE));
  searchParams.set("size", String(params.size ?? DEFAULT_ALERT_EVENTS_PAGE_SIZE));

  // Repeated-param style for multi-select filters, e.g. severity=CRITICAL&severity=WARNING.
  params.severity?.forEach((value) => searchParams.append("severity", value));
  params.status?.forEach((value) => searchParams.append("status", value));
  params.pipelineId?.forEach((value) => searchParams.append("pipelineId", value));
  params.ruleId?.forEach((value) => searchParams.append("ruleId", String(value)));

  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);

  return searchParams;
};

const parseApiError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const errJson = await response.json();
    if (errJson?.details?.length > 0) return errJson.details[0];
    if (errJson?.error) return errJson.error;
    if (errJson?.message) return errJson.message;
  } catch {
    // ignore non-JSON error bodies
  }
  return `${fallback}: ${response.statusText}`;
};

const sendJson = async <T>(
  url: string,
  method: "POST" | "PUT",
  payload: unknown,
  fallback: string
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { error: await parseApiError(response, fallback) };
    }

    const text = await response.text();
    const data = text ? (JSON.parse(text) as T) : null;
    return { data };
  } catch (error) {
    console.error(fallback, error);
    return { error: fallback };
  }
};

export const fetchAlertEvents = (
  params: AlertEventsQueryParams
): Promise<PagedAlertEventResponse> => {
  const searchParams = buildAlertEventsSearchParams(params);
  return fetchData<PagedAlertEventResponse>(
    `${API_URL}/api/alerts/events?${searchParams.toString()}`
  );
};

export const fetchAlertStatus = (): Promise<AlertStatusResponse> =>
  fetchData<AlertStatusResponse>(`${API_URL}/api/alerts/status`);

/** `id`/`name` projection used by the History rule typeahead. */
export type AlertRuleSummary = Pick<AlertRule, "id" | "name">;

export const fetchAlertRules = (): Promise<AlertRule[]> =>
  fetchData<AlertRule[]>(`${API_URL}/api/alerts/rules`);

export const fetchAlertChannels = (): Promise<NotificationChannel[]> =>
  fetchData<NotificationChannel[]>(`${API_URL}/api/alerts/channels`);

export const createAlertChannel = (
  payload: NotificationChannelRequest
): Promise<ApiResponse<NotificationChannel>> =>
  sendJson<NotificationChannel>(
    `${API_URL}/api/alerts/channels`,
    "POST",
    payload,
    "Failed to create notification channel"
  );

export const updateAlertChannel = (
  id: number,
  payload: NotificationChannelRequest
): Promise<ApiResponse<NotificationChannel>> =>
  sendJson<NotificationChannel>(
    `${API_URL}/api/alerts/channels/${id}`,
    "PUT",
    payload,
    "Failed to update notification channel"
  );

export const deleteAlertChannel = (id: number): Promise<void> =>
  deleteData(`${API_URL}/api/alerts/channels/${id}`);

export const testAlertChannel = (
  id: number
): Promise<ApiResponse<AlertChannelTestResponse>> =>
  sendJson<AlertChannelTestResponse>(
    `${API_URL}/api/alerts/channels/${id}/test`,
    "POST",
    {},
    "Failed to send test notification"
  );

export const createAlertRule = (
  payload: AlertRuleRequest
): Promise<ApiResponse<AlertRule>> =>
  sendJson<AlertRule>(`${API_URL}/api/alerts/rules`, "POST", payload, "Failed to create alert rule");

export const updateAlertRule = (
  id: number,
  payload: AlertRuleRequest
): Promise<ApiResponse<AlertRule>> =>
  sendJson<AlertRule>(
    `${API_URL}/api/alerts/rules/${id}`,
    "PUT",
    payload,
    "Failed to update alert rule"
  );

export const setAlertRuleEnabled = (
  id: number,
  enabled: boolean
): Promise<ApiResponse<AlertRule>> =>
  sendJson<AlertRule>(
    `${API_URL}/api/alerts/rules/${id}/${enabled ? "enable" : "disable"}`,
    "PUT",
    {},
    `Failed to ${enabled ? "enable" : "disable"} alert rule`
  );

export const deleteAlertRule = (id: number): Promise<void> =>
  deleteData(`${API_URL}/api/alerts/rules/${id}`);
