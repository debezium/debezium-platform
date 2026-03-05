import { Controller, type Control, type FieldValues } from 'react-hook-form';
import type { ControllerRenderProps } from 'react-hook-form';
import { GridItem, FormGroup, HelperText, HelperTextItem } from '@patternfly/react-core';
import type { NormalizedField } from '../types';
import { TextField } from '../fields/TextField';
import { NumberField } from '../fields/NumberField';
import { BooleanField } from '../fields/BooleanField';
import { SelectField } from '../fields/SelectField';
import { MultiInputField } from '../fields/MultiInputField';

const WIDTH_SPAN: Record<NormalizedField['width'], number> = {
  short: 4,
  medium: 6,
  long: 12,
};

interface FieldInputProps {
  field: NormalizedField;
  rhfField: ControllerRenderProps;
  hasError: boolean;
}

function FieldInput({ field, rhfField, hasError }: FieldInputProps) {
  switch (field.fieldType) {
    case 'text':
      return (
        <TextField field={field} rhfField={rhfField} hasError={hasError} />
      );
    case 'number':
      return (
        <NumberField field={field} rhfField={rhfField} hasError={hasError} />
      );
    case 'boolean':
      return <BooleanField field={field} rhfField={rhfField} />;
    case 'select':
      return (
        <SelectField field={field} rhfField={rhfField} hasError={hasError} />
      );
    case 'multiInput':
      return (
        <MultiInputField
          field={field}
          rhfField={rhfField}
          hasError={hasError}
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
  return (
    <GridItem span={WIDTH_SPAN[field.width] as 4 | 6 | 12}>
      <Controller
        name={field.name}
        control={control}
        render={({ field: rhfField, fieldState }) => (
          <FormGroup
            label={field.label}
            isRequired={field.required}
            fieldId={field.name}
          >
            <FieldInput
              field={field}
              rhfField={rhfField}
              hasError={!!fieldState.error}
            />
            {field.description && (
              <HelperText>
                <HelperTextItem>{field.description}</HelperTextItem>
              </HelperText>
            )}
            {fieldState.error && (
              <HelperText>
                <HelperTextItem variant="error">
                  {fieldState.error.message}
                </HelperTextItem>
              </HelperText>
            )}
          </FormGroup>
        )}
      />
    </GridItem>
  );
}
