/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Alert,
  Button,
  ButtonType,
  FormContextProvider,
  PageSection,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { PencilAltIcon, CodeIcon, PlayIcon } from "@patternfly/react-icons";
import destinationCatalog from "../../__mocks__/data/DestinationCatalog.json";
import { useNavigate, useParams } from "react-router-dom";
import { CodeEditor, CodeEditorControl, Language } from "@patternfly/react-code-editor";
import { find } from "lodash";
import { ConnectionConfig, createPost, Destination, Payload } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { convertMapToObject } from "../../utils/helpers";
import { useNotification } from "../../appLayout/AppNotificationContext";
import PageHeader from "@components/PageHeader";
import SourceSinkForm from "@components/SourceSinkForm";
import { useCallback, useEffect, useRef, useState } from "react";
import Ajv from "ajv";
import { useTranslation } from "react-i18next";
import { connectorSchema } from "@utils/schemas";
import { isValidJson, useFormatDetector } from "src/hooks/useFormatDetector";
import { formatCode } from "@utils/formatCodeUtils";
import style from "../../styles/createConnector.module.css"
import CreateConnectionModal from "../components/CreateConnectionModal";
import { useData } from "@appContext/AppContext";

const ajv = new Ajv();

interface CreateDestinationProps {
  modelLoaded?: boolean;
  selectedId?: string;
  selectDestination?: (destinationId: string) => void;
  onSelection?: (selection: Destination) => void;
}

type Properties = { key: string; value: string };

const initialCodeValue = {
  name: "",
  description: "",
  type: "",
  schema: "schema123",
  vaults: [],
  config: {},
};

const FormSyncManager: React.FC<{
  getFormValue: (key: string) => string;
  setFormValue: (key: string, value: string) => void;
  code: any;
  setCode: (code: any) => void;
  destinationId: string | undefined;
  properties: Map<string, Properties>;
  setProperties: (properties: Map<string, Properties>) => void;
  setCodeAlert: (alert: string | React.ReactElement) => void;
  setFormatType: (type: string) => void;
}> = ({
  getFormValue,
  setFormValue,
  code,
  setCode,
  destinationId,
  properties,
  setProperties,
  setCodeAlert,
  setFormatType,
}) => {
    const { t } = useTranslation();
    // Ref to track the source of the update
    const updateSource = useRef<"form" | "code" | null>(null);

    // Update code state when form values change
    useEffect(() => {
      if (updateSource.current === "code") {
        updateSource.current = null;
        return;
      }

      updateSource.current = "form";
      const type = find(destinationCatalog, { id: destinationId })?.type || "";
      const configuration = convertMapToObject(properties);

      setCode((prevCode: any) => {
        if (
          prevCode.name === getFormValue("destination-name") &&
          prevCode.description === getFormValue("description") &&
          JSON.stringify(prevCode.config) === JSON.stringify(configuration)
        ) {
          return prevCode;
        }

        return {
          ...prevCode,
          type,
          config: configuration,
          name: getFormValue("destination-name") || "",
          description: getFormValue("description") || "",
        };
      });
    }, [
      getFormValue("destination-name"),
      getFormValue("description"),
      properties,
      destinationId,
    ]);

    // Use the useFormatDetector hook
    const { formatType, isValidFormat, errorMsg } = useFormatDetector(code, "destination");

    // Update form values when code changes
    useEffect(() => {
      if (formatType === "properties-file") {
        setFormatType("properties-file");
        setCodeAlert(t('statusMessage:smartEditor.debeziumServerFormatMsg'));
        return;
      }
      else {
        setFormatType("dbz-platform");
      }
      if (isValidFormat) {
        if (updateSource.current === "form") {
          updateSource.current = null;
          return;
        }
        updateSource.current = "code";
        if (code.name !== getFormValue("destination-name")) {
          setFormValue(
            "destination-name",
            typeof code.name === "string" ? code.name : ""
          );
        }
        if (code.description !== getFormValue("description")) {
          setFormValue(
            "description",
            typeof code.description === "string" ? code.description : ""
          );
        }
        const currentConfig = convertMapToObject(properties);
        if (JSON.stringify(currentConfig) !== JSON.stringify(code.config)) {
          const configMap = new Map();
          Object.entries(code.config || {}).forEach(([key, value], index) => {
            configMap.set(`key${index}`, { key, value: value as string });
          });
          setProperties(configMap);
        }
        if (updateSource.current === "code") {
          if (!code.name || code.name.trim() === "") {
            setCodeAlert(t('statusMessage:smartEditor.connectorNameRequired'));
            return;
          }
          if (!code.type || code.type.trim() === "") {
            setCodeAlert(t('statusMessage:smartEditor.connectorTypeRequired'));
            return;
          }
        }
        setCodeAlert("");
      } else {
        setCodeAlert(errorMsg);
      }
    }, [code, formatType, isValidFormat, errorMsg]);

    return null;
  };

