import * as React from "react";
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Alert,
  Button,
  ButtonType,
  PageSection,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { createPost, Payload, Destination } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { useNotification } from "../../appLayout/AppNotificationContext";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { fetchData } from "../../apis/apis";
import { ConnectorSchema } from "../../apis/types";
import CreateSchemaForm, {
  CreateSchemaFormHandle,
} from "@components/CreateSchemaForm";
import { PageHeader } from "@patternfly/react-component-groups";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { formatCode } from "../../utils/formatCodeUtils";
import { useData } from "@appContext/AppContext";
import style from "../../styles/createConnector.module.css";

export interface ICreateDestinationProps {
  modelLoaded?: boolean;
  selectedId?: string;
  selectDestination?: (destinationId: string) => void;
  onSelection?: (destination: Destination) => void;
}

const CreateDestination: React.FunctionComponent<ICreateDestinationProps> = ({
  modelLoaded,
  selectedId,
  selectDestination,
  onSelection,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const { darkMode } = useData();

  const destinationIdParam = useParams<{ destinationId: string }>();
  const destinationId = modelLoaded ? selectedId : destinationIdParam.destinationId;

  const descriptor = (location.state as { descriptor?: string } | null)?.descriptor;

  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<CreateSchemaFormHandle>(null);

  const editorSelected = destinationId ? "form-editor" : "smart-editor";
  const [editorFormat, setEditorFormat] = useState<"raw-json" | "kafka-connect" | "properties-file">("raw-json");
  const [codeText, setCodeText] = useState<string>("");
  const [codeAlert, setCodeAlert] = useState<string>("");

  const descriptorPath = React.useMemo(() => {
    if (descriptor) return descriptor.replace(/\.json$/, "");
    if (destinationId) return `server-sink/${destinationId}`;
    return null;
  }, [descriptor, destinationId]);

  const {
    data: connectorSchema,
    isLoading: isSchemaLoading,
    error: schemaError,
  } = useQuery<ConnectorSchema, Error>(
    ["connectorSchema", descriptorPath],
    () => fetchData<ConnectorSchema>(`${API_URL}/api/catalog/${descriptorPath}`),
    { enabled: !!descriptorPath }
  );

  const { data: destinations = [] } = useQuery<Destination[], Error>(
    "destinations",
    () => fetchData<Destination[]>(`${API_URL}/api/destinations`)
  );

  const existingDestinations = React.useMemo(() => {
    return Array.isArray(destinations) ? destinations.map((d) => d.name) : [];
  }, [destinations]);

  // Update initial payload and text when connectorSchema or destinationId changes
  useEffect(() => {
    let initialPayload = {
      name: "",
      description: "",
      type: "",
      schema: "schema123",
      vaults: [],
      config: {},
    };

    if (connectorSchema) {
      const initialConfig: Record<string, unknown> = {};
      if (connectorSchema.properties) {
        for (const prop of connectorSchema.properties) {
          if (prop.default !== undefined) {
            initialConfig[prop.name] = prop.default;
          }
        }
      }
      initialPayload = {
        name: "",
        description: "",
        type: connectorSchema.type || destinationId || "",
        schema: "schema123",
        vaults: [],
        config: initialConfig,
      };
    }

    let textToSet = "";
    // Initialize codeText matching the current editorFormat
    try {
      if (editorFormat === "raw-json") {
        textToSet = JSON.stringify(initialPayload, null, 2);
      } else if (editorFormat === "kafka-connect") {
        const kafkaPayload = {
          name: initialPayload.name || "",
          config: {
            "connector.class": initialPayload.type || "",
            ...initialPayload.config,
          },
        };
        textToSet = JSON.stringify(kafkaPayload, null, 2);
      } else if (editorFormat === "properties-file") {
        const lines: string[] = [];
        if (initialPayload.type) {
          lines.push(`debezium.sink.type=${initialPayload.type}`);
        }
        if (initialPayload.name) {
          lines.push(`debezium.sink.name=${initialPayload.name}`);
        }
        if (initialPayload.description) {
          lines.push(`debezium.sink.description=${initialPayload.description}`);
        }
        if (initialPayload.config) {
          for (const [k, v] of Object.entries(initialPayload.config)) {
            lines.push(`debezium.sink.${k}=${v}`);
          }
        }
        textToSet = lines.join("\n");
      }
    } catch (e) {
      console.error(e);
    }

    const timer = setTimeout(() => {
      setCodeText(textToSet);
    }, 0);
    return () => clearTimeout(timer);
  }, [connectorSchema, destinationId, editorFormat]);

  const handleCodeChange = (value: string) => {
    setCodeText(value);
    try {
      if (editorFormat === "raw-json") {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object") {
          setCodeAlert("");
        }
      } else if (editorFormat === "kafka-connect") {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object") {
          formatCode("destination", "kafka-connect", parsed);
          setCodeAlert("");
        }
      } else if (editorFormat === "properties-file") {
        formatCode("destination", "properties-file", value);
        setCodeAlert("");
      }
    } catch (e: unknown) {
      setCodeAlert((e as Error).message || "Invalid syntax");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFormatToggle = (event: any) => {
    const newFormat = event.currentTarget.id;
    let currentPayload: {
      name?: string;
      description?: string;
      type?: string;
      config?: Record<string, unknown>;
    } | null = null;
    try {
      if (editorFormat === "raw-json") {
        currentPayload = JSON.parse(codeText);
      } else if (editorFormat === "kafka-connect") {
        const parsed = JSON.parse(codeText);
        currentPayload = formatCode("destination", "kafka-connect", parsed);
      } else if (editorFormat === "properties-file") {
        currentPayload = formatCode("destination", "properties-file", codeText);
      }
    } catch (e: unknown) {
      addNotification(
        "danger",
        "Format conversion failed",
        `Cannot convert format while code has syntax errors: ${(e as Error).message || "Invalid syntax"}`
      );
      return;
    }

    if (currentPayload) {
      try {
        if (newFormat === "raw-json") {
          setCodeText(JSON.stringify(currentPayload, null, 2));
        } else if (newFormat === "kafka-connect") {
          const kafkaPayload = {
            name: currentPayload.name || "",
            config: {
              "connector.class": currentPayload.type || "",
              ...currentPayload.config,
            },
          };
          setCodeText(JSON.stringify(kafkaPayload, null, 2));
        } else if (newFormat === "properties-file") {
          const lines: string[] = [];
          if (currentPayload.type) {
            lines.push(`debezium.sink.type=${currentPayload.type}`);
          }
          if (currentPayload.name) {
            lines.push(`debezium.sink.name=${currentPayload.name}`);
          }
          if (currentPayload.description) {
            lines.push(`debezium.sink.description=${currentPayload.description}`);
          }
          if (currentPayload.config) {
            for (const [k, v] of Object.entries(currentPayload.config)) {
              lines.push(`debezium.sink.${k}=${v}`);
            }
          }
          setCodeText(lines.join("\n"));
        }
        setCodeAlert("");
      } catch (e) {
        console.error(e);
      }
    }

    setEditorFormat(newFormat as "raw-json" | "kafka-connect" | "properties-file");
  };

  const createNewDestination = async (payload: Record<string, unknown>) => {
    setIsLoading(true);
    const response = await createPost(
      `${API_URL}/api/destinations`,
      payload as unknown as Payload
    );
    if (response.error) {
      addNotification(
        "danger",
        "Destination creation failed",
        `Failed to create ${(payload as { name: string }).name}: ${response.error}`
      );
    } else {
      if (modelLoaded) onSelection?.(response.data as Destination);
      addNotification(
        "success",
        "Create successful",
        `Destination "${(response.data as Destination).name}" created successfully.`
      );
      if (!modelLoaded) navigate("/destination");
    }
    setIsLoading(false);
  };

  const handleSubmitCode = () => {
    let finalPayload: {
      name?: string;
      description?: string;
      type?: string;
      config?: Record<string, unknown>;
    } | null = null;
    try {
      if (editorFormat === "raw-json") {
        finalPayload = JSON.parse(codeText);
      } else if (editorFormat === "kafka-connect") {
        const parsed = JSON.parse(codeText);
        finalPayload = formatCode("destination", "kafka-connect", parsed);
      } else if (editorFormat === "properties-file") {
        finalPayload = formatCode("destination", "properties-file", codeText);
      }
    } catch (e: unknown) {
      addNotification(
        "danger",
        "Validation failed",
        `Invalid configuration: ${(e as Error).message || "Invalid syntax"}`
      );
      return;
    }

    if (!finalPayload || !finalPayload.name?.trim()) {
      addNotification("danger", "Validation failed", "Connector name is required.");
      return;
    }
    if (!finalPayload.type?.trim()) {
      addNotification("danger", "Validation failed", "Connector type is required.");
      return;
    }

    // Verify uniqueness of name
    if (existingDestinations.includes(finalPayload.name.trim())) {
      addNotification(
        "danger",
        "Validation failed",
        `Destination with name '${finalPayload.name.trim()}' already exists.`
      );
      return;
    }

    createNewDestination(finalPayload);
  };

  const renderContent = () => {
    if (editorSelected === "form-editor") {
      if (!destinationId) {
        return (
          <Alert variant="warning" isInline title="No connector selected">
            Please select a connector from the catalog first.
          </Alert>
        );
      }

      if (isSchemaLoading) {
        return (
          <div>
            <Skeleton fontSize="2xl" width="40%" />
            <br />
            <Skeleton fontSize="md" width="60%" />
            <br />
            <Skeleton fontSize="md" width="80%" />
            <br />
            <Skeleton fontSize="md" width="50%" />
          </div>
        );
      }

      if (schemaError) {
        return (
          <Alert variant="danger" isInline title="Failed to load connector schema">
            {schemaError.message}
          </Alert>
        );
      }

      if (!connectorSchema) return null;

      return (
        <CreateSchemaForm
          ref={formRef}
          connectorSchema={connectorSchema}
          destinationId={destinationId}
          onSubmit={createNewDestination}
          existingNames={existingDestinations}
          hideSignalCollections={true}
          {...(modelLoaded ? { defaultLayoutMode: "tabs" as const } : {})}
        />
      );
    } else {
      return (
        <>
          {codeAlert && (
            <Alert
              variant="danger"
              isInline
              title={`Provided config is not valid: ${codeAlert}`}
              className={style.createConnector_alert}
              style={{ marginBottom: "15px" }}
            />
          )}
          <div className={`${style.smartEditor} smartEditor`} style={{ height: "500px", border: "1px solid #ccc" }}>
            <CodeEditor
              isUploadEnabled
              isDownloadEnabled
              isCopyEnabled
              isLanguageLabelVisible
              isMinimapVisible
              isDarkTheme={darkMode}
              language={editorFormat === "properties-file" ? Language.plaintext : Language.json}
              downloadFileName={editorFormat === "properties-file" ? "destination.properties" : "destination.json"}
              isFullHeight
              code={codeText}
              onCodeChange={handleCodeChange}
            />
          </div>
        </>
      );
    }
  };

  return (
    <>
      {!modelLoaded && (
        <PageHeader
          title={t("destination:create.title")}
          subtitle={t("destination:create.description")}
        />
      )}

      {editorSelected === "smart-editor" && (
        <PageSection className={style.createConnector_toolbar} style={{ paddingBottom: 0 }}>
          <Toolbar id="create-editor-toggle">
            <ToolbarContent style={{ paddingLeft: 0, paddingRight: 0 }}>
              <ToolbarItem>
                <ToggleGroup aria-label="Select configuration format">
                  <ToggleGroupItem
                    text="Raw JSON"
                    buttonId="raw-json"
                    isSelected={editorFormat === "raw-json"}
                    onChange={handleFormatToggle}
                  />
                  <ToggleGroupItem
                    text="Kafka Connect (JSON)"
                    buttonId="kafka-connect"
                    isSelected={editorFormat === "kafka-connect"}
                    onChange={handleFormatToggle}
                  />
                  <ToggleGroupItem
                    text="Debezium Server (Properties)"
                    buttonId="properties-file"
                    isSelected={editorFormat === "properties-file"}
                    onChange={handleFormatToggle}
                  />
                </ToggleGroup>
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>
        </PageSection>
      )}

      <PageSection
        isFilled
        padding={modelLoaded ? { default: "noPadding" } : undefined}
      >
        {renderContent()}
      </PageSection>

      <PageSection
        className="pf-m-sticky-bottom"
        isFilled={false}
        padding={modelLoaded ? { default: "noPadding" } : undefined}
      >
        <ActionList>
          <ActionListGroup>
            <ActionListItem>
              <Button
                variant="primary"
                isLoading={isLoading}
                isDisabled={isLoading || (editorSelected === "form-editor" && (isSchemaLoading || !!schemaError))}
                type={ButtonType.submit}
                onClick={(e) => {
                  e.preventDefault();
                  if (editorSelected === "form-editor") {
                    formRef.current?.submit();
                  } else {
                    handleSubmitCode();
                  }
                }}
              >
                {t("destination:create.title")}
              </Button>
            </ActionListItem>
            <ActionListItem>
              {modelLoaded ? (
                <Button
                  variant="link"
                  onClick={() => selectDestination && selectDestination("")}
                >
                  {t("back")}
                </Button>
              ) : (
                <Button
                  variant="link"
                  onClick={() => navigate("/destination/catalog")}
                >
                  {t("destination:catalog.backToCatalog")}
                </Button>
              )}
            </ActionListItem>
          </ActionListGroup>
        </ActionList>
      </PageSection>
    </>
  );
};

export { CreateDestination };
