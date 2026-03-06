import { FormSelect, FormSelectOption } from '@patternfly/react-core';
import type { ControllerRenderProps } from 'react-hook-form';
import type { NormalizedField } from '../types';

interface SelectFieldProps {
  field: NormalizedField;
  rhfField: ControllerRenderProps;
  hasError: boolean;
  errorId?: string;
}

export function SelectField({ field, rhfField, hasError, errorId }: SelectFieldProps) {
  const { ref, onBlur, ...rest } = rhfField;
  return (
    <FormSelect
      {...rest}
      ref={ref}
      id={field.name}
      value={rhfField.value ?? ''}
      validated={hasError ? 'error' : 'default'}
      onBlur={onBlur}
      onChange={(_event, value) => rhfField.onChange(value)}
      aria-label={field.label}
      aria-invalid={hasError}
      aria-describedby={errorId}
    >
      <FormSelectOption value="" label={`Select ${field.label}`} isPlaceholder />
      {field.options?.map((opt) => (
        <FormSelectOption key={opt.value} value={opt.value} label={opt.label} />
      ))}
    </FormSelect>
  );
}
