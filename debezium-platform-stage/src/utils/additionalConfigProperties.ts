/**
 * Shared logic for typed "additional configuration" rows (string, boolean, integer).
 * Intended for Connection now; Source/Destination can reuse the same helpers later.
 */

export type AdditionalPropertyValueKind = "string" | "boolean" | "integer";

export type AdditionalPropertyRow = {
  key: string;
  valueKind: AdditionalPropertyValueKind;
  stringValue: string;
  booleanValue: boolean;
  /** Raw input for integer kind; parsed on validate/submit */
  integerInput: string;
};

export function createEmptyAdditionalPropertyRow(): AdditionalPropertyRow {
  return {
    key: "",
    valueKind: "string",
    stringValue: "",
    booleanValue: false,
    integerInput: "",
  };
}

/** Build row state from an API config entry (flat key → value). */
export function additionalPropertyRowFromApiValue(key: string, value: unknown): AdditionalPropertyRow {
  if (typeof value === "boolean") {
    return {
      key,
      valueKind: "boolean",
      stringValue: "",
      booleanValue: value,
      integerInput: "",
    };
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return {
      key,
      valueKind: "integer",
      stringValue: "",
      booleanValue: false,
      integerInput: String(value),
    };
  }
  if (typeof value === "number") {
    return {
      key,
      valueKind: "integer",
      stringValue: "",
      booleanValue: false,
      integerInput: String(Math.trunc(value)),
    };
  }
  return {
    key,
    valueKind: "string",
    stringValue: value === undefined || value === null ? "" : String(value),
    booleanValue: false,
    integerInput: "",
  };
}

export function mapApiConfigToAdditionalRows(config: Record<string, unknown>): Map<string, AdditionalPropertyRow> {
  const map = new Map<string, AdditionalPropertyRow>();
  let i = 0;
  for (const [k, v] of Object.entries(config)) {
    map.set(`key${i}`, additionalPropertyRowFromApiValue(k, v));
    i++;
  }
  return map;
}

/**
 * When the user changes value kind, reset fields so we do not carry misleading state.
 */
export function additionalRowWithNewValueKind(
  row: AdditionalPropertyRow,
  nextKind: AdditionalPropertyValueKind
): AdditionalPropertyRow {
  if (nextKind === "string") {
    if (row.valueKind === "boolean") {
      return { ...row, valueKind: "string", stringValue: String(row.booleanValue), integerInput: "" };
    }
    if (row.valueKind === "integer") {
      return { ...row, valueKind: "string", stringValue: row.integerInput, integerInput: "" };
    }
    return { ...row, valueKind: "string" };
  }
  if (nextKind === "boolean") {
    return {
      ...row,
      valueKind: "boolean",
      stringValue: "",
      integerInput: "",
      booleanValue: false,
    };
  }
  return {
    ...row,
    valueKind: "integer",
    stringValue: "",
    booleanValue: false,
    integerInput:
      row.valueKind === "integer"
        ? row.integerInput
        : row.valueKind === "string" && row.stringValue !== "" && /^-?\d+$/.test(row.stringValue.trim())
          ? row.stringValue.trim()
          : "",
  };
}

type ParsedContributing =
  | { ok: false; rowId: string; reason: "empty_key" | "empty_value" | "invalid_integer" }
  | { ok: true; rowId: string; key: string; value: string | number | boolean };

/** Blank placeholder row (no validation error). */
function parseRow(rowId: string, row: AdditionalPropertyRow): ParsedContributing | null {
  if (row.key === "") {
    const hasValueWithoutKey =
      (row.valueKind === "string" && row.stringValue !== "") ||
      (row.valueKind === "integer" && row.integerInput.trim() !== "") ||
      (row.valueKind === "boolean" && row.booleanValue === true);
    if (!hasValueWithoutKey) {
      return null;
    }
    return { ok: false, rowId, reason: "empty_key" };
  }

  if (row.valueKind === "string") {
    if (row.stringValue === "") {
      return { ok: false, rowId, reason: "empty_value" };
    }
    return { ok: true, rowId, key: row.key, value: row.stringValue };
  }

  if (row.valueKind === "boolean") {
    return { ok: true, rowId, key: row.key, value: row.booleanValue };
  }

  const trimmed = row.integerInput.trim();
  if (trimmed === "") {
    return { ok: false, rowId, reason: "empty_value" };
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n)) {
    return { ok: false, rowId, reason: "invalid_integer" };
  }
  return { ok: true, rowId, key: row.key, value: n };
}

