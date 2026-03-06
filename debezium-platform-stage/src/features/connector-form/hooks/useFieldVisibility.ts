import { useWatch, type Control, type FieldValues } from 'react-hook-form';
import { useMemo } from 'react';
import type { NormalizedSchema } from '../types';

interface UseFieldVisibilityOptions {
  schema: NormalizedSchema;
  control: Control<FieldValues>;
}

/**
 * Returns a Set of currently visible field names based on trigger field values.
 * Only watches schema.triggerFields — not all form fields (performance).
 * Comparison is case-insensitive (API 'LogMiner' vs form 'logminer').
 */
export function useFieldVisibility({
  schema,
  control,
}: UseFieldVisibilityOptions): Set<string> {
  const watchedValues = useWatch({
    control,
    name: schema.triggerFields,
  });

  const triggerValueMap = useMemo(() => {
    const map: Record<string, string> = {};
    const values = Array.isArray(watchedValues) ? watchedValues : [watchedValues];
    schema.triggerFields.forEach((fieldName, index) => {
      map[fieldName] = String(values[index] ?? '');
    });
    return map;
  }, [schema.triggerFields, watchedValues]);

  const visibleFields = useMemo(() => {
    const allFieldNames = schema.groups.flatMap((g) =>
      g.fields.map((f) => f.name)
    );
    const visible = new Set<string>();

    for (const fieldName of allFieldNames) {
      const rules = schema.visibilityMap[fieldName];

      if (!rules || rules.length === 0) {
        visible.add(fieldName);
        continue;
      }

      const isVisible = rules.some((rule) => {
        const currentValue = triggerValueMap[rule.watchField] ?? '';
        return rule.whenValues.some(
          (v) => v.toLowerCase() === currentValue.toLowerCase()
        );
      });

      if (isVisible) {
        visible.add(fieldName);
      }
    }

    return visible;
  }, [schema, triggerValueMap]);

  return visibleFields;
}
