import { Form } from "@patternfly/react-core";
import { SchemaProperty } from "../apis/types";
import SchemaField from "./SchemaField";
import React from "react";
import { isSchemaFieldVisible } from "@utils/connectorSchemaLayout";

interface SchemaGroupSectionProps {
  properties: SchemaProperty[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  errors: Record<string, string | undefined>;
  allValues: Record<string, string>;
  dependencyMap: Map<string, Map<string, string[]>>;
  allDependantNames: Set<string>;
  readOnly?: boolean;
}

const SchemaGroupSection: React.FC<SchemaGroupSectionProps> = ({
  properties,
  values,
  onChange,
  errors,
  allValues,
  dependencyMap,
  allDependantNames,
  readOnly,
}) => {
  const sorted = React.useMemo(
    () => [...properties].sort((a, b) => a.display.groupOrder - b.display.groupOrder),
    [properties]
  );

  const visibleProperties = React.useMemo(
    () => sorted.filter((p) => isSchemaFieldVisible(p, allValues, dependencyMap)),
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
          readOnly={readOnly}
        />
      ))}
    </Form>
  );
};

export default SchemaGroupSection;
