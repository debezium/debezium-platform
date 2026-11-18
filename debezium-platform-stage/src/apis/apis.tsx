import i18next from "../i18n";
import {
  ApiRequestError,
  causeOf,
  errorBodyMessage,
  isRecord,
  request,
  type ErrorBodyField,
} from "./client";

const createResourceFallback = () =>
  i18next.t("statusMessage:apis.failedToCreateResource");

const updateResourceFallback = () =>
  i18next.t("statusMessage:apis.failedToUpdateResource");

const legacyMessage = (
  error: ApiRequestError,
  fields: readonly ErrorBodyField[],
  fallback: string
): string =>
  (error.parsedJson ? errorBodyMessage(error.body, fields) : undefined) ?? fallback;

const jsonRequest = <T,>(
  url: string,
  method: "POST" | "PUT",
  payload: unknown
): Promise<T> =>
  request<T>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

/**
 * Display wording for a failed write: what the server said when it said anything,
 * otherwise the caller's fallback. A request that never reached the server has no
 * server wording to use, so it gets the bare fallback.
 */
const writeMessage =
  (fields: readonly ErrorBodyField[], fallback: string) =>
  (error: ApiRequestError): string =>
    error.kind === "http"
      ? legacyMessage(error, fields, `${fallback}: ${error.statusText}`)
      : fallback;

/**
 * POST/PUT returning the parsed body.
 *
 * Throws {@link ApiRequestError}: reworded for display, but `status` and `body`
 * survive, so a caller can tell a permission denial from a validation failure.
 * Flattening these to a string would lose what the UI needs to explain a 403.
 */
const writeJson = async <T,>(
  url: string,
  method: "POST" | "PUT",
  payload: unknown,
  message: (error: ApiRequestError) => string
): Promise<T> => {
  try {
    return await jsonRequest<T>(url, method, payload);
  } catch (error) {
    throw error instanceof ApiRequestError ? error.withMessage(message(error)) : error;
  }
};

export const createPost = <T,>(
  url: string,
  payload: unknown,
  fallback = createResourceFallback()
): Promise<T> =>
  writeJson<T>(url, "POST", payload, writeMessage(["details", "error"], fallback));

export const editPut = <T,>(
  url: string,
  payload: unknown,
  fallback = updateResourceFallback()
): Promise<T> =>
  writeJson<T>(url, "PUT", payload, writeMessage(["details", "error"], fallback));

/** GET. Throws {@link ApiRequestError} with status, body, and a display message. */
export const fetchData = <T,>(url: string): Promise<T> => request<T>(url);

/** GET for endpoints answering with plain text rather than JSON, such as logs. */
export const fetchText = (url: string): Promise<string> =>
  request<string>(url, { responseType: "text" });

/**
 * Delete wording differs from the other helpers: it joins `message` and `details`
 * rather than taking the first field, and falls back to the raw body for a
 * non-JSON response. Kept as-is so delete dialogs read the way they already do.
 */
const deleteErrorMessage = (error: ApiRequestError): string => {
  const fallback = `Failed to delete data: ${error.status} ${error.statusText}`;
  const contentType = error.contentType ?? "";

  if (!contentType.includes("application/json")) {
    return error.text || fallback;
  }

  if (!error.parsedJson || !isRecord(error.body)) {
    return fallback;
  }

  const serverMessage = error.body.message || error.body.error;
  const detailsValue = error.body.details;
  const details = Array.isArray(detailsValue) ? detailsValue.join("\n") : detailsValue;
  const message = [serverMessage, details].filter(Boolean).map(String).join(": ");
  return message || fallback;
};

/**
 * DELETE. Throws {@link ApiRequestError}, so `status` survives for callers that
 * need to tell a permission denial from any other failure. `message` keeps the
 * wording delete callers already display.
 */
export const deleteData = async (url: string): Promise<void> => {
  try {
    await request<void>(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      responseType: "void",
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "http") {
      if (!error.parsedJson && (error.contentType ?? "").includes("application/json")) {
        console.error("Error deleting data:", error.text || error.body);
      }
      throw error.withMessage(deleteErrorMessage(error));
    }
    throw causeOf(error);
  }
};

export const fetchFile = async (
  url: string
): Promise<Blob | { error: string }> => {
  try {
    return await request<Blob>(url, { responseType: "blob" });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "http") {
      return { error: `Failed to fetch file: ${error.statusText}` };
    }
    console.error("Error fetching file:", causeOf(error));
    return { error: "An error occurred while fetching the file" };
  }
};

/**
 * Signal-collection verification. 
 *
 * Not a create, so it is deliberately kept off the create mutation hook — it
 * creates no source and must not invalidate the source cache. A negative answer
 * (`{ exists: false }`) is HTTP 200 and resolves normally; only a failed request
 * throws.
 */
export const verifySignals = <T,>(url: string, payload: unknown): Promise<T> =>
  writeJson<T>(
    url,
    "POST",
    payload,
    writeMessage(
      ["violations", "details", "error", "message"],
      "Failed to verify the signals"
    )
  );

