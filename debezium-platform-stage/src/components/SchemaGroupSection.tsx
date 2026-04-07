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
}

const isFieldVisible = (
  property: SchemaProperty,
  allValues: Record<string, string>,
  dependencyMap: Map<string, Map<string, string[]>>
): boolean => {
  for (const [parentName, valueMap] of dependencyMap) {
    for (const [, dependants] of valueMap) {
      if (dependants.includes(property.name)) {
        const parentValue = allValues[parentName] || "";
        const parentValueMap = dependencyMap.get(parentName);
        if (!parentValueMap) return false;

        for (const [triggerValue, deps] of parentValueMap) {
          if (deps.includes(property.name)) {
            if (parentValue !== triggerValue) return false;
          }
        }
      }
    }
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
        />
      ))}
    </Form>
  );
};

export default SchemaGroupSection;
