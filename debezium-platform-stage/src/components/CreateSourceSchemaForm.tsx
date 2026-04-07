import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Content,
  Form,
  FormFieldGroup,
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  InputGroup,
  InputGroupItem,
  JumpLinks,
  JumpLinksItem,
  MenuToggle,
  MenuToggleElement,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Select,
  SelectList,
  SelectOption,
  SelectOptionProps,
  Skeleton,
  Split,
  SplitItem,
  Tab,
  Tabs,
  TabTitleText,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  ToggleGroup,
  ToggleGroupItem,
  Alert,
  ClipboardCopy,
} from "@patternfly/react-core";
import {
  AddCircleOIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ListIcon,
  PlusIcon,
  ThLargeIcon,
  TimesIcon,
} from "@patternfly/react-icons";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import {
  Connection,
  ConnectionConfig,
  fetchData,
  fetchDataCall,
  TableData,
  verifySignals,
} from "src/apis";
import { API_URL } from "@utils/constants";
import {
  getConnectionRole,
  getConnectorTypeName,
  getDatabaseType,
} from "@utils/helpers";
import { useNotification } from "@appContext/index";
import { Catalog, CatalogApiResponse, ConnectorSchema, SchemaProperty } from "../apis/types";
import destinationCatalog from "../__mocks__/data/DestinationCatalog.json";
import ConnectorImage from "./ComponentImage";
import TableViewComponent from "./TableViewComponent";
import SchemaGroupSection from "./SchemaGroupSection";
import AdditionalProperties from "./AdditionalProperties";
import ApiComponentError from "./ApiComponentError";
import CreateConnectionModal from "../pages/components/CreateConnectionModal";
import { SelectedDataListItem } from "@sourcePage/CreateSource";
import { datatype as DatabaseItemsList } from "@utils/Datatype";
import _ from "lodash";
import "./CreateSourceSchemaForm.css";

// --- Types ---

interface connectionsList extends Connection {
  role: string;
}

type AdditionalProp = { key: string; value: string };

interface CreateSourceSchemaFormProps {
  connectorSchema: ConnectorSchema;
  sourceId: string;
  dataType?: string;
  onSubmit: (payload: Record<string, unknown>) => void;
}

export interface CreateSourceSchemaFormHandle {
  validate: () => boolean;
  submit: () => void;
}

// --- Helpers ---

const getInitialSelectOptions = (
  connections: connectionsList[],
  connectorId: string
): SelectOptionProps[] => {
  const connectorLower = connectorId.toLowerCase();
  return connections
    .filter((c) => {
      const tl = c.type.toLowerCase();
      return tl === connectorLower || connectorLower.includes(tl) || tl.includes(connectorLower);
    })
    .map((c) => ({
      value: c.id,
      children: c.name,
      icon: <ConnectorImage connectorType={c.type.toLowerCase()} size={25} />,
    }));
};

const buildDependencyMap = (
  properties: SchemaProperty[]
): Map<string, Map<string, string[]>> => {
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
};

const collectAllDependants = (
  properties: SchemaProperty[]
): Set<string> => {
  const set = new Set<string>();
  for (const prop of properties) {
    for (const dep of prop.valueDependants) {
      for (const d of dep.dependants) {
        set.add(d);
      }
    }
  }
  return set;
};

// --- Component ---

const CreateSourceSchemaForm = React.forwardRef<
  CreateSourceSchemaFormHandle,
  CreateSourceSchemaFormProps
