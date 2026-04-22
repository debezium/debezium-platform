import {
  Card,
  CardBody,
  FormGroup,
  Content,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
  FormFieldGroup,
  FormFieldGroupHeader,
  Button,
  Split,
  SplitItem,
  Grid,
  Form,
  InputGroup,
  InputGroupItem,
  Select,
  SelectList,
  SelectOption,
  SelectOptionProps,
  MenuToggle,
  MenuToggleElement,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Skeleton,
} from "@patternfly/react-core";
import { ExclamationCircleIcon, PlusIcon, TimesIcon, TrashIcon } from "@patternfly/react-icons";
import { getConnectionRole, getConnectorTypeName } from "@utils/helpers";
import { Catalog } from "../apis/types";
import destinationCatalog from "../__mocks__/data/DestinationCatalog.json";
import ConnectorImage from "./ComponentImage";
import { useTranslation } from "react-i18next";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Connection, ConnectionConfig, fetchData } from "src/apis";
import { API_URL } from "@utils/constants";
import { useQuery } from "react-query";
import "./SourceSinkForm.css";


const getInitialSelectOptions = (connections: connectionsList[], connectorId: string): SelectOptionProps[] => {
  const connectorLower = connectorId.toLowerCase();
  return connections.filter((connection) => {
    const typeLower = connection.type.toLowerCase();
    return typeLower === connectorLower || connectorLower.includes(typeLower) || typeLower.includes(connectorLower);
  }).map((connection) => ({
    value: connection.id,
    children: connection.name,
    icon: <ConnectorImage connectorType={connection.type.toLowerCase() || ""} size={25} />,
  }));
}

export interface connectionsList extends Connection {
  role: string;
}

