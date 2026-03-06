import { Switch } from '@patternfly/react-core';
import type { ControllerRenderProps } from 'react-hook-form';
import type { NormalizedField } from '../types';

interface BooleanFieldProps {
  field: NormalizedField;
  rhfField: ControllerRenderProps;
}

export function BooleanField({ field, rhfField }: BooleanFieldProps) {
  return (
    <Switch
      id={field.name}
      label="Enabled"
      isChecked={!!rhfField.value}
      onChange={(_event, checked) => rhfField.onChange(checked)}
      aria-label={field.label}
    />
  );
}
