import type { SchemaProperty } from "../apis/types";

export function isSchemaFieldTouched(
  propertyName: string,
  schemaValues: Record<string, string>
): boolean {
  return Object.prototype.hasOwnProperty.call(schemaValues, propertyName);
}

/** Value shown in the form: user-edited value when touched, otherwise schema default. */
export function getSchemaFieldDisplayValue(
  property: SchemaProperty,
  schemaValues: Record<string, string>
): string {
  if (isSchemaFieldTouched(property.name, schemaValues)) {
    return schemaValues[property.name];
  }
  return property.default ?? "";
}

export function buildEffectiveSchemaValues(
  properties: SchemaProperty[],
  schemaValues: Record<string, string>
): Record<string, string> {
  const effective: Record<string, string> = {};
  for (const property of properties) {
    effective[property.name] = getSchemaFieldDisplayValue(property, schemaValues);
  }
  return effective;
}

/** Schema property names that are in use (touched or showing a non-empty effective value). */
export function buildOccupiedSchemaKeys(
  properties: SchemaProperty[],
  schemaValues: Record<string, string>
): Set<string> {
  const keys = new Set<string>();
  for (const property of properties) {
    const effective = getSchemaFieldDisplayValue(property, schemaValues);
    if (isSchemaFieldTouched(property.name, schemaValues) || effective.trim() !== "") {
      keys.add(property.name);
    }
  }
  return keys;
}

export function isSchemaFieldShowingDefault(
  property: SchemaProperty,
  schemaValues: Record<string, string>
): boolean {
  return (
    !isSchemaFieldTouched(property.name, schemaValues) &&
    property.default !== undefined &&
    property.default !== ""
  );
}

export type SchemaFieldReviewState = "configured" | "default" | "unset";

/** Review/view mode: how a schema field value should be presented. */
export function getSchemaFieldReviewState(
  property: SchemaProperty,
  schemaValues: Record<string, string>
): SchemaFieldReviewState {
  const display = getSchemaFieldDisplayValue(property, schemaValues);
  if (display.trim() === "") {
    return "unset";
  }
  if (isSchemaFieldTouched(property.name, schemaValues)) {
    return "configured";
  }
  if (isSchemaFieldShowingDefault(property, schemaValues)) {
    return "default";
  }
  return "unset";
}

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