>(({ connectorSchema, sourceId, dataType, onSubmit }, ref) => {
  const { t } = useTranslation();
  const { addNotification } = useNotification();

  // Layout toggle
  const [layoutMode, setLayoutMode] = useState<"jumplinks" | "tabs">("jumplinks");

  // Form values: name, description
  const [sourceName, setSourceName] = useState("");
  const [description, setDescription] = useState("");

  // Schema field values
  const [schemaValues, setSchemaValues] = useState<Record<string, string>>({});

  // Additional properties
  const [additionalProps, setAdditionalProps] = useState<Map<string, AdditionalProp>>(
    new Map()
  );
  const [additionalKeyCount, setAdditionalKeyCount] = useState(0);
  const [additionalErrorKeys, setAdditionalErrorKeys] = useState<string[]>([]);

  // Connection
  const [selectedConnection, setSelectedConnection] = useState<ConnectionConfig | undefined>();
  const [connections, setConnections] = useState<connectionsList[]>([]);
  const [isConnectionOpen, setIsConnectionOpen] = useState(false);
  const [connectionInputValue, setConnectionInputValue] = useState("");
  const [connectionFilterValue, setConnectionFilterValue] = useState("");
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const connectionInputRef = useRef<HTMLInputElement>(null);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

  // Table explorer
  const [collections, setCollections] = useState<TableData | undefined>();
  const [isCollectionsLoading, setIsCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState<object | undefined>();
  const [selectedDataListItems, setSelectedDataListItems] = useState<SelectedDataListItem | undefined>();

  // Signal
  const [signalCollectionName, setSignalCollectionName] = useState("");
  const [isSignalModalOpen, setIsSignalModalOpen] = useState(false);
  const [signalCollectionNameVerify, setSignalCollectionNameVerify] = useState("");
  const [signalVerified, setSignalVerified] = useState(false);
  const [signalMissingConnection, setSignalMissingConnection] = useState(false);
  const [isSignalLoading, setIsSignalLoading] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  // Tabs
  const [activeTabKey, setActiveTabKey] = useState(0);

  // Scrollable ref for JumpLinks
  const scrollableRef = useRef<HTMLDivElement>(null);

  // --- Computed ---

  const orderedGroups = useMemo(
    () => [...connectorSchema.groups].sort((a, b) => a.order - b.order),
    [connectorSchema.groups]
  );

  const groupedProperties = useMemo(() => {
    const map = new Map<string, SchemaProperty[]>();
    for (const prop of connectorSchema.properties) {
      const group = prop.display.group;
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(prop);
    }
    return map;
  }, [connectorSchema.properties]);

  const dependencyMap = useMemo(
    () => buildDependencyMap(connectorSchema.properties),
    [connectorSchema.properties]
  );

  const allDependants = useMemo(
    () => collectAllDependants(connectorSchema.properties),
    [connectorSchema.properties]
  );

  const schemaPropertyNames = useMemo(
    () => connectorSchema.properties.map((p) => p.name),
    [connectorSchema.properties]
  );

  const allSections = useMemo(() => {
    const sections: { id: string; label: string; type: "custom" | "schema" }[] = [
      { id: "connector-essentials", label: "Connector Essentials", type: "custom" },
    ];
    for (const group of orderedGroups) {
      const props = groupedProperties.get(group.name);
      if (props && props.length > 0) {
        sections.push({
          id: `group-${group.name.replace(/\s+/g, "-").toLowerCase()}`,
          label: group.name,
          type: "schema",
        });
      }
    }
    sections.push({ id: "additional-properties", label: "Additional Properties", type: "custom" });
    sections.push({ id: "signal-collections", label: "Signal Collections", type: "custom" });
    return sections;
  }, [orderedGroups, groupedProperties]);

  // --- Connection data ---

  const { data: sourceCatalog = [] } = useQuery<Catalog[], Error>(
    "sourceConnectorCatalog",
    async () => {
      const response = await fetchData<CatalogApiResponse>(`${API_URL}/api/catalog`);
      return (response.components["source-connector"] ?? []).map((e) => ({
        ...e,
        role: "source",
      }));
    }
  );

  const catalog: Catalog[] = [...sourceCatalog, ...destinationCatalog];

  const { isLoading: isConnectionsLoading } = useQuery<Connection[], Error>(
    "connections",
    () => fetchData<Connection[]>(`${API_URL}/api/connections`),
    {
      refetchInterval: 70000,
      onSuccess: (data) => {
        setConnections(
          data.map((conn) => ({
            ...conn,
            role: getConnectionRole(conn.type.toLowerCase(), catalog) || "",
          }))
        );
      },
    }
  );

  const baseSelectOptions = useMemo(
    () => getInitialSelectOptions(connections, dataType || sourceId),
    [connections, dataType, sourceId]
  );

  const selectOptions = useMemo(() => {
    if (!baseSelectOptions) return undefined;
    if (connectionFilterValue) {
      const filtered = baseSelectOptions.filter((o) =>
        String(o.children).toLowerCase().includes(connectionFilterValue.toLowerCase())
      );
      if (!filtered.length)
        return [{ isAriaDisabled: true, children: `No results found for "${connectionFilterValue}"`, value: "no-results" }];
      return filtered;
    }
    return baseSelectOptions;
  }, [baseSelectOptions, connectionFilterValue]);

  // --- Connection handlers ---

  useEffect(() => {
    setConnectionInputValue(selectedConnection?.name || "");
  }, [selectedConnection]);

  const createItemId = (value: unknown) =>
    `conn-typeahead-${String(value ?? "").replace(/\s+/g, "-")}`;

  const closeConnectionMenu = () => {
    setIsConnectionOpen(false);
    setFocusedItemIndex(null);
    setActiveItemId(null);
  };

  const selectConnectionOption = (value: string | number, content: string | number) => {
    setConnectionInputValue(String(content));
    setConnectionFilterValue("");
    setSelectedConnection({ id: value as number, name: content as string });
    setErrors((e) => ({ ...e, connection: undefined }));
    closeConnectionMenu();
  };

  const onConnectionSelect = (
    _e: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    if (value && value !== "no-results") {
      const text = selectOptions?.find((o) => o.value === value)?.children;
      selectConnectionOption(value, text as string);
    }
  };

  const onConnectionInputChange = (_e: React.FormEvent<HTMLInputElement>, value: string) => {
    setConnectionInputValue(value);
    setConnectionFilterValue(value);
    setFocusedItemIndex(null);
    setActiveItemId(null);
    if (value !== selectedConnection?.name) setSelectedConnection(undefined);
    if (value && !isConnectionOpen) setIsConnectionOpen(true);
  };

  const onConnectionInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const focusedItem = focusedItemIndex !== null ? selectOptions?.[focusedItemIndex] : null;
    if (event.key === "Enter" && isConnectionOpen && focusedItem && focusedItem.value !== "no-results") {
      selectConnectionOption(focusedItem.value, focusedItem.children as string);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isConnectionOpen) setIsConnectionOpen(true);
      const opts = selectOptions || [];
      if (event.key === "ArrowDown") {
        const next = focusedItemIndex === null || focusedItemIndex >= opts.length - 1 ? 0 : focusedItemIndex + 1;
        setFocusedItemIndex(next);
        setActiveItemId(createItemId(opts[next]?.value));
      } else {
        const prev = focusedItemIndex === null || focusedItemIndex === 0 ? opts.length - 1 : focusedItemIndex - 1;
        setFocusedItemIndex(prev);
        setActiveItemId(createItemId(opts[prev]?.value));
      }
    }
  };

  const connectionToggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      onClick={() => {
        setIsConnectionOpen(!isConnectionOpen);
        connectionInputRef.current?.focus();
      }}
      isExpanded={isConnectionOpen}
      isFullWidth
      status={errors.connection ? "danger" : undefined}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={connectionInputValue}
          onClick={() => !isConnectionOpen && setIsConnectionOpen(true)}
          onChange={onConnectionInputChange}
          onKeyDown={onConnectionInputKeyDown}
          id="conn-typeahead-input"
          autoComplete="off"
          innerRef={connectionInputRef}
          placeholder={t("connection:link.selectConnection")}
          {...(activeItemId && { "aria-activedescendant": activeItemId })}
          role="combobox"
          isExpanded={isConnectionOpen}
        />
        <TextInputGroupUtilities {...(!connectionInputValue ? { style: { display: "none" } } : {})}>
          <Button
            variant="plain"
            onClick={() => {
              setSelectedConnection(undefined);
              setConnectionInputValue("");
              setConnectionFilterValue("");
              setFocusedItemIndex(null);
              setActiveItemId(null);
              connectionInputRef.current?.focus();
            }}
            aria-label="Clear"
            icon={<TimesIcon />}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  // --- Table explorer ---

  const fetchCollections = useCallback(async () => {
    if (!selectedConnection?.id) return;
    setIsCollectionsLoading(true);
    const response = await fetchDataCall<TableData>(
      `${API_URL}/api/connections/${selectedConnection.id}/collections`
    );
    if (response.error) {
      setCollectionsError(response.error.body || {});
    } else {
      setCollectionsError(undefined);
      setCollections(response.data as TableData);
    }
    setIsCollectionsLoading(false);
  }, [selectedConnection]);

  useEffect(() => {
    if (selectedConnection?.id) fetchCollections();
  }, [selectedConnection?.id, fetchCollections]);

  // --- Signal ---

  const handleSignalModalToggle = () => {
    setSignalCollectionNameVerify(signalCollectionName || "");
    setIsSignalModalOpen(!isSignalModalOpen);
    setSignalMissingConnection(false);
    setSignalVerified(false);
  };

  const verifySignalsHandler = async () => {
    setIsSignalLoading(true);
    if (!selectedConnection?.id) {
      setSignalMissingConnection(true);
      setIsSignalLoading(false);
      return;
    }
    const payload = {
      databaseType: getDatabaseType(sourceId),
      connectionConfig: selectedConnection,
      fullyQualifiedTableName: signalCollectionNameVerify,
    };
    const response = await verifySignals(`${API_URL}/api/sources/signals/verify`, payload);
    if (response.error) {
      addNotification("danger", "Signal verification failed", `Couldn't verify: ${response.error}`);
    } else {
      setSignalVerified(true);
      addNotification("success", "Signal verification successful", `Verified: ${signalCollectionNameVerify}`);
    }
    setIsSignalLoading(false);
  };

  const configureSignalCollection = () => {
    setSignalCollectionName(signalCollectionNameVerify);
    setIsSignalModalOpen(false);
  };

  // --- Schema field change ---

  const handleSchemaFieldChange = useCallback((name: string, value: string) => {
    setSchemaValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }, []);

  // --- Additional properties ---

  const handleAdditionalAdd = () => {
    const key = `addprop-${additionalKeyCount}`;
    setAdditionalProps((prev) => new Map(prev).set(key, { key: "", value: "" }));
    setAdditionalKeyCount((c) => c + 1);
  };

  const handleAdditionalDelete = (id: string) => {
    setAdditionalProps((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const handleAdditionalChange = (id: string, type: "key" | "value", value: string) => {
    setAdditionalProps((prev) => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry) {
        if (type === "key") entry.key = value;
        else entry.value = value;
        next.set(id, { ...entry });
      }
      return next;
    });
  };

  // --- Validate & Submit ---

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string | undefined> = {};
    if (!sourceName.trim()) newErrors["source-name"] = t("statusMessage:smartEditor.sourceNameRequired", "Source name is required");
    if (!selectedConnection) newErrors.connection = t("statusMessage:smartEditor.connectionRequired", "Connection is required");

    for (const prop of connectorSchema.properties) {
      if (prop.required && !schemaValues[prop.name]?.trim()) {
        if (!allDependants.has(prop.name)) {
          newErrors[prop.name] = `${prop.display.label} is required`;
        }
      }
    }

    const errKeys: string[] = [];
    additionalProps.forEach((val, key) => {
      if (val.key === "" || val.value === "") errKeys.push(key);
    });
    setAdditionalErrorKeys(errKeys);

    setErrors(newErrors);
    const hasSchemaErrors = Object.values(newErrors).some(Boolean);
    return !hasSchemaErrors && errKeys.length === 0;
  }, [sourceName, selectedConnection, schemaValues, connectorSchema.properties, additionalProps, allDependants, t]);

  React.useImperativeHandle(ref, () => ({ validate, submit: handleSubmit }));

  const handleSubmit = () => {
    if (!validate()) {
      addNotification("danger", "Validation failed", "Please fill all required fields.");
      return;
    }

    const config: Record<string, string> = {};

    for (const [key, value] of Object.entries(schemaValues)) {
      if (value !== "") config[key] = value;
    }

    additionalProps.forEach((prop) => {
      if (prop.key && prop.value) config[prop.key] = prop.value;
    });

    if (signalCollectionName) config["signal.data.collection"] = signalCollectionName;

    if (selectedDataListItems) {
      const { schemas, tables } = selectedDataListItems;
      if (schemas.length > 0) config["schema.include.list"] = schemas.join(",");
      if (tables.length > 0) config["table.include.list"] = tables.join(",");
    }

    onSubmit({
      name: sourceName,
      description,
      type: sourceId,
      schema: "schema321",
      vaults: [],
      ...(selectedConnection ? { connection: selectedConnection } : {}),
      config,
    });
  };

  // --- Render helpers ---

  const renderConnectorEssentials = () => (
    <Form isWidthLimited>
      <FormGroup label={t("form.field.type", { val: "Source" })} isRequired fieldId="source-type-field">
        <Split hasGutter>
          <SplitItem>
            <ConnectorImage connectorType={dataType || sourceId} size={35} />
          </SplitItem>
          <SplitItem>
            <Content component="p">{getConnectorTypeName(dataType || sourceId)}</Content>
          </SplitItem>
        </Split>
      </FormGroup>

      <FormGroup label={t("form.field.name", { val: "Source" })} isRequired fieldId="source-name-field">
        <TextInput
          id="source-name"
          value={sourceName}
          onChange={(_e, val) => {
            setSourceName(val);
            setErrors((e) => ({ ...e, "source-name": undefined }));
          }}
          validated={errors["source-name"] ? "error" : "default"}
        />
        {errors["source-name"] && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                {errors["source-name"]}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label={t("form.field.description.label")} fieldId="source-description-field">
        <TextInput
          id="source-description"
          value={description}
          onChange={(_e, val) => setDescription(val)}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>{t("form.field.description.helper", { val: "source" })}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label={t("connection:link.connectionFieldLabel", { val: "Source" })} isRequired fieldId="source-connection-field">
        <InputGroup>
          <InputGroupItem isFill>
            <Select
              id="conn-typeahead-select"
              isOpen={isConnectionOpen}
              selected={selectedConnection}
              onSelect={onConnectionSelect}
              onOpenChange={(open) => !open && closeConnectionMenu()}
              toggle={connectionToggle}
              variant="typeahead"
            >
              <SelectList id="conn-typeahead-listbox">
                {isConnectionsLoading ? (
                  <>
                    <SelectOption isDisabled><Skeleton /></SelectOption>
                    <SelectOption isDisabled><Skeleton /></SelectOption>
                  </>
                ) : (
                  selectOptions?.map((opt, idx) => (
                    <SelectOption
                      key={opt.value || opt.children}
                      isFocused={focusedItemIndex === idx}
                      icon={opt.icon}
                      className={opt.className}
                      id={createItemId(opt.value)}
                      {...opt}
                      ref={null}
                    />
                  ))
                )}
              </SelectList>
            </Select>
          </InputGroupItem>
          <InputGroupItem>
            <Button
              variant="control"
              icon={<PlusIcon />}
              onClick={() => setIsConnectionModalOpen(true)}
            >
              {t("connection:link.createConnection")}
            </Button>
          </InputGroupItem>
        </InputGroup>
        {errors.connection ? (
          <FormHelperText>
            <HelperText>
              <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                {errors.connection}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        ) : (
          <FormHelperText>
            <HelperText>
              <HelperTextItem>{t("connection:link.helperText")}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      {selectedConnection?.id && (
        isCollectionsLoading ? (
          <FormFieldGroup>
            <Skeleton fontSize="2xl" width="50%" />
            <Skeleton fontSize="md" width="33%" />
          </FormFieldGroup>
        ) : !_.isEmpty(collectionsError) ? (
          <FormFieldGroup>
            <ApiComponentError error={collectionsError} retry={fetchCollections} />
          </FormFieldGroup>
        ) : (
          <FormFieldGroupExpandable
            className="table-explorer-section"
            hasAnimations
            isExpanded
            header={
              <FormFieldGroupHeader
                titleText={{
                  text: (
                    <span style={{ fontWeight: 500 }}>
                      {t("source:create.dataTableTitle", {
                        val: getConnectorTypeName(dataType || sourceId),
                      })}
                    </span>
                  ),
                  id: "field-group-data-table-id",
                }}
                titleDescription={t("source:create.dataTableDescription", {
                  val:
                    DatabaseItemsList[
                      (dataType || sourceId)?.split(".")?.[3] as keyof typeof DatabaseItemsList
                    ]?.join(" and "),
                })}
              />
            }
          >
            <TableViewComponent
              collections={collections}
              setSelectedDataListItems={setSelectedDataListItems}
              selectedDataListItems={selectedDataListItems}
            />
          </FormFieldGroupExpandable>
        )
      )}
    </Form>
  );

  const renderSchemaGroup = (groupName: string) => {
    const props = groupedProperties.get(groupName);
    if (!props || props.length === 0) return null;
    return (
      <SchemaGroupSection
        properties={props}
        values={schemaValues}
        onChange={handleSchemaFieldChange}
        errors={errors}
        allValues={schemaValues}
        dependencyMap={dependencyMap}
      />
    );
  };

  const renderAdditionalProperties = () => (
    <AdditionalProperties
      properties={additionalProps}
      schemaPropertyNames={schemaPropertyNames}
      onAdd={handleAdditionalAdd}
      onDelete={handleAdditionalDelete}
      onChange={handleAdditionalChange}
      errorKeys={additionalErrorKeys}
    />
  );

  const renderSignalCollections = () => (
    <Form isWidthLimited>
      <FormFieldGroup
        header={
          <FormFieldGroupHeader
            titleText={{
              text: <span style={{ fontWeight: 500 }}>{t("source:signal.title")}</span>,
              id: "field-group-signal-id",
            }}
            titleDescription={t("source:signal.description")}
          />
        }
      >
        <Button
          variant="link"
          size="lg"
          icon={signalCollectionName ? <CheckCircleIcon style={{ color: "#3D7318" }} /> : <AddCircleOIcon />}
          iconPosition="left"
          onClick={handleSignalModalToggle}
        >
          {t("source:signal.setupSignaling")}
        </Button>
      </FormFieldGroup>
    </Form>
  );

  // --- Layout A: JumpLinks ---

  const renderJumpLinksLayout = () => (
    <div className="jumplinks-layout">
      <div className="jumplinks-sidebar">
        <JumpLinks
          isVertical
          label="Form sections"
          scrollableSelector="#schema-form-scrollable"
          offset={16}
          expandable={{ default: "expandable", md: "nonExpandable" }}
        >
          {allSections.map((section) => (
            <JumpLinksItem key={section.id} href={`#${section.id}`}>
              {section.label}
            </JumpLinksItem>
          ))}
        </JumpLinks>
      </div>
      <div className="jumplinks-content" id="schema-form-scrollable" ref={scrollableRef}>
        {/* Connector Essentials */}
        <section id="connector-essentials">
          <Content component="h2" className="jumplinks-section-title">
            Connector Essentials
          </Content>
          {renderConnectorEssentials()}
        </section>

        {/* Schema groups */}
        {orderedGroups.map((group) => {
          const props = groupedProperties.get(group.name);
          if (!props || props.length === 0) return null;
          const sectionId = `group-${group.name.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <section key={group.name} id={sectionId}>
              <Content component="h2" className="jumplinks-section-title">
                {group.name}
              </Content>
              <Content component="p" className="jumplinks-section-description">
                {group.description}
              </Content>
              {renderSchemaGroup(group.name)}
            </section>
          );
        })}

        {/* Additional Properties */}
        <section id="additional-properties">
          <Content component="h2" className="jumplinks-section-title">
            Additional Properties
          </Content>
          <Content component="p" className="jumplinks-section-description">
            Add custom configuration properties not listed in the schema above.
          </Content>
          {renderAdditionalProperties()}
        </section>

        {/* Signal Collections */}
        <section id="signal-collections">
          {renderSignalCollections()}
        </section>
      </div>
    </div>
  );

  // --- Layout B: Tabs ---

  const tabSections = useMemo(() => {
    const tabs: { id: string; label: string; groupName?: string }[] = [];
    for (const group of orderedGroups) {
      const props = groupedProperties.get(group.name);
      if (props && props.length > 0) {
        tabs.push({
          id: `group-${group.name.replace(/\s+/g, "-").toLowerCase()}`,
          label: group.name,
          groupName: group.name,
        });
      }
    }
    tabs.push({ id: "additional-properties", label: "Additional Properties" });
    return tabs;
  }, [orderedGroups, groupedProperties]);

  const renderTabsLayout = () => (
    <div className="tabs-layout" style={{ maxWidth: "900px", margin: "0 auto" }}>
      <Card className="custom-card-body">
        <CardBody isFilled>
          {/* Connector Essentials — fixed top */}
          {renderConnectorEssentials()}

          {/* Tabs for schema groups */}
          <div style={{ marginTop: "1.5rem" }}>
            <FormFieldGroup
              header={
                <FormFieldGroupHeader
                  titleText={{
                    text: <span style={{ fontWeight: 500 }}>Configuration</span>,
                    id: "field-group-configuration-id",
                  }}
                  titleDescription="Configure the connector properties organized by category."
                />
              }
            >
              <Tabs
                activeKey={activeTabKey}
                onSelect={(_e, key) => setActiveTabKey(key as number)}
                isBox
                aria-label="Schema configuration tabs"
              >
                {tabSections.map((tab, idx) => (
                  <Tab
                    key={tab.id}
                    eventKey={idx}
                    title={<TabTitleText>{tab.label}</TabTitleText>}
                  >
                    <div style={{ paddingTop: "1rem" }}>
                      {tab.groupName
                        ? renderSchemaGroup(tab.groupName)
                        : renderAdditionalProperties()}
                    </div>
                  </Tab>
                ))}
              </Tabs>
            </FormFieldGroup>
          </div>

          {/* Signal Collections — fixed bottom */}
          <div style={{ marginTop: "1rem" }}>
            {renderSignalCollections()}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <>
      {/* Layout toggle */}
      <div className="schema-form-layout-toggle">
        <ToggleGroup aria-label="Switch between jump links and tabs layout">
          <ToggleGroupItem
            icon={<ThLargeIcon />}
            text="Jump Links"
            aria-label="Jump links layout"
            buttonId="jumplinks-layout"
            isSelected={layoutMode === "jumplinks"}
            onChange={() => setLayoutMode("jumplinks")}
          />
          <ToggleGroupItem
            icon={<ListIcon />}
            text="Tabs"
            aria-label="Tabs layout"
            buttonId="tabs-layout"
            isSelected={layoutMode === "tabs"}
            onChange={() => setLayoutMode("tabs")}
          />
        </ToggleGroup>
      </div>

      {/* Form content */}
      {layoutMode === "jumplinks" ? renderJumpLinksLayout() : renderTabsLayout()}

      {/* Connection modal */}
      <CreateConnectionModal
        isConnectionModalOpen={isConnectionModalOpen}
        handleConnectionModalToggle={() => setIsConnectionModalOpen(false)}
        selectedConnectionType="source"
        resourceId={sourceId}
        setSelectedConnection={setSelectedConnection}
      />

      {/* Signal modal */}
      <Modal
        variant={ModalVariant.medium}
        isOpen={isSignalModalOpen}
        onClose={handleSignalModalToggle}
        aria-labelledby="signal-modal-title"
      >
        <ModalHeader
          title={t("source:signal.title")}
          labelId="signal-modal-title"
          description={t("source:signal.modelDescription")}
        />
        <ModalBody tabIndex={0}>
          {signalMissingConnection && (
            <Alert
              variant="danger"
              isInline
              isPlain
              title={t("source:signal.errorMsg", { val: { connectorType: "source" } })}
              style={{ paddingBottom: "15px" }}
            />
          )}
          <Form isWidthLimited>
            <FormGroup label={t("source:signal.signalingCollectionField.label")} isRequired fieldId="signaling-collection-name">
              <TextInput
                id="signaling-collection-name"
                value={signalCollectionNameVerify}
                onChange={(_e, val) => setSignalCollectionNameVerify(val)}
              />
            </FormGroup>
            <FormGroup label={t("source:signal.ddlQuery")} fieldId="ddl-query-name">
              <ClipboardCopy isReadOnly hoverTip={t("copy")} clickTip={t("copied")}>
                {`CREATE TABLE ${signalCollectionNameVerify} (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);`}
              </ClipboardCopy>
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          {signalVerified ? (
            <Button variant="primary" isLoading={isSignalLoading} onClick={configureSignalCollection}>
              {t("done")}
            </Button>
          ) : (
            <Button variant="primary" isLoading={isSignalLoading} onClick={verifySignalsHandler}>
              {t("verify")}
            </Button>
          )}
          <Button variant="link" onClick={handleSignalModalToggle}>
            {t("cancel")}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
});

CreateSourceSchemaForm.displayName = "CreateSourceSchemaForm";
export default CreateSourceSchemaForm;
