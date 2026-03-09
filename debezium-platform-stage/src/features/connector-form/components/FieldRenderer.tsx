import { useRef } from 'react';
import { Controller, type Control, type FieldValues } from 'react-hook-form';
import type { ControllerRenderProps } from 'react-hook-form';
import {
  GridItem,
  FormGroup,
  FormGroupLabelHelp,
  HelperText,
  HelperTextItem,
  Popover,
  Tooltip,
} from '@patternfly/react-core';
import type { NormalizedField } from '../types';
import { TextField } from '../fields/TextField';
import { NumberField } from '../fields/NumberField';
import { BooleanField } from '../fields/BooleanField';
import { SelectField } from '../fields/SelectField';
import { MultiInputField } from '../fields/MultiInputField';

const WIDTH_SPAN: Record<NormalizedField['width'], number> = {
  short: 6,
  medium: 6,
  long: 12,
};

interface FieldInputProps {
  field: NormalizedField;
  rhfField: ControllerRenderProps;
  hasError: boolean;
  errorId?: string;
}

function FieldInput({ field, rhfField, hasError, errorId }: FieldInputProps) {
  switch (field.fieldType) {
    case 'text':
      return (
        <TextField field={field} rhfField={rhfField} hasError={hasError} errorId={errorId} />
      );
    case 'number':
      return (
        <NumberField field={field} rhfField={rhfField} hasError={hasError} errorId={errorId} />
      );
    case 'boolean':
      return <BooleanField field={field} rhfField={rhfField} />;
    case 'select':
      return (
        <SelectField field={field} rhfField={rhfField} hasError={hasError} errorId={errorId} />
      );
    case 'multiInput':
      return (
        <MultiInputField
          field={field}
          rhfField={rhfField}
          hasError={hasError}
          errorId={errorId}
        />
      );
    default:
      return null;
  }
}

interface FieldRendererProps {
  field: NormalizedField;
  control: Control<FieldValues>;
}

export function FieldRenderer({ field, control }: FieldRendererProps) {
  const labelHelpRef = useRef<HTMLButtonElement>(null);

  const labelHelp = field.description ? (
    <Popover
      triggerRef={labelHelpRef}
      headerContent={field.label}
      bodyContent={field.description}
    >
      <FormGroupLabelHelp
        ref={labelHelpRef}
        aria-label={`More info for ${field.label}`}
      />
    </Popover>
  ) : undefined;

  const labelContent = (
    <Tooltip content={field.label} position="top">
      <span
        style={{
          display: 'inline-block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 'calc(100% - 1.5rem)',
          verticalAlign: 'middle',
        }}
      >
        {field.label}
      </span>
    </Tooltip>
  );

  return (
    <GridItem span={WIDTH_SPAN[field.width] as 4 | 6 | 12}>
      <Controller
        name={field.name}
        control={control}
        render={({ field: rhfField, fieldState }) => {
          const errorId = fieldState.error ? `${field.name}-error` : undefined;
          return (
            <FormGroup
              label={labelContent}
              labelHelp={labelHelp}
              isRequired={field.required}
              fieldId={field.name}
            >
              <FieldInput
                field={field}
                rhfField={rhfField}
                hasError={!!fieldState.error}
                errorId={errorId}
              />
              {fieldState.error && (
                <HelperText id={errorId}>
                  <HelperTextItem variant="error" aria-live="polite">
                    {fieldState.error.message}
                  </HelperTextItem>
                </HelperText>
              )}
            </FormGroup>
          );
        }}
      />
    </GridItem>
  );
}
