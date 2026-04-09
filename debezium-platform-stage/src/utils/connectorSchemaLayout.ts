import type { SchemaProperty } from "../apis/types";

export function buildDependencyMap(
  properties: SchemaProperty[]
): Map<string, Map<string, string[]>> {
  const map = new Map<string, Map<string, string[]>>();
  for (const prop of properties) {
    if (prop.valueDependants.length > 0) {
      const valueMap = new Map<string, string[]>();
      for (const dep of prop.valueDependants) {
        for (const val of dep.values) {
          valueMap.set(val, dep.dependants);
        }
      }
      map.set(prop.name, valueMap);
    }
  }
  return map;
}

export function collectAllDependants(properties: SchemaProperty[]): Set<string> {
  const set = new Set<string>();
  for (const prop of properties) {
    for (const dep of prop.valueDependants) {
      for (const d of dep.dependants) {
        set.add(d);
      }
    }
  }
  return set;
}

/** Same visibility rules as the schema-driven form (conditional fields). */
export function isSchemaFieldVisible(
  property: SchemaProperty,
  allValues: Record<string, string>,
  dependencyMap: Map<string, Map<string, string[]>>
): boolean {
  for (const [parentName, valueMap] of dependencyMap) {
    let isDepOfThisParent = false;
    let matchesCurrentValue = false;

    for (const [triggerValue, deps] of valueMap) {
      if (deps.includes(property.name)) {
        isDepOfThisParent = true;
        if ((allValues[parentName] || "") === triggerValue) {
          matchesCurrentValue = true;
        }
      }
    }

    if (isDepOfThisParent && !matchesCurrentValue) return false;
  }
  return true;
}
