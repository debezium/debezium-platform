import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Content,
  Form,
  FormFieldGroup,
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
  Tooltip,
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
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import {
  Connection,
  ConnectionConfig,
  fetchData,
  fetchDataCall,
  Source,
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
import { Catalog, CatalogApiResponse, ConnectorSchema, SchemaGroup, SchemaProperty } from "../apis/types";
import destinationCatalog from "../__mocks__/data/DestinationCatalog.json";
import ConnectorImage from "./ComponentImage";
import TableViewComponent from "./TableViewComponent";
import SchemaGroupSection from "./SchemaGroupSection";
import AdditionalProperties from "./AdditionalProperties";
import ApiComponentError from "./ApiComponentError";
import CreateConnectionModal from "../pages/components/CreateConnectionModal";
import { SelectedDataListItem } from "../apis/types";
import {
  getDataExplorerScopePhrase,
  getIncludeList,
  getTableManagedFilterPropertyNames,
  getTableManagedIncludeListPropertyNames,
} from "@utils/Datatype";
import {
  buildDependencyMap,
  collectAllDependants,
} from "@utils/connectorSchemaLayout";
import { buildSourceConnectorDisplayGroupedProperties } from "@utils/sourceConnectorDisplayGroups";
import { splitSourceConfigForHydration } from "@utils/sourceConfigSplit";
import _ from "lodash";
import "./CreateSourceSchemaForm.css";

interface connectionsList extends Connection {
  role: string;
}

type AdditionalProp = { key: string; value: string };

interface CreateSourceSchemaFormProps {
  connectorSchema: ConnectorSchema;
  sourceId: string;
  dataType?: string;
  onSubmit: (payload: Record<string, unknown>) => void;
  initialSource?: Source;
  readOnly?: boolean;
  /** Initial layout; user can still switch via the toggle. Pipeline designer modal uses "tabs". */
  defaultLayoutMode?: "jumplinks" | "tabs";
}

export interface CreateSourceSchemaFormHandle {
  validate: () => boolean;
  submit: () => void;
  /** Populated after the most recent failed `validate()` */
  getLastValidationFailureBody: () => string;
}

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

/** Visual order for jumplinks layout: essentials → schema groups → additional properties. */
function getFirstJumplinkValidationErrorElementId(
  newErrors: Record<string, string | undefined>,
  additionalErrorRowIds: string[],
  orderedGroups: SchemaGroup[],
  groupedProperties: Map<string, SchemaProperty[]>
): string | null {
  if (newErrors["source-name"]) return "source-name";
  if (newErrors.connection) return "conn-typeahead-select";

  for (const group of orderedGroups) {
    const props = groupedProperties.get(group.name);
    if (!props?.length) continue;
    const sorted = [...props].sort((a, b) => a.display.groupOrder - b.display.groupOrder);
    for (const prop of sorted) {
      if (newErrors[prop.name]) return `schema-field-${prop.name}`;
    }
  }

  if (additionalErrorRowIds.length > 0) {
    return `addprop-key-input-${additionalErrorRowIds[0]}`;
  }
  return null;
}

function scrollJumplinkValidationTargetIntoView(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (el instanceof HTMLElement && typeof el.focus === "function") {
    try {
      el.focus({ preventScroll: true });
    } catch {
      /* non-focusable or focus not allowed */
    }
  }
}

function collectValidationErrorSectionLabels(
  newErrors: Record<string, string | undefined>,
  additionalErrorRowIds: string[],
  orderedGroups: SchemaGroup[],
  groupedProperties: Map<string, SchemaProperty[]>,
  t: TFunction
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  const push = (label: string) => {
    if (!seen.has(label)) {
      seen.add(label);
      names.push(label);
    }
  };

  if (newErrors["source-name"] || newErrors.connection) {
    push(t("source:jumplinks.connectorEssentials"));
  }

  for (const group of orderedGroups) {
    const props = groupedProperties.get(group.name);
    if (!props?.length) continue;
    if (props.some((p) => !!newErrors[p.name])) {
      push(group.name);
    }
  }

  if (additionalErrorRowIds.length > 0) {
    push(t("source:jumplinks.additionalProperties"));
  }

  return names;
}

function formatValidationFailureNotificationBody(sections: string[], t: TFunction): string {
  if (sections.length === 0) {
    return t("source:form.validationFailedGeneric");
  }
  if (sections.length === 1) {
    return t("source:form.validationFailedInOneSection", { section: sections[0] });
  }
  return t("source:form.validationFailedInMultipleSections", { list: sections.join(", ") });
}

const CreateSourceSchemaForm = React.forwardRef<
  CreateSourceSchemaFormHandle,
  CreateSourceSchemaFormProps
>(({ connectorSchema, sourceId, dataType, onSubmit, initialSource, readOnly = false, defaultLayoutMode = "jumplinks" }, ref) => {
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const hydratedSourceIdRef = useRef<number | null>(null);
  const lastValidationFailureBodyRef = useRef<string>("");

  // Layout toggle
  const [layoutMode, setLayoutMode] = useState<"jumplinks" | "tabs">(defaultLayoutMode);

  const [sourceName, setSourceName] = useState("");
  const [description, setDescription] = useState("");

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
  const [selectedDataListItems, setSelectedDataListItems] = useState<SelectedDataListItem | undefined>();

  // Signal
  const [signalCollectionName, setSignalCollectionName] = useState("");
  const [isSignalModalOpen, setIsSignalModalOpen] = useState(false);
  const [signalCollectionNameVerify, setSignalCollectionNameVerify] = useState("");
  const [signalVerified, setSignalVerified] = useState(false);
  const [signalMissingConnection, setSignalMissingConnection] = useState(false);
  const [isSignalLoading, setIsSignalLoading] = useState(false);

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const [activeTabKey, setActiveTabKey] = useState(0);

  const [activeSection, setActiveSection] = useState("connector-essentials");
  const activeSectionRef = useRef(activeSection);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  const orderedGroups = useMemo(
    () => [...connectorSchema.groups].sort((a, b) => a.order - b.order),
    [connectorSchema.groups]
  );

  const groupedProperties = useMemo(
    () => buildSourceConnectorDisplayGroupedProperties(connectorSchema),
    [connectorSchema]
  );

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

  const connectorTypeString = dataType || sourceId;

  const tableManagedFilterNames = useMemo(
    () => new Set(getTableManagedFilterPropertyNames(connectorTypeString)),
    [connectorTypeString]
  );

  const tableManagedIncludeListNames = useMemo(
    () => new Set(getTableManagedIncludeListPropertyNames(connectorTypeString)),
    [connectorTypeString]
  );

  useLayoutEffect(() => {
    if (!initialSource || !connectorSchema) {
      hydratedSourceIdRef.current = null;
      return;
    }
    if (hydratedSourceIdRef.current === initialSource.id) {
      return;
    }
    hydratedSourceIdRef.current = initialSource.id;

    const split = splitSourceConfigForHydration(
      initialSource.config as Record<string, unknown>,
      schemaPropertyNames
    );
  
    /* eslint-disable react-hooks/set-state-in-effect */
    setSourceName(initialSource.name);
    setDescription(initialSource.description ?? "");
    setSelectedConnection(initialSource.connection);
    setConnectionInputValue(initialSource.connection?.name ?? "");
    setSchemaValues(split.schemaValues);
    setAdditionalProps(split.additionalProps);
    setAdditionalKeyCount(split.additionalKeyCount);
    setSignalCollectionName(split.signalCollectionName);
    setSelectedDataListItems(split.selectedDataListItems as SelectedDataListItem | undefined);
    setSignalVerified(!!split.signalCollectionName);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialSource, connectorSchema, schemaPropertyNames]);

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

  useEffect(() => {
    if (layoutMode !== "jumplinks") return;

    const sectionIds = allSections.map((s) => s.id);
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const intersecting = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            intersecting.add(entry.target.id);
          } else {
            intersecting.delete(entry.target.id);
          }
        }
        const topmost = sectionIds.find((id) => intersecting.has(id));
        if (topmost && topmost !== activeSectionRef.current) {
          setActiveSection(topmost);
        }
      },
      { rootMargin: "0px 0px -60% 0px", threshold: 0 }
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [layoutMode, allSections]);

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

  const selectedConnectionId = selectedConnection?.id;

  const {
    data: collections,
    isLoading: isCollectionsLoading,
    error: collectionsQueryError,
    refetch: refetchCollections,
  } = useQuery<TableData, object>(
    ["connection-collections", selectedConnectionId],
    async () => {
      const response = await fetchDataCall<TableData>(
        `${API_URL}/api/connections/${selectedConnectionId}/collections`
      );
      if (response.error) {
        throw (response.error.body || {}) as object;
      }
      return response.data as TableData;
    },
    {
      enabled: selectedConnectionId != null,
    }
  );

  const collectionsError =
    collectionsQueryError != null
      ? typeof collectionsQueryError === "object"
        ? (collectionsQueryError as object)
        : { message: String(collectionsQueryError) }
      : undefined;

  const renderDataTableExplorer = useCallback(() => {
    if (!selectedConnection?.id) return null;
    if (isCollectionsLoading) {
      return (
        <FormFieldGroup>
          <Skeleton fontSize="2xl" width="50%" />
          <Skeleton fontSize="md" width="33%" />
        </FormFieldGroup>
      );
    }
    if (!_.isEmpty(collectionsError)) {
      return (
        <FormFieldGroup>
          <ApiComponentError
            error={collectionsError}
            retry={() => {
              void refetchCollections();
            }}
          />
        </FormFieldGroup>
      );
    }
    return (
      <div className="table-explorer-section">
        <Content
          component="h3"
          id="field-group-data-table-id"
          className="table-explorer-section__title"
        >
          {t("source:create.dataTableTitle", {
            val: getConnectorTypeName(connectorTypeString),
          })}
        </Content>
        <Content component="p" className="table-explorer-section__description">
          {t("source:create.dataTableDescription", {
            val: getDataExplorerScopePhrase(connectorTypeString),
          })}
        </Content>
        <TableViewComponent
          collections={collections}
          setSelectedDataListItems={setSelectedDataListItems}
          selectedDataListItems={selectedDataListItems}
          readOnly={readOnly}
        />
      </div>
    );
  }, [
    selectedConnection?.id,
    isCollectionsLoading,
    collectionsError,
    collections,
    selectedDataListItems,
    readOnly,
    t,
    connectorTypeString,
    refetchCollections,
  ]);

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

  const handleNewConnectionFromModal = useCallback((connection: ConnectionConfig) => {
    setSelectedConnection(connection);
    setConnectionInputValue(connection.name || "");
  }, []);

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
    if (readOnly) return;
    setConnectionInputValue(value);
    setConnectionFilterValue(value);
    setFocusedItemIndex(null);
    setActiveItemId(null);
    if (value !== selectedConnection?.name) setSelectedConnection(undefined);
    if (value && !isConnectionOpen) setIsConnectionOpen(true);
  };

  const onConnectionInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (readOnly) return;
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
        if (readOnly) return;
        setIsConnectionOpen(!isConnectionOpen);
        connectionInputRef.current?.focus();
      }}
      isExpanded={isConnectionOpen}
      isFullWidth
      isDisabled={readOnly}
      status={errors.connection ? "danger" : undefined}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={connectionInputValue}
          onClick={() => !readOnly && !isConnectionOpen && setIsConnectionOpen(true)}
          onChange={onConnectionInputChange}
          onKeyDown={onConnectionInputKeyDown}
          id="conn-typeahead-input"
          autoComplete="off"
          innerRef={connectionInputRef}
          placeholder={t("connection:link.selectConnection")}
          {...(activeItemId && { "aria-activedescendant": activeItemId })}
          role="combobox"
          isExpanded={isConnectionOpen}
          readOnly={readOnly}
          {...(readOnly ? { readOnlyVariant: "plain" as const } : {})}
        />
        <TextInputGroupUtilities {...(!connectionInputValue || readOnly ? { style: { display: "none" } } : {})}>
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

  const handleSchemaFieldChange = useCallback((name: string, value: string) => {
    setSchemaValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }, []);

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

  const validate = useCallback((): boolean => {
    if (readOnly) return true;
    const newErrors: Record<string, string | undefined> = {};
    if (!sourceName.trim()) newErrors["source-name"] = t("statusMessage:smartEditor.sourceNameRequired", "Source name is required");
    if (!selectedConnection) newErrors.connection = t("statusMessage:smartEditor.connectionRequired", "Connection is required");

    for (const prop of connectorSchema.properties) {
      if (prop.display.group === "Connection Advanced Ssl") {
        continue;
      }
      if (prop.display.group === "Connection" && prop.name !== "topic.prefix") {
        continue;
      }
      if (tableManagedFilterNames.has(prop.name)) {
        continue;
      }
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
    const valid = !hasSchemaErrors && errKeys.length === 0;

    if (!valid) {
      const sections = collectValidationErrorSectionLabels(
        newErrors,
        errKeys,
        orderedGroups,
        groupedProperties,
        t
      );
      lastValidationFailureBodyRef.current = formatValidationFailureNotificationBody(sections, t);
    } else {
      lastValidationFailureBodyRef.current = "";
    }

    if (!valid && layoutMode === "jumplinks") {
      const targetId = getFirstJumplinkValidationErrorElementId(
        newErrors,
        errKeys,
        orderedGroups,
        groupedProperties
      );
      if (targetId) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollJumplinkValidationTargetIntoView(targetId);
          });
        });
      }
    }

    return valid;
  }, [
    readOnly,
    layoutMode,
    sourceName,
    selectedConnection,
    schemaValues,
    connectorSchema.properties,
    additionalProps,
    allDependants,
    orderedGroups,
    groupedProperties,
    tableManagedFilterNames,
    t,
  ]);

  const getLastValidationFailureBody = useCallback(
    () => lastValidationFailureBodyRef.current || t("source:form.validationFailedGeneric"),
    [t]
  );

  const handleSubmit = useCallback(() => {
    if (readOnly) return;
    if (!validate()) {
      addNotification("danger", "Validation failed", getLastValidationFailureBody());
      return;
    }

    const config: Record<string, string> = {};

    for (const [key, value] of Object.entries(schemaValues)) {
      if (value === "") continue;
      if (tableManagedIncludeListNames.has(key)) continue;
      config[key] = value;
    }

    additionalProps.forEach((prop) => {
      if (prop.key && prop.value) config[prop.key] = prop.value;
    });

    if (signalCollectionName) config["signal.data.collection"] = signalCollectionName;

    Object.assign(config, getIncludeList(selectedDataListItems, connectorTypeString));

    const payload: Record<string, unknown> = {
      name: sourceName,
      description,
      type: initialSource?.type ?? sourceId,
      schema: initialSource?.schema ?? "schema321",
      vaults: initialSource?.vaults ?? [],
      ...(selectedConnection ? { connection: selectedConnection } : {}),
      config,
    };
    if (initialSource) {
      payload.id = initialSource.id;
    }
    onSubmit(payload);
  }, [
    readOnly,
    validate,
    getLastValidationFailureBody,
    addNotification,
    schemaValues,
    additionalProps,
    signalCollectionName,
    selectedDataListItems,
    sourceName,
    description,
    sourceId,
    selectedConnection,
    onSubmit,
    initialSource,
    connectorTypeString,
    tableManagedIncludeListNames,
  ]);

  React.useImperativeHandle(
    ref,
    () => ({ validate, submit: handleSubmit, getLastValidationFailureBody }),
    [validate, handleSubmit, getLastValidationFailureBody]
  );

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
          readOnly={readOnly}
          {...(readOnly ? { readOnlyVariant: "plain" as const } : {})}
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
          readOnly={readOnly}
          {...(readOnly ? { readOnlyVariant: "plain" as const } : {})}
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
          {!readOnly && (
          <InputGroupItem>
            <Button
              variant="control"
              icon={<PlusIcon />}
              onClick={() => setIsConnectionModalOpen(true)}
            >
              {t("connection:link.createConnection")}
            </Button>
          </InputGroupItem>
          )}
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
    </Form>
  );

  const renderSchemaGroup = (groupName: string) => {
    const props = groupedProperties.get(groupName);
    if (!props || props.length === 0) return null;
    const omittedPropertyNames =
      groupName === "Filters" && tableManagedFilterNames.size > 0 ? tableManagedFilterNames : undefined;
    return (
      <SchemaGroupSection
        properties={props}
        values={schemaValues}
        onChange={handleSchemaFieldChange}
        errors={errors}
        allValues={schemaValues}
        dependencyMap={dependencyMap}
        allDependantNames={allDependants}
        readOnly={readOnly}
        omittedPropertyNames={omittedPropertyNames}
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
      readOnly={readOnly}
    />
  );

  const renderSignalCollections = () => {
    const isConnectionSelected = !!selectedConnection;
    const disabledTooltip = t("source:signal.connectionRequiredTooltip", {
      defaultValue: "Please select a connection before setting up signaling",
    });

    return (
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
          {readOnly ? (
            <Content component="p">
              {signalCollectionName
                ? `${t("source:signal.signalingCollectionField.label", { defaultValue: "Signaling collection" })}: ${signalCollectionName}`
                : t("source:signal.notConfigured", {
                    defaultValue: "Signaling is not configured for this source.",
                  })}
            </Content>
          ) : (
            <Tooltip
              content={disabledTooltip}
              isVisible={!isConnectionSelected ? undefined : false}
            >
              <span
                style={{ display: "block", width: "100%" }}
                tabIndex={!isConnectionSelected ? 0 : -1}
              >
                <Button
                  variant="link"
                  size="lg"
                  icon={signalCollectionName ? <CheckCircleIcon style={{ color: "#3D7318" }} /> : <AddCircleOIcon />}
                  iconPosition="left"
                  onClick={handleSignalModalToggle}
                  isDisabled={!isConnectionSelected}
                  isBlock
                >
                  {t("source:signal.setupSignaling")}
                </Button>
              </span>
            </Tooltip>
          )}
        </FormFieldGroup>
      </Form>
    );
  };

  const renderJumpLinksLayout = () => (
    <div className="jumplinks-layout">
      <div className="jumplinks-sidebar">
        <JumpLinks
          isVertical
          label="Form sections"
          expandable={{ default: "expandable", md: "nonExpandable" }}
        >
          {allSections.map((section) => (
            <JumpLinksItem
              key={section.id}
              href={`#${section.id}`}
              isActive={activeSection === section.id}
              onClick={(e) => {
                e.preventDefault();
                setActiveSection(section.id);
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {section.label}
            </JumpLinksItem>
          ))}
        </JumpLinks>
      </div>
      <div className="jumplinks-content">
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
            <section key={group.name} id={sectionId} className="jumplinks-section-bordered">
              <Content component="h2" className="jumplinks-section-title">
                {group.name}
              </Content>
              <Content component="p" className="jumplinks-section-description">
                {group.description}
              </Content>
              {group.name === "Filters" ? renderDataTableExplorer() : null}
              {renderSchemaGroup(group.name)}
            </section>
          );
        })}

        {/* Additional Properties */}
        <section id="additional-properties" className="jumplinks-section-bordered">
          <Content component="h2" className="jumplinks-section-title">
            Additional Properties
          </Content>
          <Content component="p" className="jumplinks-section-description">
            Add custom configuration properties not listed in the schema above.
          </Content>
          {renderAdditionalProperties()}
        </section>

        {/* Signal Collections */}
        <section id="signal-collections" className="jumplinks-section-bordered">
          {renderSignalCollections()}
        </section>
      </div>
    </div>
  );

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
          {renderConnectorEssentials()}
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
                aria-label="Schema configuration tabs"
              >
                {tabSections.map((tab, idx) => (
                  <Tab
                    key={tab.id}
                    eventKey={idx}
                    title={<TabTitleText>{tab.label}</TabTitleText>}
                  >
                    <div style={{ paddingTop: "1rem" }}>
                      {tab.groupName === "Filters" ? renderDataTableExplorer() : null}
                      {tab.groupName
                        ? renderSchemaGroup(tab.groupName)
                        : renderAdditionalProperties()}
                    </div>
                  </Tab>
                ))}
              </Tabs>
            </FormFieldGroup>
          </div>

          <div style={{ marginTop: "1rem" }}>
            {renderSignalCollections()}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <>
      {!readOnly && (
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
      )}

      {layoutMode === "jumplinks" ? renderJumpLinksLayout() : renderTabsLayout()}

      <CreateConnectionModal
        isConnectionModalOpen={isConnectionModalOpen}
        handleConnectionModalToggle={() => setIsConnectionModalOpen(false)}
        selectedConnectionType="source"
        resourceId={sourceId}
        setSelectedConnection={handleNewConnectionFromModal}
      />

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
