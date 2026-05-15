import * as React from "react";
import {
  Button,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  Split,
  SplitItem,
  Switch,
  TextInput,
} from "@patternfly/react-core";
import { ExclamationCircleIcon, TrashIcon } from "@patternfly/react-icons";
import { useTranslation } from "react-i18next";
import type {
  AdditionalPropertyRow,
  AdditionalPropertyRowErrorCode,
  AdditionalPropertyValueKind,
} from "@utils/additionalConfigProperties";

export interface AdditionalPropertiesRowsProps {
  fieldIdPrefix: string;
  viewMode?: boolean;
  properties: Map<string, AdditionalPropertyRow>;
  rowIdsWithErrors: Set<string>;
  rowErrorCodes: Map<string, AdditionalPropertyRowErrorCode[]>;
  onDeleteRow: (rowId: string) => void;
  onPatchRow: (rowId: string, patch: Partial<AdditionalPropertyRow>) => void;
  onValueKindChange: (rowId: string, kind: AdditionalPropertyValueKind) => void;
  showAddRemove?: boolean;
}

function firstErrorMessage(
  t: (k: string, o?: Record<string, string>) => string,
  codes: AdditionalPropertyRowErrorCode[] | undefined
): string | null {
  if (!codes?.length) {
    return null;
  }
  const c = codes[0];
  return t(`connection:additionalProperties.errors.${c}`);
}

const AdditionalPropertiesRows: React.FunctionComponent<AdditionalPropertiesRowsProps> = ({
  fieldIdPrefix,
  viewMode = false,
  properties,
  rowIdsWithErrors,
  rowErrorCodes,
  onDeleteRow,
  onPatchRow,
  onValueKindChange,
  showAddRemove = true,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {Array.from(properties.keys()).map((rowId) => {
        const row = properties.get(rowId)!;
        const hasError = rowIdsWithErrors.has(rowId);
        const errMsg = hasError ? firstErrorMessage(t, rowErrorCodes.get(rowId)) : null;

        return (
          <Split hasGutter key={rowId}>
            <SplitItem isFilled>
              <Grid hasGutter>
                <GridItem span={12} md={5}>
                  <FormGroup
                    label=""
                    fieldId={`${fieldIdPrefix}-key-${rowId}`}
                    isRequired={!viewMode}
                  >
                    <TextInput
                      readOnlyVariant={viewMode ? "default" : undefined}
                      isRequired={!viewMode}
                      type="text"
                      placeholder={t("connection:additionalProperties.keyPlaceholder")}
                      validated={hasError ? "error" : "default"}
                      id={`${fieldIdPrefix}-key-${rowId}`}
                      name={`${fieldIdPrefix}-key-${rowId}`}
                      value={row.key}
                      onChange={(_e, value) => onPatchRow(rowId, { key: value })}
                      aria-label={t("connection:additionalProperties.keyAria")}
                    />
                  </FormGroup>
                </GridItem>
                <GridItem span={12} md={2}>
                  <FormGroup label="" fieldId={`${fieldIdPrefix}-type-${rowId}`}>
                    <FormSelect
                      id={`${fieldIdPrefix}-type-${rowId}`}
                      value={row.valueKind}
                      validated={hasError ? "error" : "default"}
                      isDisabled={viewMode}
                      onChange={(_e, value) =>
                        onValueKindChange(rowId, value as AdditionalPropertyValueKind)
                      }
                      aria-label={t("connection:additionalProperties.valueTypeAria")}
                    >
                      <FormSelectOption value="string" label={t("connection:additionalProperties.typeString")} />
                      <FormSelectOption value="boolean" label={t("connection:additionalProperties.typeBoolean")} />
                      <FormSelectOption value="integer" label={t("connection:additionalProperties.typeInteger")} />
                    </FormSelect>
                  </FormGroup>
                </GridItem>
                <GridItem span={12} md={5}>
                  {row.valueKind === "string" && (
                    <FormGroup label="" fieldId={`${fieldIdPrefix}-value-${rowId}`} isRequired={!viewMode}>
                      <TextInput
                        readOnlyVariant={viewMode ? "default" : undefined}
                        isRequired={!viewMode}
                        type="text"
                        id={`${fieldIdPrefix}-value-${rowId}`}
                        placeholder={t("connection:additionalProperties.valuePlaceholder")}
                        validated={hasError ? "error" : "default"}
                        name={`${fieldIdPrefix}-value-${rowId}`}
                        value={row.stringValue}
                        onChange={(_e, value) => onPatchRow(rowId, { stringValue: value })}
                        aria-label={t("connection:additionalProperties.valueAria")}
                      />
                    </FormGroup>
                  )}
                  {row.valueKind === "boolean" && (
                    <FormGroup label="" fieldId={`${fieldIdPrefix}-value-${rowId}`}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          width: "100%",
                        }}
                      >
                        <Switch
                          id={`${fieldIdPrefix}-value-${rowId}`}
                          isChecked={row.booleanValue}
                          onChange={(_e, checked) => onPatchRow(rowId, { booleanValue: checked })}
                          isDisabled={viewMode}
                          label={
                            row.booleanValue
                              ? t("connection:additionalProperties.booleanTrue")
                              : t("connection:additionalProperties.booleanFalse")
                          }
                        />
                      </div>
                    </FormGroup>
                  )}
                  {row.valueKind === "integer" && (
                    <FormGroup label="" fieldId={`${fieldIdPrefix}-value-${rowId}`} isRequired={!viewMode}>
                      <TextInput
                        readOnlyVariant={viewMode ? "default" : undefined}
                        isRequired={!viewMode}
                        type="text"
                        inputMode="numeric"
                        id={`${fieldIdPrefix}-value-${rowId}`}
                        placeholder={t("connection:additionalProperties.integerPlaceholder")}
                        validated={hasError ? "error" : "default"}
                        name={`${fieldIdPrefix}-value-${rowId}`}
                        value={row.integerInput}
                        onChange={(_e, value) => onPatchRow(rowId, { integerInput: value })}
                        aria-label={t("connection:additionalProperties.integerAria")}
                      />
                    </FormGroup>
                  )}
                  {errMsg && (
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                          {errMsg}
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  )}
                </GridItem>
              </Grid>
            </SplitItem>
            {showAddRemove && (
              <SplitItem>
                <Button
                  variant="plain"
                  isDisabled={viewMode}
                  aria-label={t("connection:additionalProperties.removeRowAria")}
                  onClick={() => onDeleteRow(rowId)}
                >
                  <TrashIcon />
                </Button>
              </SplitItem>
            )}
          </Split>
        );
      })}
    </>
  );
};

export { AdditionalPropertiesRows };
