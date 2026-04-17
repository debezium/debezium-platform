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
  /** Property names to omit (e.g. driven elsewhere, such as the table explorer). */
  omittedPropertyNames?: ReadonlySet<string>;
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
  omittedPropertyNames,
}) => {
  const sorted = React.useMemo(
    () => [...properties].sort((a, b) => a.display.groupOrder - b.display.groupOrder),
    [properties]
  );

  const visibleProperties = React.useMemo(
    () => sorted.filter((p) => isSchemaFieldVisible(p, allValues, dependencyMap)),
    [sorted, allValues, dependencyMap]
  );

  const shownProperties = React.useMemo(() => {
    if (!omittedPropertyNames?.size) return visibleProperties;
    return visibleProperties.filter((p) => !omittedPropertyNames.has(p.name));
  }, [visibleProperties, omittedPropertyNames]);

  if (shownProperties.length === 0) return null;

  return (
    <Form isWidthLimited>
      {shownProperties.map((property) => (
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
