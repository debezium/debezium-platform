import { TextInput } from '@patternfly/react-core';
import type { ControllerRenderProps } from 'react-hook-form';
import type { NormalizedField } from '../types';

interface NumberFieldProps {
  field: NormalizedField;
  rhfField: ControllerRenderProps;
  hasError: boolean;
  errorId?: string;
}

export function NumberField({ field, rhfField, hasError, errorId }: NumberFieldProps) {
  const { ref, onBlur, ...rest } = rhfField;
  return (
    <TextInput
      {...rest}
      ref={ref}
      id={field.name}
      type="number"
      value={rhfField.value != null ? String(rhfField.value) : ''}
      validated={hasError ? 'error' : 'default'}
      aria-label={field.label}
      aria-invalid={hasError}
      aria-describedby={errorId}
      onBlur={onBlur}
      onChange={(_event, value) =>
        rhfField.onChange(value === '' ? undefined : Number(value))
      }
    />
  );
}
