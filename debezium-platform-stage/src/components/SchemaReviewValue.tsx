import React from "react";
import { Label } from "@patternfly/react-core";
import type { SchemaFieldReviewState } from "@utils/connectorSchemaLayout";
import "./SchemaReviewValue.css";

const EMPTY_DISPLAY = "—";

/** Flip to false if only the Default badge is needed (less visual noise). */
export const SHOW_CONFIGURED_REVIEW_BADGE = true;

function reviewDisplayText(raw: string): string {
  if (raw.trim() === "") {
    return EMPTY_DISPLAY;
  }
  return raw;
}

interface SchemaReviewValueProps {
  raw: string;
  state: SchemaFieldReviewState;
  configuredLabel?: string;
  defaultLabel?: string;
}

const SchemaReviewValue: React.FC<SchemaReviewValueProps> = ({
  raw,
  state,
  configuredLabel = "Configured",
  defaultLabel = "Default",
}) => {
  const text = reviewDisplayText(raw);
  const unset = state === "unset" || text === EMPTY_DISPLAY;

  const valueClass = unset
    ? "connector-schema-review__value connector-schema-review__value--empty"
    : state === "default"
      ? "connector-schema-review__value connector-schema-review__value--default"
      : "connector-schema-review__value connector-schema-review__value--set";

  return (
    <span className="connector-schema-review__value-row">
      <span className={valueClass}>{text}</span>
      {SHOW_CONFIGURED_REVIEW_BADGE && state === "configured" && !unset ? (
        <Label isCompact color="blue" className="connector-schema-review__state-badge">
          {configuredLabel}
        </Label>
      ) : null}
      {state === "default" ? (
        <Label isCompact color="grey" className="connector-schema-review__state-badge">
          {defaultLabel}
        </Label>
      ) : null}
    </span>
  );
};

export default SchemaReviewValue;
