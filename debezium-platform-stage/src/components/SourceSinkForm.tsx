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
  ClipboardCopy,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Alert,
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
  FormFieldGroupExpandable,
} from "@patternfly/react-core";
import { AddCircleOIcon, CheckCircleIcon, PlusIcon, TimesIcon, TrashIcon } from "@patternfly/react-icons";
import { getConnectionRole, getConnectorTypeName, getDatabaseType } from "@utils/helpers";
import ConnectorImage from "./ComponentImage";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { Connection, ConnectionConfig, fetchData, fetchDataCall, TableData, verifySignals } from "src/apis";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/index";
import { useQuery } from "react-query";
import TableViewComponent from "./TableViewComponent";
import "./SourceSinkForm.css";
import ApiComponentError from "./ApiComponentError";
import _ from "lodash";
import { SelectedDataListItem } from "@sourcePage/CreateSource";
import { datatype as DatabaseItemsList } from "@utils/Datatype";


const getInitialSelectOptions = (connections: connectionsList[]): SelectOptionProps[] => {
  return connections.map((connection) => ({
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
  connectorType: "source" | "destination";
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
  editFlow?: boolean;
  viewMode?: boolean;
  setSelectedConnection: (connection: ConnectionConfig | undefined) => void;
  selectedConnection: ConnectionConfig | undefined;
  updateSignalCollectionName?: (name: string) => void;
  handleConnectionModalToggle: () => void;
  setSelectedDataListItems: (dataListItems: SelectedDataListItem | undefined) => void;

}
const SourceSinkForm = ({
  ConnectorId,
  dataType,
  connectorType,
  properties,
  setValue,
  getValue,
  setError,
  errorWarning,
  errors,
  handleAddProperty,
  handleDeleteProperty,
  handlePropertyChange,
  editFlow,
  viewMode,
  setSelectedConnection,
  selectedConnection,
  updateSignalCollectionName,
  handleConnectionModalToggle,
  setSelectedDataListItems
}: SourceSinkFormProps) => {
  const { t } = useTranslation();
  const { addNotification } = useNotification();

  const connectorLabel = connectorType === "source" ? "Source" : "Destination";

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const [signalCollectionName, setSignalCollectionName] = useState("");
  const [signalVerified, setSignalVerified] = useState(false);
  const [signalMissingPayloads, setSignalMissingPayload] = useState<string[]>([]);

  const [isCollectionsLoading, setIsCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState<object | undefined>(undefined);
  const [collections, setCollections] = useState<TableData | undefined>(undefined);

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [filterValue, setFilterValue] = useState<string>('');
  const [selectOptions, setSelectOptions] = useState<SelectOptionProps[]>();
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [connections, setConnections] = useState<connectionsList[]>([]);

  const NO_RESULTS = 'no results';

  const [setDone, setSetDone] = useState(false);

  const {
    isLoading: isConnectionsLoading,
  } = useQuery<Connection[], Error>(
    "connections",
    () => fetchData<Connection[]>(`${API_URL}/api/connections`),
    {
      refetchInterval: 70000,
      onSuccess: (data) => {
        // Persist filters across polling refreshes by deriving from latest data
        const withRole = data.map((conn) => ({
          ...conn,
          role: getConnectionRole(conn.type.toLowerCase()) || "",
        }));
        const result = withRole;
        setConnections(result);
      },
    }
  );


  useEffect(() => {
    setSelectOptions(getInitialSelectOptions(connections));
  }, [connections]);

  useEffect(() => {
    setInputValue(selectedConnection?.name || "");
  }, [selectedConnection]);

  useEffect(() => {
    if (!selectOptions) return;
    let newSelectOptions: SelectOptionProps[] = selectOptions;

    // Filter menu items based on the text input value when one exists
    if (filterValue) {
      newSelectOptions = selectOptions.filter((menuItem) =>
        String(menuItem.children).toLowerCase().includes(filterValue.toLowerCase())
      );

      // When no options are found after filtering, display 'No results found'
      if (!newSelectOptions.length) {
        newSelectOptions = [
          { isAriaDisabled: true, children: `No results found for "${filterValue}"`, value: NO_RESULTS }
        ];
      }

      // Open the menu when the input value changes and the new value is not empty
      if (!isOpen) {
        setIsOpen(true);
      }
    }

    setSelectOptions(newSelectOptions);
  }, [filterValue, selectOptions]);

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

      // Skip disabled options
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

  const handleModalToggle = () => {
    setSignalCollectionName("");
    setIsModalOpen(!isModalOpen);
    setSignalMissingPayload([]);
  };

  const verifySignalsHandler = async () => {
    setIsLoading(true);
    const fromValues = properties.values();
    const formValuesCopy = new Map();
    Array.from(fromValues).map((property) => {
      const { key, value } = property;
      formValuesCopy.set(key, value);
    });


    const payload = {
      databaseType: getDatabaseType(ConnectorId),
      hostname: formValuesCopy.get("database.hostname"),
      port: formValuesCopy.get("database.port"),
      username: formValuesCopy.get("database.user"),
      password: formValuesCopy.get("database.password"),
      dbName: formValuesCopy.get("database.dbname"),
      fullyQualifiedTableName: signalCollectionName
    }

    const requiredFields = ["hostname", "port", "username", "password", "dbName"];
    const missingFields = requiredFields.filter((field) => !payload[field as keyof typeof payload]);

    if (missingFields.length > 0) {
      setSignalMissingPayload(missingFields);
      setIsLoading(false);
      return;

    }
    const response = await verifySignals(`${API_URL}/api/sources/signals/verify`, payload);

    if (response.error) {

      addNotification(
        "danger",
        `Signal verification failed`,
        `Coudn't verify the signal data collection: ${response.error}`
      );
      setIsLoading(false);
    } else {
      setSignalVerified(true);
      addNotification(
        "success",
        `Signal verification succesfully`,
        `Signal data collection verified succesfully: ${signalCollectionName}`
      );
      setIsLoading(false);
    }
  }

  const configureSignalCollection = async () => {
    setIsLoading(true);
    if (updateSignalCollectionName) {
      updateSignalCollectionName(signalCollectionName);
    }
    setSetDone(true);
    setIsLoading(false);
    setIsModalOpen(false);
  }

  const fetchCollections = async () => {
    setIsCollectionsLoading(true);
    const response = await fetchDataCall<TableData>(
      `${API_URL}/api/connections/${selectedConnection?.id}/collections`
    );
    if (response.error) {
      setCollectionsError(response.error.body || {});
    } else {
      setCollectionsError(undefined);
      setCollections(response.data as TableData);
    }

    setIsCollectionsLoading(false);
  };

  useEffect(() => {
    if (selectedConnection?.id) {
      fetchCollections();
    }
  }, [selectedConnection]);

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


              {!viewMode && (<FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {t("connection:link.helperText")}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>)}
            </FormGroup>


            {
              (!!selectedConnection?.id && connectorType === "source") ? isCollectionsLoading ?
                <FormFieldGroup>
                  <Skeleton fontSize="2xl" width="50%" />
                  <Skeleton fontSize="md" width="33%" />
                  <Skeleton fontSize="md" width="33%" />
                </FormFieldGroup> : !_.isEmpty(collectionsError) ? (
                  <FormFieldGroup>
                    <ApiComponentError
                      error={
                        collectionsError
                      }
                      retry={() => {
                        fetchCollections();
                      }}
                    />
                  </FormFieldGroup>
                ) : <FormFieldGroupExpandable
                  className="table-explorer-section"
                  hasAnimations
                  isExpanded
                  header={
                    <FormFieldGroupHeader
                      titleText={{
                        text: <span style={{ fontWeight: 500 }}>{t("source:create.dataTableTitle", { val: getConnectorTypeName(dataType || ConnectorId || "") })}</span>,
                        id: `field-group-data-table-id`,
                      }}
                      titleDescription={t("source:create.dataTableDescription", { val: DatabaseItemsList[ConnectorId as keyof typeof DatabaseItemsList].join(" and ") })}
                    />
                  }
                >
                  <TableViewComponent collections={collections} setSelectedDataListItems={setSelectedDataListItems} />
                </FormFieldGroupExpandable>
                : null}

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
            {
              connectorType === "source" && !editFlow &&
              <FormFieldGroup
                header={
                  <FormFieldGroupHeader
                    titleText={{
                      text: <span style={{ fontWeight: 500 }}>{t("source:signal.title")}</span>,
                      id: `field-group-signal-id`,
                    }}
                    titleDescription={t("source:signal.description")}
                  />
                }
              >
                <Button variant="link" size="lg" icon={setDone ? <CheckCircleIcon style={{ color: "#3D7318" }} /> : <AddCircleOIcon />} iconPosition="left" onClick={handleModalToggle}>
                  {t("source:signal.setupSignaling")}
                </Button>

              </FormFieldGroup>
            }



          </Form>
        </CardBody>
      </Card>
      <Modal
        variant={ModalVariant.medium}
        isOpen={isModalOpen}
        onClose={handleModalToggle}
        aria-labelledby="modal-with-description-title"
        aria-describedby="modal-box-body-with-description"
      >
        <ModalHeader
          title={t("source:signal.title")}
          labelId="modal-with-description-title"
          description={t("source:signal.modelDescription")}
        />
        <ModalBody tabIndex={0} id="modal-box-body-with-description">
          {signalMissingPayloads.length > 0 && (<Alert variant="danger" isInline isPlain title={t('source:signal.errorMsg', { val: signalMissingPayloads.join(", ") })} style={{ paddingBottom: "15px" }} />)}

          <Form isWidthLimited>
            <FormGroup
              label={t("source:signal.signalingCollectionField.label")}
              isRequired
              fieldId={`signaling-collection-name`}
            >
              <TextInput
                id={`signaling-collection-name`}
                aria-label={t("source:signal.signalingCollectionField.label")}
                type="text"
                onChange={(_event, value) => {
                  setSignalCollectionName(value);
                }}
                value={signalCollectionName}
              />
            </FormGroup>
            <FormGroup
              label={t("source:signal.ddlQuery")}
              fieldId={`ddl-query-name`}
            >
              <ClipboardCopy isReadOnly hoverTip={t('copy')} clickTip={t('copied')}>
                {`CREATE TABLE ${signalCollectionName} (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);`}
              </ClipboardCopy>
            </FormGroup>

            {/* <Checkbox
              isLabelWrapped
              label="DDL has been executed by the DBA"
              id="checkbox-label-wraps-input"
              name="checkbox-label-wraps-input"
            /> */}
          </Form>
          {/* <Alert variant="danger" title="Danger alert title" ouiaId="DangerAlert" /> */}
        </ModalBody>

        <ModalFooter>
          {signalVerified ?
            <Button key="done" variant="primary" isLoading={isLoading} onClick={configureSignalCollection} >
              {t("done")}
            </Button>
            :
            <Button key="confirm" variant="primary" isLoading={isLoading} onClick={verifySignalsHandler} >
              {t('verify')}
            </Button>}
          <Button key="cancel" variant="link" onClick={handleModalToggle}>
            {t("cancel")}
          </Button>
        </ModalFooter>
      </Modal>

    </>
  );
};

export default SourceSinkForm;
