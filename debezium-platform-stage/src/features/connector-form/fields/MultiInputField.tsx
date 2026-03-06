import { useState } from 'react';
import {
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Button,
} from '@patternfly/react-core';
import { Chip, ChipGroup } from '@patternfly/react-core/deprecated';
import { TimesIcon } from '@patternfly/react-icons';
import type { ControllerRenderProps } from 'react-hook-form';
import type { NormalizedField } from '../types';

interface MultiInputFieldProps {
  field: NormalizedField;
  rhfField: ControllerRenderProps;
  hasError: boolean;
  errorId?: string;
}

export function MultiInputField({
  field,
  rhfField,
  hasError,
  errorId,
}: MultiInputFieldProps) {
  const [inputValue, setInputValue] = useState('');

  const values: string[] = Array.isArray(rhfField.value)
    ? rhfField.value
    : (rhfField.value as string)?.split(',').filter(Boolean) ?? [];

  const addValue = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || values.includes(trimmed)) return;
    const newValues = [...values, trimmed];
    rhfField.onChange(newValues.join(','));
    setInputValue('');
  };

  const removeValue = (val: string) => {
    rhfField.onChange(values.filter((v) => v !== val).join(','));
  };

  return (
    <div>
      {values.length > 0 && (
        <ChipGroup>
          {values.map((val) => (
            <Chip key={val} onClick={() => removeValue(val)}>
              {val}
            </Chip>
          ))}
        </ChipGroup>
      )}
      <TextInputGroup>
        <TextInputGroupMain
          value={inputValue}
          onChange={(_e, v) => setInputValue(v)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValue())}
          placeholder="Type and press Enter"
          aria-invalid={hasError}
          aria-label={field.label}
          aria-describedby={errorId}
        />
        <TextInputGroupUtilities>
          {inputValue && (
            <Button
              variant="plain"
              onClick={() => setInputValue('')}
              aria-label="Clear input"
              icon={<TimesIcon />}
            />
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </div>
  );
}
