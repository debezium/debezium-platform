export type ApiRequestFailureKind = "http" | "network";

export type ErrorBodyField = "violations" | "details" | "error" | "message";

export type RequestOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  cache?: RequestCache;
  /** Successful body. Defaults to JSON, matching `response.json()`. */
  responseType?: "json" | "text" | "blob" | "void";
  /**
   * Empty successful JSON. `"throw"` matches `response.json()`.
   * `"null"` matches callers that treat an empty body as no content.
   */
  emptyBody?: "throw" | "null";
};

type ApiRequestErrorInit = {
  kind: ApiRequestFailureKind;
  status: number;
  statusText: string;
  body: unknown;
  contentType: string | null;
  parsedJson: boolean;
  text: string;
  message: string;
  cause?: unknown;
};

type ParsedErrorBody = {
  body: unknown;
  contentType: string | null;
  parsedJson: boolean;
  text: string;
};

const DEFAULT_ERROR_FIELDS = ["violations", "details", "error", "message"] as const;

/**
 * Failure from {@link request}.
 *
 * `status` is the HTTP status, or `0` when `fetch` itself rejected (`kind: "network"`).
 * `body` is the parsed JSON value when the response was JSON, otherwise the raw text.
 * `message` is a display string taken from that body. 401 and 403 stay distinguishable
 * so a later auth layer can re-authenticate on 401 and name the missing permission on 403.
 */
export class ApiRequestError extends Error {
  readonly kind: ApiRequestFailureKind;
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  readonly contentType: string | null;
  readonly parsedJson: boolean;
  readonly text: string;
  readonly cause?: unknown;

  constructor(init: ApiRequestErrorInit) {
    super(init.message);
    this.name = "ApiRequestError";
    this.kind = init.kind;
    this.status = init.status;
    this.statusText = init.statusText;
    this.body = init.body;
    this.contentType = init.contentType;
    this.parsedJson = init.parsedJson;
    this.text = init.text;
    this.cause = init.cause;
  }

  /**
   * The same failure carrying a different display message. Used where a caller
   * words the message its own way but `status` must survive, so a later auth
   * layer can still tell a 403 from any other failure.
   */
  withMessage(message: string): ApiRequestError {
    return new ApiRequestError({
      kind: this.kind,
      status: this.status,
      statusText: this.statusText,
      body: this.body,
      contentType: this.contentType,
      parsedJson: this.parsedJson,
      text: this.text,
      message,
      cause: this.cause,
    });
  }
}

export const isApiRequestError = (error: unknown): error is ApiRequestError =>
  error instanceof ApiRequestError;

export const requestErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const violationMessage = (body: Record<string, unknown>): string | undefined => {
  const violations = body.violations;
  if (!Array.isArray(violations) || violations.length === 0) {
    return undefined;
  }
  const first = violations[0];
  if (!first || typeof first !== "object") {
    return undefined;
  }
  const record = first as Record<string, unknown>;
  return `${String(record.field)}:${String(record.message)}`;
};

const readErrorField = (
  body: Record<string, unknown>,
  field: ErrorBodyField
): string | undefined => {
  switch (field) {
    case "violations":
      return violationMessage(body);
    case "details": {
      const details = body.details;
      if (!Array.isArray(details) || details.length === 0 || details[0] == null) {
        return undefined;
      }
      const first = String(details[0]);
      return first || undefined;
    }
    case "error":
    case "message": {
      const value = body[field];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      return undefined;
    }
  }
};

/** First display string found on a parsed error body, in the given field order. */
export const errorBodyMessage = (
  body: unknown,
  fields: readonly ErrorBodyField[]
): string | undefined => {
  if (!isRecord(body)) {
    return undefined;
  }
  for (const field of fields) {
    const text = readErrorField(body, field);
    if (text) {
      return text;
    }
  }
  return undefined;
};

const displayMessage = (parsed: ParsedErrorBody, statusText: string): string => {
  if (parsed.parsedJson) {
    const fromBody = errorBodyMessage(parsed.body, DEFAULT_ERROR_FIELDS);
    if (fromBody) {
      return fromBody;
    }
    if (typeof parsed.body === "string" && parsed.body) {
      return parsed.body;
    }
  } else if (parsed.text.trim()) {
    return parsed.text;
  }
  return statusText || "Request failed";
};

/**
 * Read the error body as text, then parse it as JSON if it is JSON. Reading the
 * body is safe here rather than on a `clone()`: the caller turns this into a
 * thrown error and never looks at the response again.
 */
const parseErrorResponse = async (response: Response): Promise<ParsedErrorBody> => {
  const contentType = response.headers.get("content-type");
  const empty: ParsedErrorBody = { body: null, parsedJson: false, text: "", contentType };

  let text: string;
  try {
    text = await response.text();
  } catch {
    return empty;
  }
  if (!text) {
    return empty;
  }

  try {
    return { body: JSON.parse(text) as unknown, parsedJson: true, text, contentType };
  } catch {
    return { body: text, parsedJson: false, text, contentType };
  }
};

const networkFailure = (cause: unknown): ApiRequestError => {
  const message =
    cause instanceof Error && cause.message
      ? cause.message
      : "Network or unexpected error";
  return new ApiRequestError({
    kind: "network",
    status: 0,
    statusText: "Network or unexpected error",
    body: message,
    contentType: null,
    parsedJson: false,
    text: "",
    message,
    cause,
  });
};

const httpFailure = async (response: Response): Promise<ApiRequestError> => {
  const parsed = await parseErrorResponse(response);
  const { statusText } = response;
  return new ApiRequestError({
    kind: "http",
    status: response.status,
    statusText,
    body: parsed.body,
    contentType: parsed.contentType,
    parsedJson: parsed.parsedJson,
    text: parsed.text,
    message: displayMessage(parsed, statusText),
  });
};

const readJson = async <T>(
  response: Response,
  emptyBody: "throw" | "null"
): Promise<T> => {
  if (emptyBody === "throw") {
    return (await response.json()) as T;
  }
  const text = await response.text();
  return (text ? (JSON.parse(text) as T) : null) as T;
};

const readBody = <T>(response: Response, options: RequestOptions): Promise<T> => {
  switch (options.responseType ?? "json") {
    case "void":
      return Promise.resolve(undefined as T);
    case "text":
      return response.text() as Promise<T>;
    case "blob":
      return response.blob() as Promise<T>;
    case "json":
      return readJson<T>(response, options.emptyBody ?? "throw");
  }
};

/** Sets Authorization on `headers` here, for every call in the app. */
const buildInit = (options: RequestOptions): RequestInit => {
  const init: RequestInit = { headers: new Headers(options.headers) };

  if (options.method !== undefined) {
    init.method = options.method;
  }
  if (options.body !== undefined) {
    init.body = options.body;
  }
  if (options.cache !== undefined) {
    init.cache = options.cache;
  }

  return init;
};

export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, buildInit(options));
  } catch (cause) {
    throw networkFailure(cause);
  }

  if (!response.ok) {
    throw await httpFailure(response);
  }

  return readBody<T>(response, options);
}

/**
 * The underlying failure for logging: the original throw, not our wrapper.
 *
 * Every call in this client now signals failure by throwing {@link ApiRequestError},
 * so there is one error contract and nothing flattens a status into a string.
 */
export const causeOf = (error: unknown): unknown =>
  error instanceof ApiRequestError ? (error.cause ?? error) : error;