export type AdditionalPropertyRowErrorCode =
  | "duplicate_key"
  | "schema_collision"
  | "invalid_integer"
  | "empty_key"
  | "empty_value";

export type AdditionalPropertiesValidation = {
  /** Flat config from additional rows only (no schema form). */
  additionalFlat: Record<string, string | number | boolean>;
  /** Row ids that should show a field-level error. */
  rowIdsWithErrors: Set<string>;
  /** Per-row error codes (for helper text). */
  rowErrorCodes: Map<string, AdditionalPropertyRowErrorCode[]>;
  /** True when submit / validate should be blocked. */
  hasErrors: boolean;
};

function addRowError(
  rowErrorCodes: Map<string, AdditionalPropertyRowErrorCode[]>,
  rowId: string,
  code: AdditionalPropertyRowErrorCode
) {
  const prev = rowErrorCodes.get(rowId) ?? [];
  prev.push(code);
  rowErrorCodes.set(rowId, prev);
}

/**
 * Rule (B): error only when two sources would both contribute the same key in the merged config,
 * or duplicate contributing keys among additional rows. Keys compared as-is (case-sensitive, no trim).
 */
export function validateAdditionalPropertyRows(
  rows: Map<string, AdditionalPropertyRow>,
  configFromForm: Record<string, string | number | boolean>
): AdditionalPropertiesValidation {
  const rowIdsWithErrors = new Set<string>();
  const rowErrorCodes = new Map<string, AdditionalPropertyRowErrorCode[]>();
  const parsed: Array<{ ok: true; rowId: string; key: string; value: string | number | boolean }> = [];

  for (const [rowId, row] of rows) {
    const r = parseRow(rowId, row);
    if (r === null) {
      continue;
    }
    if (!r.ok) {
      rowIdsWithErrors.add(rowId);
      const code: AdditionalPropertyRowErrorCode =
        r.reason === "empty_key"
          ? "empty_key"
          : r.reason === "invalid_integer"
            ? "invalid_integer"
            : "empty_value";
      addRowError(rowErrorCodes, rowId, code);
      continue;
    }
    parsed.push(r);
  }

  const keyToRowIds = new Map<string, string[]>();
  for (const p of parsed) {
    const list = keyToRowIds.get(p.key) ?? [];
    list.push(p.rowId);
    keyToRowIds.set(p.key, list);
  }

  for (const [, rowIds] of keyToRowIds) {
    if (rowIds.length > 1) {
      rowIds.forEach((id) => {
        rowIdsWithErrors.add(id);
        addRowError(rowErrorCodes, id, "duplicate_key");
      });
    }
  }

  for (const p of parsed) {
    if (Object.prototype.hasOwnProperty.call(configFromForm, p.key)) {
      rowIdsWithErrors.add(p.rowId);
      addRowError(rowErrorCodes, p.rowId, "schema_collision");
    }
  }

  const additionalFlat: Record<string, string | number | boolean> = {};
  for (const p of parsed) {
    if (!rowIdsWithErrors.has(p.rowId)) {
      additionalFlat[p.key] = p.value;
    }
  }

  const hasErrors = rowIdsWithErrors.size > 0;

  return { additionalFlat, rowIdsWithErrors, rowErrorCodes, hasErrors };
}

/** Merge schema form config with validated additional rows (additional overwrites on collision only when valid — callers should block on hasErrors first). */
export function mergeConnectionConfig(
  configFromForm: Record<string, string | number | boolean>,
  additionalFlat: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  return { ...configFromForm, ...additionalFlat };
}
