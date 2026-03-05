import type {
  RawConnectorSchema,
  RawProperty,
  NormalizedSchema,
  NormalizedField,
  NormalizedGroup,
  VisibilityRule,
} from '../types';

function normalizeField(prop: RawProperty): NormalizedField {
  const hasEnum = prop.validation?.some((v) => v.type === 'enum');

  let fieldType: NormalizedField['fieldType'];
  if (prop.type === 'boolean') {
    fieldType = 'boolean';
  } else if (prop.type === 'number') {
    fieldType = 'number';
  } else if (prop.type === 'list') {
    fieldType = 'multiInput';
  } else if (hasEnum) {
    fieldType = 'select';
  } else {
    fieldType = 'text';
  }

  const options = hasEnum
    ? prop
        .validation!.find((v) => v.type === 'enum')!
        .values.map((v) => ({ value: v, label: v }))
    : undefined;

  return {
    name: prop.name,
    fieldType,
    label: prop.display.label,
    description: prop.display.description,
    group: prop.display.group,
    groupOrder: prop.display.groupOrder,
    width: prop.display.width ?? 'medium',
    importance: prop.display.importance ?? 'low',
    required: prop.required ?? false,
    options,
  };
}

/**
 * Pure function: transforms RawConnectorSchema → NormalizedSchema.
 * Run once when API response arrives. Memoize at call site.
 */
export function normalizeSchema(raw: RawConnectorSchema): NormalizedSchema {
  // Step 1: Build visibility map
  const visibilityMap: Record<string, VisibilityRule[]> = {};
  for (const prop of raw.properties) {
    if (!prop.valueDependants) continue;
    for (const rule of prop.valueDependants) {
      for (const dep of rule.dependants) {
        visibilityMap[dep] ??= [];
        visibilityMap[dep].push({
          watchField: prop.name,
          whenValues: rule.values,
        });
      }
    }
  }

  // Step 2: Collect trigger fields
  const triggerFields = [
    ...new Set(
      Object.values(visibilityMap).flatMap((rules) =>
        rules.map((r) => r.watchField)
      )
    ),
  ];

  // Step 3: Normalize all fields
  const allNormalizedFields = raw.properties.map(normalizeField);

  // Step 4: Group and sort
  const sortedGroups = [...raw.groups].sort((a, b) => a.order - b.order);
  const declaredGroupNames = new Set(raw.groups.map((g) => g.name));

  const groups: NormalizedGroup[] = sortedGroups.map((rawGroup) => ({
    name: rawGroup.name,
    order: rawGroup.order,
    description: rawGroup.description,
    fields: allNormalizedFields
      .filter((f) => f.group === rawGroup.name)
      .sort((a, b) => a.groupOrder - b.groupOrder),
  }));

  // Step 5: Handle orphan fields (group not in groups[])
  const orphanFields = allNormalizedFields.filter(
    (f) => !declaredGroupNames.has(f.group)
  );
  if (orphanFields.length > 0) {
    const orphanGroups = new Map<string, NormalizedField[]>();
    for (const f of orphanFields) {
      const arr = orphanGroups.get(f.group) ?? [];
      arr.push(f);
      orphanGroups.set(f.group, arr);
    }
    for (const [groupName, fields] of orphanGroups) {
      groups.push({
        name: groupName,
        order: 999,
        description: '',
        fields: fields.sort((a, b) => a.groupOrder - b.groupOrder),
      });
    }
  }

  return {
    connectorName: raw.name,
    groups,
    visibilityMap,
    triggerFields,
  };
}
