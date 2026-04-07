import { Form } from "@patternfly/react-core";
import { SchemaProperty } from "../apis/types";
import SchemaField from "./SchemaField";
import React from "react";

interface SchemaGroupSectionProps {
  properties: SchemaProperty[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  errors: Record<string, string | undefined>;
  allValues: Record<string, string>;
  dependencyMap: Map<string, Map<string, string[]>>;
  allDependantNames: Set<string>;
}

const isFieldVisible = (
  property: SchemaProperty,
  allValues: Record<string, string>,
  dependencyMap: Map<string, Map<string, string[]>>
): boolean => {
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
};

const SchemaGroupSection: React.FC<SchemaGroupSectionProps> = ({
  properties,
  values,
  onChange,
  errors,
  allValues,
  dependencyMap,
  allDependantNames,
}) => {
  const sorted = React.useMemo(
    () => [...properties].sort((a, b) => a.display.groupOrder - b.display.groupOrder),
    [properties]
  );

  const visibleProperties = React.useMemo(
    () => sorted.filter((p) => isFieldVisible(p, allValues, dependencyMap)),
    [sorted, allValues, dependencyMap]
  );

  if (visibleProperties.length === 0) return null;

  return (
    <Form isWidthLimited>
      {visibleProperties.map((property) => (
        <SchemaField
          key={property.name}
          property={property}
          value={values[property.name] || ""}
          onChange={onChange}
          error={errors[property.name]}
          isDependant={allDependantNames.has(property.name)}
        />
      ))}
    </Form>
  );
};

export default SchemaGroupSection;
