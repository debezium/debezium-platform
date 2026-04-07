import {
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Label,
  TextInput,
  Switch,
  FormSelect,
  FormSelectOption,
} from "@patternfly/react-core";
import { ExclamationCircleIcon } from "@patternfly/react-icons";
import { SchemaProperty } from "../apis/types";
import "./SchemaField.css";

interface SchemaFieldProps {
  property: SchemaProperty;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
  isDependant?: boolean;
}

const getEnumValues = (property: SchemaProperty): string[] | undefined => {
  const enumValidation = property.validation.find((v) => v.type === "enum");
  return enumValidation?.values;
};

const SchemaField: React.FC<SchemaFieldProps> = ({
  property,
  value,
  onChange,
  error,
  isDependant,
}) => {
  const enumValues = getEnumValues(property);
  const fieldId = `schema-field-${property.name}`;

  const renderField = () => {
    if (enumValues && enumValues.length > 0) {
      return (
        <FormSelect
          id={fieldId}
          value={value}
          onChange={(_e, val) => onChange(property.name, val)}
          aria-label={property.display.label}
          validated={error ? "error" : "default"}
        >
          <FormSelectOption key="" value="" label="Select an option" />
          {enumValues.map((opt) => (
            <FormSelectOption key={opt} value={opt} label={opt} />
          ))}
        </FormSelect>
      );
    }

    if (property.type === "boolean") {
      return (
        <Switch
          id={fieldId}
          label="Enabled"
          isChecked={value === "true"}
          onChange={(_e, checked) =>
            onChange(property.name, String(checked))
          }
          aria-label={property.display.label}
        />
      );
    }

    if (property.type === "number") {
      return (
        <TextInput
          id={fieldId}
          type="number"
          value={value}
          onChange={(_e, val) => onChange(property.name, val)}
          aria-label={property.display.label}
          validated={error ? "error" : "default"}
        />
      );
    }

    return (
      <TextInput
        id={fieldId}
        type="text"
        value={value}
        onChange={(_e, val) => onChange(property.name, val)}
        aria-label={property.display.label}
        validated={error ? "error" : "default"}
      />
    );
  };

  const fieldLabel = isDependant ? (
    <>
      {property.display.label}
      <Label isCompact color="teal" className="schema-field__conditional-badge">
        Conditional
      </Label>
    </>
  ) : (
    property.display.label
  );

  return (
    <div className={isDependant ? "schema-field--dependant" : undefined}>
      <FormGroup
        label={fieldLabel}
        isRequired={property.required}
        fieldId={fieldId}
      >
        {renderField()}
        {error ? (
          <FormHelperText>
            <HelperText>
              <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                {error}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        ) : (
          <FormHelperText>
            <HelperText>
              <HelperTextItem>{property.display.description}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>
    </div>
  );
};

export default SchemaField;
