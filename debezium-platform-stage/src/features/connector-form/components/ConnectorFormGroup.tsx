import { useState, useEffect } from 'react';
import { Grid, ExpandableSection } from '@patternfly/react-core';
import type { Control, FieldValues } from 'react-hook-form';
import type { NormalizedGroup } from '../types';
import { FieldRenderer } from './FieldRenderer';

interface ConnectorFormGroupProps {
  group: NormalizedGroup;
  control: Control<FieldValues>;
  visibleFields: Set<string>;
  expandAllAdvanced?: boolean;
}

export function ConnectorFormGroup({
  group,
  control,
  visibleFields,
  expandAllAdvanced,
}: ConnectorFormGroupProps) {
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);

  useEffect(() => {
    if (expandAllAdvanced !== undefined) {
      setIsAdvancedExpanded(expandAllAdvanced);
    }
  }, [expandAllAdvanced]);

  const primaryFields = group.fields.filter(
    (f) => f.groupOrder < 9999 && f.importance !== 'low'
  );
  const advancedFields = group.fields.filter(
    (f) => f.groupOrder === 9999 || f.importance === 'low'
  );

  const visiblePrimary = primaryFields.filter((f) => visibleFields.has(f.name));
  const visibleAdvanced = advancedFields.filter((f) => visibleFields.has(f.name));

  return (
    <div style={{ padding: '1rem 0', minWidth: 0, overflow: 'hidden' }}>
      {visiblePrimary.length > 0 && (
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <Grid hasGutter>
            {visiblePrimary.map((f) => (
              <FieldRenderer key={f.name} field={f} control={control as never} />
            ))}
          </Grid>
        </div>
      )}

      {visibleAdvanced.length > 0 && (
        <ExpandableSection
          toggleText={`Advanced properties (${visibleAdvanced.length})`}
          isIndented
          style={{ marginTop: '1.5rem' }}
          isExpanded={isAdvancedExpanded}
          onToggle={(_event, expanded) => setIsAdvancedExpanded(expanded)}
        >
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <Grid hasGutter>
              {visibleAdvanced.map((f) => (
                <FieldRenderer key={f.name} field={f} control={control as never} />
              ))}
            </Grid>
          </div>
        </ExpandableSection>
      )}
    </div>
  );
}
