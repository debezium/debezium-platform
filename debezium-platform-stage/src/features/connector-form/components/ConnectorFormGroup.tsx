import { Grid, ExpandableSection, Divider } from '@patternfly/react-core';
import type { Control, FieldValues } from 'react-hook-form';
import type { NormalizedField, NormalizedGroup } from '../types';
import { FieldRenderer } from './FieldRenderer';

const TYPE_ORDER: Record<NormalizedField['fieldType'], number> = {
  text: 0,
  select: 1,
  number: 2,
  multiInput: 3,
  boolean: 4,
};

function sortByTypeCluster(fields: NormalizedField[]): NormalizedField[] {
  return [...fields].sort((a, b) => {
    const typeA = TYPE_ORDER[a.fieldType];
    const typeB = TYPE_ORDER[b.fieldType];
    if (typeA !== typeB) return typeA - typeB;
    return a.groupOrder - b.groupOrder;
  });
}

function splitFields(fields: NormalizedField[]) {
  const sorted = sortByTypeCluster(fields);
  return {
    inputFields: sorted.filter((f) => f.fieldType !== 'boolean'),
    booleanFields: sorted.filter((f) => f.fieldType === 'boolean'),
  };
}

interface FieldGridProps {
  fields: NormalizedField[];
  control: Control<FieldValues>;
}

function FieldGrid({ fields, control }: FieldGridProps) {
  if (fields.length === 0) return null;
  return (
    <div style={{ minWidth: 0, overflow: 'hidden' }}>
      <Grid hasGutter>
        {fields.map((f) => (
          <FieldRenderer key={f.name} field={f} control={control as never} />
        ))}
      </Grid>
    </div>
  );
}

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

  const visiblePrimary = primaryFields.filter((f) => visibleFields.has(f.name));
  const visibleAdvanced = advancedFields.filter((f) => visibleFields.has(f.name));

  const primary = splitFields(visiblePrimary);
  const advanced = splitFields(visibleAdvanced);

  return (
    <div style={{ padding: '1rem 0', minWidth: 0, overflow: 'hidden' }}>
      <FieldGrid fields={primary.inputFields} control={control} />

      {primary.booleanFields.length > 0 && (
        <>
          {primary.inputFields.length > 0 && (
            <Divider style={{ margin: '1rem 0' }} />
          )}
          <FieldGrid fields={primary.booleanFields} control={control} />
        </>
      )}

      {visibleAdvanced.length > 0 && (
        <ExpandableSection
          toggleText={`Advanced options (${visibleAdvanced.length})`}
          isIndented
          style={{ marginTop: '1.5rem' }}
        >
          <FieldGrid fields={advanced.inputFields} control={control} />

          {advanced.booleanFields.length > 0 && (
            <>
              {advanced.inputFields.length > 0 && (
                <Divider style={{ margin: '1rem 0' }} />
              )}
              <FieldGrid fields={advanced.booleanFields} control={control} />
            </>
          )}
        </ExpandableSection>
      )}
    </div>
  );
}
