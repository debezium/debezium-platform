import { Grid, ExpandableSection } from '@patternfly/react-core';
import type { Control, FieldValues } from 'react-hook-form';
import type { NormalizedGroup } from '../types';
import { FieldRenderer } from './FieldRenderer';

interface ConnectorFormGroupProps {
  group: NormalizedGroup;
  control: Control<FieldValues>;
  visibleFields: Set<string>;
}

export function ConnectorFormGroup({
  group,
  control,
  visibleFields,
}: ConnectorFormGroupProps) {
  const primaryFields = group.fields.filter(
    (f) => f.groupOrder < 9999 && f.importance !== 'low'
  );
  const advancedFields = group.fields.filter(
    (f) => f.groupOrder === 9999 || f.importance === 'low'
  );

  const visibleAdvancedFields = advancedFields.filter((f) =>
    visibleFields.has(f.name)
  );

  return (
    <div style={{ padding: '1rem 0' }}>
      <Grid hasGutter>
        {primaryFields
          .filter((f) => visibleFields.has(f.name))
          .map((f) => (
            <FieldRenderer
              key={f.name}
              field={f}
              control={control as never}
            />
          ))}
      </Grid>

      {visibleAdvancedFields.length > 0 && (
        <ExpandableSection
          toggleText={`Advanced options (${visibleAdvancedFields.length})`}
          isIndented
        >
          <Grid hasGutter>
            {visibleAdvancedFields.map((f) => (
              <FieldRenderer
                key={f.name}
                field={f}
                control={control as never}
              />
            ))}
          </Grid>
        </ExpandableSection>
      )}
    </div>
  );
}
