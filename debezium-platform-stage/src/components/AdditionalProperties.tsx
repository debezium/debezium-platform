import React, { useState, useRef } from "react";
import {
  Button,
  FormGroup,
  Grid,
  Split,
  SplitItem,
  TextInput,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  MenuToggleElement,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Form,
} from "@patternfly/react-core";
import { PlusIcon, TimesIcon, TrashIcon } from "@patternfly/react-icons";
import { useTranslation } from "react-i18next";

import "./AdditionalProperties.css";

interface AdditionalPropertiesProps {
  properties: Map<string, { key: string; value: string }>;
  schemaPropertyNames: string[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onChange: (id: string, type: "key" | "value", value: string) => void;
  errorKeys: string[];
}

interface TypeaheadKeyInputProps {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
  fieldId: string;
}

const TypeaheadKeyInput: React.FC<TypeaheadKeyInputProps> = ({
  value,
  suggestions,
  onChange,
  fieldId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterValue, setFilterValue] = useState("");
  const textInputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = React.useMemo(() => {
    if (!filterValue) return suggestions;
    return suggestions.filter((s) =>
      s.toLowerCase().includes(filterValue.toLowerCase())
    );
  }, [suggestions, filterValue]);

  const onSelect = (
    _e: React.MouseEvent<Element, MouseEvent> | undefined,
    val: string | number | undefined
  ) => {
    if (val) {
      onChange(String(val));
      setFilterValue("");
      setIsOpen(false);
    }
  };

  const onTextInputChange = (
    _e: React.FormEvent<HTMLInputElement>,
    val: string
  ) => {
    setFilterValue(val);
    onChange(val);
    if (!isOpen) setIsOpen(true);
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      onClick={() => {
        setIsOpen(!isOpen);
        textInputRef.current?.focus();
      }}
      isExpanded={isOpen}
      isFullWidth
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={value}
          onClick={() => !isOpen && setIsOpen(true)}
          onChange={onTextInputChange}
          id={fieldId}
          autoComplete="off"
          innerRef={textInputRef}
          placeholder="Property key"
          role="combobox"
          isExpanded={isOpen}
        />
        <TextInputGroupUtilities
          {...(!value ? { style: { display: "none" } } : {})}
        >
          <Button
            variant="plain"
            onClick={() => {
              onChange("");
              setFilterValue("");
              textInputRef.current?.focus();
            }}
            aria-label="Clear"
            icon={<TimesIcon />}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <Select
      id={`${fieldId}-select`}
      isOpen={isOpen}
      selected={value}
      onSelect={onSelect}
      onOpenChange={(open) => !open && setIsOpen(false)}
      toggle={toggle}
      variant="typeahead"
      isScrollable
      maxMenuHeight="min(50vh, 320px)"
    >
      <SelectList>
        {filteredOptions.length === 0 ? (
          <SelectOption isDisabled value="no-results">
            No matching properties
          </SelectOption>
        ) : (
          filteredOptions.slice(0, 50).map((opt) => (
            <SelectOption key={opt} value={opt}>
              {opt}
            </SelectOption>
          ))
        )}
      </SelectList>
    </Select>
  );
};

const AdditionalProperties: React.FC<AdditionalPropertiesProps> = ({
  properties,
  schemaPropertyNames,
  onAdd,
  onDelete,
  onChange,
  errorKeys,
}) => {
  const { t } = useTranslation();

  return (
    <Form isWidthLimited>
      <FormGroup fieldId="additional-properties-group">
        {Array.from(properties.entries()).map(([id, prop]) => (
          <Split hasGutter key={id} className="additional-properties-row">
            <SplitItem isFilled>
              <Grid hasGutter md={6}>
                <FormGroup label="" fieldId={`addprop-key-${id}`}>
                  <TypeaheadKeyInput
                    value={prop.key}
                    suggestions={schemaPropertyNames}
                    onChange={(val) => onChange(id, "key", val)}
                    fieldId={`addprop-key-input-${id}`}
                  />
                </FormGroup>
                <FormGroup label="" fieldId={`addprop-value-${id}`}>
                  <TextInput
                    type="text"
                    id={`addprop-value-input-${id}`}
                    placeholder="Value"
                    value={prop.value}
                    validated={errorKeys.includes(id) ? "error" : "default"}
                    onChange={(_e, val) => onChange(id, "value", val)}
                  />
                </FormGroup>
              </Grid>
            </SplitItem>
            <SplitItem>
              <Button
                variant="plain"
                aria-label="Remove"
                onClick={() => onDelete(id)}
              >
                <TrashIcon />
              </Button>
            </SplitItem>
          </Split>
        ))}
      </FormGroup>
      <Button variant="secondary" icon={<PlusIcon />} onClick={onAdd}>
        {t("form.addFieldButton", "Add property")}
      </Button>
    </Form>
  );
};

export default AdditionalProperties;
