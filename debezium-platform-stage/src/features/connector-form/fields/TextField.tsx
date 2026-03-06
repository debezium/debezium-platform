import { TextInput } from '@patternfly/react-core';
import type { ControllerRenderProps } from 'react-hook-form';
import type { NormalizedField } from '../types';

interface TextFieldProps {
  field: NormalizedField;
  rhfField: ControllerRenderProps;
  hasError: boolean;
  errorId?: string;
}

export function TextField({ field, rhfField, hasError, errorId }: TextFieldProps) {
  const isPassword = field.name.toLowerCase().includes('password');
  const { ref, onBlur, value, onChange, ...rest } = rhfField;

  return (
    <TextInput
      {...rest}
      ref={ref}
      id={field.name}
      value={value ?? ''}
      onBlur={onBlur}
      onChange={(_event, val) => onChange(val)}
      type={isPassword ? 'password' : 'text'}
      validated={hasError ? 'error' : 'default'}
      placeholder={field.label}
      aria-label={field.label}
      aria-invalid={hasError}
      aria-describedby={errorId}
    />
  );
}
