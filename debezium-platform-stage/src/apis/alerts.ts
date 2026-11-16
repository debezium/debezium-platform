import i18next from "../i18n";
import { deleteData, fetchData } from "./apis";
import { ApiRequestError, errorBodyMessage, request } from "./client";
import {
  alertChannelPath,
  alertChannelsPath,
  alertChannelTestPath,
  alertEventsPath,
  alertRuleActionPath,
  alertRulePath,
  alertRulesPath,
  alertStatusPath,
} from "./endpoints";
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
export const ALERT_STATUS_QUERY_KEY = ["alertStatus"] as const;
export const ALERT_EVENTS_QUERY_KEY = ["alertEvents"] as const;


export interface AlertEventsQueryParams {
  /** Defaults to 0 */
  page?: number;
  /** Defaults to 20 */
  size?: number;
  severity?: AlertSeverity[];
  status?: AlertEventStatus[];
  pipelineId?: string[];
  ruleId?: number[];
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

const alertErrorMessage = (error: ApiRequestError, fallback: string): string =>
  (error.parsedJson
    ? errorBodyMessage(error.body, ["details", "error", "message"])
    : undefined) ?? `${fallback}: ${error.statusText}`;

/**
 * Alert writes answer some requests with an empty body, so `null` is a success.
 *
 * Throws {@link ApiRequestError} like every other write, reworded for display but
 * with `status` intact, so an alert action denied by `alert:write` stays tellable
 * from a validation failure.
 */
const sendJson = async <T>(
  url: string,
  method: "POST" | "PUT",
  payload: unknown,
  fallback: string
): Promise<T | null> => {
  try {
    return await request<T | null>(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      emptyBody: "null",
    });
  } catch (error) {
    if (!(error instanceof ApiRequestError)) {
      throw error;
    }
    throw error.withMessage(
      error.kind === "http" ? alertErrorMessage(error, fallback) : fallback
    );
  }
};

export const fetchAlertEvents = (
  params: AlertEventsQueryParams
): Promise<PagedAlertEventResponse> => {
  const searchParams = buildAlertEventsSearchParams(params);
  return fetchData<PagedAlertEventResponse>(alertEventsPath(searchParams.toString()));
};

export const fetchAlertStatus = (): Promise<AlertStatusResponse> =>
  fetchData<AlertStatusResponse>(alertStatusPath());

/** `id`/`name` projection used by the History rule typeahead. */
export type AlertRuleSummary = Pick<AlertRule, "id" | "name">;

const asAlertRuleList = (data: unknown): AlertRule[] =>
  Array.isArray(data) ? (data as AlertRule[]) : [];

export const fetchAlertRules = async (): Promise<AlertRule[]> =>
  asAlertRuleList(await fetchData<unknown>(alertRulesPath()));

export const fetchAlertChannels = (): Promise<NotificationChannel[]> =>
  fetchData<NotificationChannel[]>(alertChannelsPath());

export const createAlertChannel = (
  payload: NotificationChannelRequest
): Promise<NotificationChannel | null> =>
  sendJson<NotificationChannel>(
    alertChannelsPath(),
    "POST",
    payload,
    i18next.t("statusMessage:apis.failedToCreate", { val: "notification channel" })
  );

export const updateAlertChannel = (
  id: number,
  payload: NotificationChannelRequest
): Promise<NotificationChannel | null> =>
  sendJson<NotificationChannel>(
    alertChannelPath(id),
    "PUT",
    payload,
    i18next.t("statusMessage:apis.failedToUpdate", { val: "notification channel" })
  );

export const deleteAlertChannel = (id: number): Promise<void> =>
  deleteData(alertChannelPath(id));

export const testAlertChannel = (
  id: number
): Promise<AlertChannelTestResponse | null> =>
  sendJson<AlertChannelTestResponse>(
    alertChannelTestPath(id),
    "POST",
    {},
    i18next.t("statusMessage:apis.failedToTest")
  );

export const createAlertRule = (
  payload: AlertRuleRequest
): Promise<AlertRule | null> =>
  sendJson<AlertRule>(alertRulesPath(), "POST", payload, "Failed to create alert rule");

export const updateAlertRule = (
  id: number,
  payload: AlertRuleRequest
): Promise<AlertRule | null> =>
  sendJson<AlertRule>(
    alertRulePath(id),
    "PUT",
    payload,
    i18next.t("statusMessage:apis.failedToUpdate", { val: "alert rule" })
  );

export const setAlertRuleEnabled = (
  id: number,
  enabled: boolean
): Promise<AlertRule | null> =>
  sendJson<AlertRule>(
    alertRuleActionPath(id, enabled ? "enable" : "disable"),
    "PUT",
    {},
    enabled ? i18next.t("statusMessage:apis.failedToEnable", { val: "alert rule" }) : i18next.t("statusMessage:apis.failedToDisable", { val: "alert rule" })
  );

export const deleteAlertRule = (id: number): Promise<void> =>
  deleteData(alertRulePath(id));
