import React from "react";
import {
  Button,
  FormGroup,
  Form,
} from "@patternfly/react-core";
import { PlusIcon } from "@patternfly/react-icons";
import { useTranslation } from "react-i18next";
import { AdditionalPropertiesRows } from "./AdditionalPropertiesRows";
import type {
  AdditionalPropertyRow,
  AdditionalPropertyRowErrorCode,
  AdditionalPropertyValueKind,
} from "@utils/additionalConfigProperties";

interface AdditionalPropertiesProps {
  fieldIdPrefix?: string;
  properties: Map<string, AdditionalPropertyRow>;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, patch: Partial<AdditionalPropertyRow>) => void;
  onValueKindChange: (id: string, kind: AdditionalPropertyValueKind) => void;
  rowIdsWithErrors: Set<string>;
  rowErrorCodes: Map<string, AdditionalPropertyRowErrorCode[]>;
  readOnly?: boolean;
}

const AdditionalProperties: React.FC<AdditionalPropertiesProps> = ({
  fieldIdPrefix = "addprop",
  properties,
  onAdd,
  onDelete,
  onPatch,
  onValueKindChange,
  rowIdsWithErrors,
  rowErrorCodes,
  readOnly = false,
}) => {
  const { t } = useTranslation();

  return (
    <Form isWidthLimited>
      <FormGroup fieldId={`${fieldIdPrefix}-group`}>
        <AdditionalPropertiesRows
          fieldIdPrefix={fieldIdPrefix}
          properties={properties}
          viewMode={readOnly}
          rowIdsWithErrors={rowIdsWithErrors}
          rowErrorCodes={rowErrorCodes}
          onDeleteRow={onDelete}
          onPatchRow={onPatch}
          onValueKindChange={onValueKindChange}
          showAddRemove={!readOnly}
        />
      </FormGroup>
      {!readOnly && (
        <Button variant="secondary" icon={<PlusIcon />} onClick={onAdd}>
          {t("form.addFieldButton", "Add property")}
        </Button>
      )}
    </Form>
  );
};

export default AdditionalProperties;