interface SourceSinkFormProps {
  ConnectorId: string;
  dataType?: string;
  errorWarning: string[];
  properties: Map<string, { key: string; value: string }>;
  setValue: (key: string, value: string) => void;
  getValue: (key: string) => string;
  setError: (key: string, error: string | undefined) => void;
  errors: Record<string, string | undefined>;
  handleAddProperty: () => void;
  handleDeleteProperty: (key: string) => void;
  handlePropertyChange: (
    key: string,
    type: "key" | "value",
    value: string
  ) => void;
  viewMode?: boolean;
  setSelectedConnection: (connection: ConnectionConfig | undefined) => void;
  selectedConnection: ConnectionConfig | undefined;
  handleConnectionModalToggle: () => void;
}
const SourceSinkForm = ({
  ConnectorId,
  dataType,
  properties,
  setValue,
  getValue,
  setError,
  errorWarning,
  errors,
  handleAddProperty,
  handleDeleteProperty,
  handlePropertyChange,
  viewMode,
  setSelectedConnection,
  selectedConnection,
  handleConnectionModalToggle,
}: SourceSinkFormProps) => {
  const { t } = useTranslation();

  const connectorType = "destination" as const;
  const connectorLabel = "Destination";

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>(() => selectedConnection?.name || "");
  const [filterValue, setFilterValue] = useState<string>('');
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [connections, setConnections] = useState<connectionsList[]>([]);

  const NO_RESULTS = 'no results';

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- keep typeahead text in sync when persisted connection id/name change */
    setInputValue(selectedConnection?.name ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedConnection?.id, selectedConnection?.name]);

  const catalog: Catalog[] = destinationCatalog as Catalog[];

  const {
    isLoading: isConnectionsLoading,
  } = useQuery<Connection[], Error>(
    "connections",
    () => fetchData<Connection[]>(`${API_URL}/api/connections`),
    {
      refetchInterval: 70000,
      onSuccess: (data) => {
        const withRole = data.map((conn) => ({
          ...conn,
          role: getConnectionRole(conn.type.toLowerCase(), catalog) || "",
        }));
        setConnections(withRole);
      },
    }
  );

  const baseSelectOptions = React.useMemo(() => {
    return getInitialSelectOptions(connections, dataType || ConnectorId);
  }, [connections, dataType, ConnectorId]);

  const selectOptions = React.useMemo(() => {
    if (!baseSelectOptions) return undefined;
    if (filterValue) {
      const filtered = baseSelectOptions.filter((menuItem) =>
        String(menuItem.children).toLowerCase().includes(filterValue.toLowerCase())
      );
      if (!filtered.length) {
        return [
          { isAriaDisabled: true, children: `No results found for "${filterValue}"`, value: NO_RESULTS }
        ];
      }
      return filtered;
    }
    return baseSelectOptions;
  }, [baseSelectOptions, filterValue, NO_RESULTS]);

  const createItemId = (value: unknown) => `select-typeahead-${String(value ?? '').replace(/\s+/g, '-')}`;

  const setActiveAndFocusedItem = (itemIndex: number) => {
    setFocusedItemIndex(itemIndex);
    const focusedItem = selectOptions?.[itemIndex];
    setActiveItemId(createItemId(focusedItem?.value));
  };

  const resetActiveAndFocusedItem = () => {
    setFocusedItemIndex(null);
    setActiveItemId(null);
  };

  const closeMenu = () => {
    setIsOpen(false);
    resetActiveAndFocusedItem();
  };

  const onInputClick = () => {
    if (!isOpen) {
      setIsOpen(true);
    } else if (!inputValue) {
      closeMenu();
    }
  };

  const selectOption = (value: string | number, content: string | number) => {
    setInputValue(String(content));
    setFilterValue('');
    setSelectedConnection({ id: value as number, name: content as string });
    closeMenu();
  };

  const onSelect = (_event: React.MouseEvent<Element, MouseEvent> | undefined, value: string | number | undefined) => {
    setError("connection", undefined);
    if (value && value !== NO_RESULTS) {
      const optionText = selectOptions?.find((option) => option.value === value)?.children;
      selectOption(value, optionText as string);
    }
  };

  const onTextInputChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => {
    setInputValue(value);
    setFilterValue(value);
    resetActiveAndFocusedItem();
    if (value !== selectedConnection?.name) {
      setSelectedConnection(undefined);
    }
    if (value && !isOpen) {
      setIsOpen(true);
    }
  };

  const handleMenuArrowKeys = (key: string) => {
    let indexToFocus = 0;

    if (!isOpen) {
      setIsOpen(true);
    }

    if (selectOptions?.every((option) => option.isDisabled)) {
      return;
    }

    if (key === 'ArrowUp') {
      // When no index is set or at the first index, focus to the last, otherwise decrement focus index
      if (focusedItemIndex === null || focusedItemIndex === 0) {
        indexToFocus = selectOptions ? selectOptions.length - 1 : 0;
      } else {
        indexToFocus = focusedItemIndex - 1;
      }

      while (selectOptions && selectOptions[indexToFocus]?.isDisabled) {
        indexToFocus--;
        if (indexToFocus === -1) {
          indexToFocus = selectOptions ? selectOptions.length - 1 : 0;
        }
      }
    }

    if (key === 'ArrowDown') {
      // When no index is set or at the last index, focus to the first, otherwise increment focus index
      if (focusedItemIndex === null || focusedItemIndex === selectOptions!.length - 1) {
        indexToFocus = 0;
      } else {
        indexToFocus = focusedItemIndex + 1;
      }

      // Skip disabled options
      while (selectOptions && selectOptions[indexToFocus]?.isDisabled) {
        indexToFocus++;
        if (indexToFocus === selectOptions!.length) {
          indexToFocus = 0;
        }
      }
    }

    setActiveAndFocusedItem(indexToFocus);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const focusedItem = focusedItemIndex !== null ? selectOptions?.[focusedItemIndex] : null;

    switch (event.key) {
      case 'Enter':
        if (isOpen && focusedItem && focusedItem.value !== NO_RESULTS && !focusedItem.isAriaDisabled) {
          selectOption(focusedItem.value, focusedItem.children as string);
        }

        if (!isOpen) {
          setIsOpen(true);
        }

        break;
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault();
        handleMenuArrowKeys(event.key);
        break;
    }
  };

  const onToggleClick = () => {
    setIsOpen(!isOpen);
    textInputRef?.current?.focus();
  };

  const onClearButtonClick = () => {
    setSelectedConnection(undefined);
    setInputValue('');
    setFilterValue('');
    resetActiveAndFocusedItem();
    textInputRef?.current?.focus();
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      aria-label="Typeahead menu toggle"
      onClick={onToggleClick}
      isExpanded={isOpen}
      isFullWidth
      status={errors[`connection`] ? "danger" : undefined}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValue}
          onClick={onInputClick}
          onChange={onTextInputChange}
          onKeyDown={onInputKeyDown}
          id="typeahead-select-input"
          autoComplete="off"
          innerRef={textInputRef}
          placeholder={t("connection:link.selectConnection")}
          {...(activeItemId && { 'aria-activedescendant': activeItemId })}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="select-typeahead-listbox"
        />

        <TextInputGroupUtilities {...(!inputValue ? { style: { display: 'none' } } : {})}>
          <Button variant="plain" onClick={onClearButtonClick} aria-label="Clear input value" icon={<TimesIcon />} />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <>
      <Card className="custom-card-body">
        <CardBody isFilled>
          <Form isWidthLimited>
            <FormGroup
              label={t("form.field.type", { val: connectorLabel })}
              isRequired
              fieldId={`${connectorType}-type-field`}
            >
              <>
                <ConnectorImage connectorType={dataType || ConnectorId || ""} size={35} />
                <Content component="p" style={{ paddingLeft: "10px" }}>
                  {getConnectorTypeName(dataType || ConnectorId || "")}
                </Content>
              </>
            </FormGroup>
            <FormGroup
              label={t("form.field.name", { val: connectorLabel })}
              isRequired
              fieldId={`${connectorType}-name-field`}
            >
              <TextInput
                readOnlyVariant={viewMode ? "plain" : undefined}
                id={`${connectorType}-name`}
                aria-label={`${connectorLabel} name`}
                onChange={(_event, value) => {
                  setValue(`${connectorType}-name`, value);
                  setError(`${connectorType}-name`, undefined);
                }}
                value={getValue(`${connectorType}-name`)}
                validated={errors[`${connectorType}-name`] ? "error" : "default"}
              />
              {errors[`${connectorType}-name`] && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                     {errors[`${connectorType}-name`]}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>)}

            </FormGroup>
            <FormGroup
              label={t("form.field.description.label")}
              fieldId={`${connectorType}-description-field`}
            >
              <TextInput
                readOnlyVariant={viewMode ? "plain" : undefined}
                id={`${connectorType}-description`}
                aria-label={`${connectorLabel} description`}
                onChange={(_event, value) => setValue("description", value)}
                value={getValue(`description`)}
              />
              {!viewMode && (<FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {t("form.field.description.helper", { val: connectorType })}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>)}
            </FormGroup>
            <FormGroup
              label={t("connection:link.connectionFieldLabel", { val: connectorLabel })}
              isRequired
              fieldId={`${connectorType}-connection-field`}
            >
              {viewMode ? (<>{selectedConnection?.name}</>) : (<InputGroup>
                <InputGroupItem isFill >
                  <Select
                    id="typeahead-select"
                    isOpen={isOpen}
                    selected={selectedConnection}
                    onSelect={onSelect}
                    onOpenChange={(isOpen) => {
                      !isOpen && closeMenu();
                    }}
                    toggle={toggle}
                    variant="typeahead"
                  >
                    <SelectList id="select-typeahead-listbox">

                      {isConnectionsLoading ? <><SelectOption isDisabled><Skeleton /></SelectOption><SelectOption isDisabled><Skeleton /></SelectOption><SelectOption isDisabled><Skeleton /></SelectOption></> : selectOptions?.map((option, index) => (
                        <SelectOption
                          key={option.value || option.children}
                          isFocused={focusedItemIndex === index}
                          icon={option.icon}
                          className={option.className}
                          id={createItemId(option.value)}
                          {...option}
                          ref={null}
                        />
                      ))}
                    </SelectList>
                  </Select>
                </InputGroupItem>
                <InputGroupItem>
                  <Button id="inputDropdownButton1" variant="control" icon={<PlusIcon />} onClick={handleConnectionModalToggle}>
                    {t("connection:link.createConnection")}
                  </Button>
                </InputGroupItem>
              </InputGroup>)}


              {!viewMode && !errors[`connection`] && (<FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {t("connection:link.helperText")}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>)}

              {errors[`connection`] ? (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                      {errors[`connection`]}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>) : null}
            </FormGroup>

            <FormFieldGroup
              header={
                <FormFieldGroupHeader
                  titleText={{
                    text: <span style={{ fontWeight: 500 }}>{t("form.subHeading.title")}</span>,
                    id: `field-group-${connectorType}-id`,
                  }}
                  titleDescription={!viewMode ? t("form.subHeading.description") : undefined}
                  actions={
                    viewMode ? null :
                      <>
                        <Button
                          variant="secondary"
                          icon={<PlusIcon />}
                          onClick={handleAddProperty}
                        >
                          {t("form.addFieldButton")}
                        </Button>
                      </>
                  }
                />
              }
            >
              {Array.from(properties.keys()).map((key) => (
                <Split hasGutter key={key}>
                  <SplitItem isFilled>
                    <Grid hasGutter md={6}>
                      <FormGroup
                        label=""
                        isRequired
                        fieldId={`${connectorType}-config-props-key-field-${key}`}
                      >
                        <TextInput
                          readOnlyVariant={viewMode ? "default" : undefined}
                          isRequired
                          type="text"
                          placeholder="Key"
                          validated={errorWarning.includes(key) ? "error" : "default"}
                          id={`${connectorType}-config-props-key-${key}`}
                          name={`${connectorType}-config-props-key-${key}`}
                          value={properties.get(key)?.key || ""}
                          onChange={(_e, value) =>
                            handlePropertyChange(key, "key", value)
                          }
                        />
                      </FormGroup>
                      <FormGroup
                        label=""
                        isRequired
                        fieldId={`${connectorType}-config-props-value-field-${key}`}
                      >
                        <TextInput
                          readOnlyVariant={viewMode ? "default" : undefined}
                          isRequired
                          type="text"
                          id={`${connectorType}-config-props-value-${key}`}
                          placeholder="Value"
                          validated={errorWarning.includes(key) ? "error" : "default"}
                          name={`${connectorType}-config-props-value-${key}`}
                          value={properties.get(key)?.value || ""}
                          onChange={(_e, value) =>
                            handlePropertyChange(key, "value", value)
                          }
                        />
                      </FormGroup>
                    </Grid>
                  </SplitItem>
                  <SplitItem>
                    <Button
                      variant="plain"
                      isDisabled={viewMode}
                      aria-label="Remove"
                      onClick={() => handleDeleteProperty(key)}
                    >
                      <TrashIcon />
                    </Button>
                  </SplitItem>
                </Split>
              ))}
            </FormFieldGroup>

          </Form>
        </CardBody>
      </Card>

    </>
  );
};

export default SourceSinkForm;