const CreateDestination: React.FunctionComponent<CreateDestinationProps> = ({
  modelLoaded,
  selectedId,
  selectDestination,
  onSelection,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const destinationIdParam = useParams<{ destinationId: string }>();
  const destinationIdModel = selectedId;
  const destinationId = modelLoaded
    ? destinationIdModel
    : destinationIdParam.destinationId;
  const { darkMode } = useData();
  const rawConfiguration = location.pathname.includes("create_destination") ? !destinationIdParam.destinationId : false;

  const navigateTo = (url: string) => {
    navigate(url);
  };

  const { addNotification } = useNotification();

  const [code, setCode] = useState<string | Payload>(initialCodeValue);

  const [codeAlert, setCodeAlert] = useState<string | React.ReactElement>("");
  const [formatType, setFormatType] = useState("dbz-platform");
  const [errorWarning, setErrorWarning] = useState<string[]>([]);
  const [editorSelected, setEditorSelected] = React.useState("form-editor");
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedConnection, setSelectedConnection] = useState<ConnectionConfig | undefined>();

  const [properties, setProperties] = useState<Map<string, Properties>>(
    new Map([["key0", { key: "", value: "" }]])
  );
  const [keyCount, setKeyCount] = React.useState<number>(1);

  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);


  const handleConnectionModalToggle = useCallback(() => {
    setIsConnectionModalOpen(!isConnectionModalOpen);
  }, [isConnectionModalOpen]);

  const validate = ajv.compile(connectorSchema);

  const handleAddProperty = () => {
    const newKey = `key${keyCount}`;
    setProperties(
      (prevProperties) =>
        new Map(prevProperties.set(newKey, { key: "", value: "" }))
    );
    setKeyCount((prevCount) => prevCount + 1);
  };

  const handleDeleteProperty = (key: string) => {
    setProperties((prevProperties) => {
      const newProperties = new Map(prevProperties);
      newProperties.delete(key);
      return newProperties;
    });
  };

  const handlePropertyChange = (
    key: string,
    type: "key" | "value",
    newValue: string
  ) => {
    setProperties((prevProperties) => {
      const newProperties = new Map(prevProperties);
      const property = newProperties.get(key);
      if (property) {
        if (type === "key") property.key = newValue;
        else if (type === "value") property.value = newValue;
        newProperties.set(key, property);
      }
      return newProperties;
    });
  };

  const createNewDestination = async (payload: Payload) => {
    const response = await createPost(`${API_URL}/api/destinations`, payload);

    if (response.error) {
      addNotification(
        "danger",
        `Destination creation failed`,
        `Failed to create ${(response.data as Destination)?.name}: ${response.error
        }`
      );
    } else {
      modelLoaded && onSelection && onSelection(response.data as Destination);
      addNotification(
        "success",
        `Create successful`,
        `Destination "${(response.data as Destination).name
        }" created successfully.`
      );
      !modelLoaded && navigateTo("/destination");
    }
  };

  const handleCreate = async (
    values: Record<string, string>,
    setError: (fieldId: string, error: string | undefined) => void
  ) => {
    if (editorSelected === "form-editor") {
      if (!values["destination-name"]) {
        setError("destination-name", "Destination name is required.");
      } else {
        setIsLoading(true);
        const errorWarning = [] as string[];
        properties.forEach((value: Properties, key: string) => {
          if (value.key === "" || value.value === "") {
            errorWarning.push(key);
          }
        });
        setErrorWarning(errorWarning);
        if (errorWarning.length > 0) {
          addNotification(
            "danger",
            `Destination creation failed`,
            `Please fill both Key and Value fields for all the properties.`
          );
          setIsLoading(false);
          return;
        }
        const payload = {
          description: values["description"],
          type: find(destinationCatalog, { id: destinationId })?.type || "",
          schema: "schema321",
          vaults: [],
          ...(selectedConnection ? { connection: selectedConnection } : {}),
          config: convertMapToObject(properties),
          name: values["destination-name"],
        } as unknown as Payload;
        await createNewDestination(payload);
        setIsLoading(false);
      }
    } else {
      const payload = code;
      const isValid = validate(payload);
      if (!isValid) {
        setCodeAlert(ajv.errorsText(validate.errors));
        return;
      } else {
        setIsLoading(true);
        await createNewDestination(payload);
        setIsLoading(false);
      }
    }
  };

  const handleItemClick = (
    event:
      | MouseEvent
      | React.MouseEvent<any, MouseEvent>
      | React.KeyboardEvent<Element>
  ) => {
    const id = event.currentTarget.id;
    setEditorSelected(id);
  };

  const [isFormatting, setIsFormatting] = useState(false);

  const customControl = (
    <CodeEditorControl
      id="format-button"
      icon={isFormatting ? <Spinner size="md" aria-label="Formatting in progress" /> : <PlayIcon />}
      aria-label="Execute code"
      tooltipProps={{ content: t('statusMessage:smartEditor.autoConvertTooltip') }}
      onClick={async () => {
        setIsFormatting(true);
        await new Promise((resolve) => setTimeout(resolve, 500));
        // formatCode(formatType);
        setCode(formatCode("destination", formatType, code));
        setIsFormatting(false);
      }}
      isVisible={formatType === "properties-file"}
    >
      {t('statusMessage:smartEditor.autoConvertButton')}
    </CodeEditorControl>
  );

  const onEditorDidMount = (
    editor: { layout: () => void; focus: () => void },
    monaco: {
      editor: {
        getModels: () => {
          updateOptions: (arg0: { tabSize: number }) => void;
        }[];
      };
    }
  ) => {
    editor.layout();
    editor.focus();
    monaco.editor.getModels()[0].updateOptions({ tabSize: 5 });
  };

  return (
    <>
      {!modelLoaded && (
        <PageHeader
          title={t("destination:create.title")}
          description={rawConfiguration ?
            t("destination:create.editorPageDescription") : t("destination:create.description")}
        />
      )}

      {!rawConfiguration && (
        <PageSection className={style.createConnector_toolbar}>
          <Toolbar id="destination-editor-toggle">
            <ToolbarContent>
              <ToolbarItem>
                <ToggleGroup aria-label="Toggle between form and smart editor">
                  <ToggleGroupItem
                    icon={<PencilAltIcon />}
                    text={t("formEditor")}
                    aria-label={t("formEditor")}
                    buttonId="form-editor"
                    isSelected={editorSelected === "form-editor"}
                    onChange={handleItemClick}
                  />

                  <ToggleGroupItem
                    icon={<CodeIcon />}
                    text={t("smartEditor")}
                    aria-label={t("smartEditor")}
                    buttonId="smart-editor"
                    isSelected={editorSelected === "smart-editor"}
                    onChange={handleItemClick}
                  />
                </ToggleGroup>
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>
        </PageSection>
      )}

      <FormContextProvider initialValues={{}}>
        {({ setValue, getValue, setError, values, errors }) => (
          <>
            <FormSyncManager
              getFormValue={getValue}
              setFormValue={setValue}
              code={code}
              setCode={setCode}
              destinationId={destinationId}
              properties={properties}
              setProperties={setProperties}
              setCodeAlert={setCodeAlert}
              setFormatType={setFormatType}
            />
            <PageSection
             isWidthLimited={true}
              isCenterAligned
              isFilled
              className={`customPageSection ${style.createConnector_pageSection}`}
            >
              {editorSelected === "form-editor" && !rawConfiguration ? (
                <SourceSinkForm
                  ConnectorId={destinationId || ""}
                  connectorType="destination"
                  properties={properties}
                  setValue={setValue}
                  getValue={getValue}
                  setError={setError}
                  errors={errors}
                  errorWarning={errorWarning}
                  handleAddProperty={handleAddProperty}
                  handleDeleteProperty={handleDeleteProperty}
                  handlePropertyChange={handlePropertyChange}
                  setSelectedConnection={setSelectedConnection}
                  selectedConnection={selectedConnection}
                  handleConnectionModalToggle={handleConnectionModalToggle}
                  setSelectedDataListItems={() => {}}
                />
              ) : (
                <>

                  {codeAlert && (
                    <Alert
                      variant={formatType === "dbz-platform" ? "danger" : "warning"}
                      isInline
                      title={formatType === "dbz-platform" ? `Invalid JSON format: ${codeAlert}` : "Invalid JSON"}
                      className={style.createConnector_alert}
                    >
                      {formatType !== "dbz-platform" && codeAlert}
                    </Alert>

                  )}
                  <div className={`${style.smartEditor} smartEditor`}>

                    <CodeEditor
                      isUploadEnabled
                      isDownloadEnabled
                      isCopyEnabled
                      isLanguageLabelVisible
                      isMinimapVisible
                      language={Language.json || Language.plaintext}
                      downloadFileName="source-connector.json"
                      isFullHeight
                      isDarkTheme={darkMode}
                      code={isValidJson(code) ? JSON.stringify(code, null, 2) : code as string}
                      customControls={customControl}
                      onCodeChange={(value) => {
                        try {
                          if (isValidJson(value)) {
                            const parsedCode = JSON.parse(value);
                            setCode(parsedCode);
                          } else {
                            setCode(value)
                          }
                        } catch (error) {
                          console.error("Invalid JSON:", error);
                        }
                      }}
                      onEditorDidMount={onEditorDidMount}
                    />
                  </div>
                </>
              )}
            </PageSection>
            <PageSection className="pf-m-sticky-bottom" isFilled={false}>
              <ActionList>
                <ActionListGroup>
                  <ActionListItem>
                    <Button
                      variant="primary"
                      isLoading={isLoading}
                      isDisabled={isLoading || (editorSelected !== "form-editor" && codeAlert !== "")}
                      type={ButtonType.submit}
                      onClick={(e) => {
                        e.preventDefault();

                        handleCreate(values, setError);
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
                        onClick={() => navigateTo("/destination/catalog")}
                      >
                        {t("destination:catalog.backToCatalog")}
                      </Button>
                    )}
                  </ActionListItem>
                </ActionListGroup>
              </ActionList>

            </PageSection>
          </>
        )}
      </FormContextProvider>
      <CreateConnectionModal
        isConnectionModalOpen={isConnectionModalOpen}
        handleConnectionModalToggle={handleConnectionModalToggle}
        selectedConnectionType={"destination"}
        resourceId={destinationId}
        setSelectedConnection={setSelectedConnection}
      />
    </>
  );
};

export { CreateDestination };
