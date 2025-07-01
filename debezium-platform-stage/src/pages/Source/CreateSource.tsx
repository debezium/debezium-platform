/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  ActionGroup,
  Alert,
  Button,
  ButtonType,
  FormContextProvider,
  PageSection,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { PencilAltIcon, CodeIcon, PlayIcon } from "@patternfly/react-icons";
import { useNavigate, useParams } from "react-router-dom";
import "./CreateSource.css";
import { CodeEditor, CodeEditorControl, Language } from "@patternfly/react-code-editor";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPost, Payload, Source } from "../../apis/apis";
import {
  API_URL,
} from "../../utils/constants";
import { convertMapToObject } from "../../utils/helpers";
import sourceCatalog from "../../__mocks__/data/SourceCatalog.json";
import { find } from "lodash";
import { useNotification } from "../../appLayout/AppNotificationContext";
import SourceSinkForm from "@components/SourceSinkForm";
import PageHeader from "@components/PageHeader";
import Ajv from "ajv";
import { useTranslation } from "react-i18next";
import { connectorSchema, initialConnectorSchema, kafkaConnectSchema } from "@utils/schemas";

const ajv = new Ajv();

interface CreateSourceProps {
  modelLoaded?: boolean;
  selectedId?: string;
  selectSource?: (sourceId: string) => void;
  onSelection?: (selection: Source) => void;
}

type Properties = { key: string; value: string };

const FormSyncManager: React.FC<{
  getFormValue: (key: string) => string;
  setFormValue: (key: string, value: string) => void;
  code: any;
  setCode: (code: any) => void;
  sourceId: string | undefined;
  properties: Map<string, Properties>;
  setProperties: (properties: Map<string, Properties>) => void;
  setCodeAlert: (alert: string) => void;
  setFormatType: (type: string) => void;
}> = ({
  getFormValue,
  setFormValue,
  code,
  setCode,
  sourceId,
  properties,
  setProperties,
  setCodeAlert,
  setFormatType,
}) => {
    const validate = ajv.compile(initialConnectorSchema);
    const validateKafkaSchema = ajv.compile(kafkaConnectSchema);
    // Ref to track the source of the update
    const updateSource = useRef<"form" | "code" | null>(null);

    // Update code state when form values change
    useEffect(() => {
      if (updateSource.current === "code") {
        updateSource.current = null;
        return;
      }

      updateSource.current = "form";
      const type = find(sourceCatalog, { id: sourceId })?.type || "";
      const configuration = convertMapToObject(properties);

      setCode((prevCode: any) => {
        if (
          prevCode.name === getFormValue("source-name") &&
          prevCode.description === getFormValue("description") &&
          JSON.stringify(prevCode.config) === JSON.stringify(configuration)
        ) {
          return prevCode;
        }

        return {
          ...prevCode,
          type,
          config: configuration,
          name: getFormValue("source-name") || "",
          description: getFormValue("description") || "",
        };
      });
    }, [
      getFormValue("source-name"),
      getFormValue("description"),
      properties,
      sourceId,
    ]);

    // Update form values when code changes
    useEffect(() => {
      const isKafkaConnectSchema = validateKafkaSchema(code);
      const isValid = validate(code);
      // console.log("isValid", isValid, "isKafkaConnectSchema", isKafkaConnectSchema);

      if (isKafkaConnectSchema) {
        setFormatType("kafka-connect");
        setCodeAlert(
          "Provided json is of kafka connect format, use 'Auto conversion' to tranfrom it to Debezium-platform format"
        );
        return;
      } else {
        setFormatType("");
      }


      if (isValid) {
        if (updateSource.current === "form") {
          updateSource.current = null;
          return;
        }
        updateSource.current = "code";
        if (code.name !== getFormValue("source-name")) {
          setFormValue(
            "source-name",
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
        setCodeAlert("");
      } else {
        setCodeAlert(ajv.errorsText(validate.errors));
      }
    }, [code]);

    return null;
  };

const CreateSource: React.FunctionComponent<CreateSourceProps> = ({
  modelLoaded,
  selectedId,
  selectSource,
  onSelection,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const navigateTo = (url: string) => {
    navigate(url);
  };
  const { addNotification } = useNotification();

  const [code, setCode] = useState({
    name: "",
    description: "",
    type: "",
    schema: "schema123",
    vaults: [],
    config: {},
  });

  const sourceIdParam = useParams<{ sourceId: string }>();
  const [codeAlert, setCodeAlert] = useState("");
  const [formatType, setFormatType] = useState("");
  const sourceIdModel = selectedId;
  const sourceId = modelLoaded ? sourceIdModel : sourceIdParam.sourceId;
  const rawConfiguration = !sourceIdParam.sourceId

  const [errorWarning, setErrorWarning] = useState<string[]>([]);
  const [editorSelected, setEditorSelected] = React.useState("form-editor");
  const [isLoading, setIsLoading] = useState(false);
  const [properties, setProperties] = useState<Map<string, Properties>>(
    new Map([["key0", { key: "", value: "" }]])
  );
  const [keyCount, setKeyCount] = useState<number>(1);

  const [signalCollectionName, setSignalCollectionName] = useState<string>("");

  const validate = ajv.compile(connectorSchema);

  const updateSignalCollectionName = useCallback(
    (name: string) => {
      setSignalCollectionName(name);
    }
    , []);

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

  const createNewSource = async (payload: Payload) => {
    const response = await createPost(`${API_URL}/api/sources`, payload);

    if (response.error) {
      addNotification(
        "danger",
        `Source creation failed`,
        `Failed to create ${(response.data as Source)?.name}: ${response.error}`
      );
    } else {
      modelLoaded && onSelection && onSelection(response.data as Source);
      addNotification(
        "success",
        `Create successful`,
        `Source "${(response.data as Source).name}" created successfully.`
      );
      !modelLoaded && navigateTo("/source");
    }
  };

  const handleCreate = async (
    values: Record<string, string>,
    setError: (fieldId: string, error: string | undefined) => void
  ) => {
    if (editorSelected === "form-editor") {
      if (!values["source-name"]) {
        setError("source-name", "Source name is required.");
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
            `Source creation failed`,
            `Please fill both Key and Value fields for all the properties.`
          );
          setIsLoading(false);
          return;
        }
        const payload = {
          description: values["description"],
          type: find(sourceCatalog, { id: sourceId })?.type || code.type || "",
          schema: "schema321",
          vaults: [],
          config: { "signal.data.collection": signalCollectionName, ...convertMapToObject(properties) },
          name: values["source-name"],
        } as unknown as Payload;
        await createNewSource(payload);
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
        await createNewSource(payload);
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
  const formatCode = () => {
    const kafkaFormat = code as any
    const formatedCode = {
      "name": kafkaFormat.name || "",
      "description": "",
      "type": kafkaFormat.config["connector.class"] || "",
      "schema": "schema123",
      "vaults": [],
      "config": Object.keys(kafkaFormat.config || {}).reduce((acc: any, key) => {
        if (key !== "connector.class") {
          acc[key] = kafkaFormat.config[key];
        }
        return acc;
      }, {})
    };
    console.log("formatedCode", formatedCode);
    setCode(formatedCode);
  }

  const customControl = (
    <CodeEditorControl
      id="format-button"
      icon={<PlayIcon />}
      aria-label="Execute code"
      tooltipProps={{ content: 'Auto convert the json into debezium-platfrom format' }}
      onClick={formatCode}
      isVisible={formatType !== ""}
    >Auto format</CodeEditorControl>
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
          title={t('source:create.title')}
          description={rawConfiguration ?
            "To configure and create a new source connector use the editor below to add or upload an existing json configuration." : t('source:create.description')}
        />
      )}
      {!rawConfiguration && (
        <PageSection className="create_source-toolbar">
          <Toolbar id="source-editor-toggle">
            <ToolbarContent>
              <ToolbarItem>
                <ToggleGroup aria-label="Toggle between form editor and smart editor">
                  <ToggleGroupItem
                    icon={<PencilAltIcon />}
                    text={t('formEditor')}
                    aria-label={t('formEditor')}
                    buttonId="form-editor"
                    isSelected={editorSelected === "form-editor"}
                    onChange={handleItemClick}
                  />

                  <ToggleGroupItem
                    icon={<CodeIcon />}
                    text={t('smartEditor')}
                    aria-label={t('smartEditor')}
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
              sourceId={sourceId}
              properties={properties}
              setProperties={setProperties}
              setCodeAlert={setCodeAlert}
              setFormatType={setFormatType}
            />

            <PageSection
              isWidthLimited={
                (modelLoaded && editorSelected === "form-editor") ||
                !modelLoaded
              }
              isCenterAligned
              isFilled
              className={
                editorSelected === "form-editor"
                  ? "custom-page-section create_source-page_section"
                  : "create_source-page_section"
              }
            >
              {editorSelected === "form-editor" && !rawConfiguration ? (
                <SourceSinkForm
                  ConnectorId={sourceId || ""}
                  connectorType="source"
                  properties={properties}
                  setValue={setValue}
                  getValue={getValue}
                  setError={setError}
                  errors={errors}
                  errorWarning={errorWarning}
                  handleAddProperty={handleAddProperty}
                  handleDeleteProperty={handleDeleteProperty}
                  handlePropertyChange={handlePropertyChange}
                  updateSignalCollectionName={updateSignalCollectionName}
                />
              ) : (
                <>
                  {codeAlert && (
                    <Alert
                      variant={formatType !== "" ? "warning" : "danger"}
                      isInline
                      title={formatType === "" ? `Provided json is not valid: ${codeAlert}` : "Invalid json format"}
                      style={{ marginBottom: "20px" }}
                    >
                      <p>{formatType === "" ? "" : <>Provided json is of kafka connect format, use <a href="#format-button">Auto format</a> to transform it to Debezium-platform supported format</>}</p>
                    </Alert>

                  )}
                  <div style={{ flex: '1 1 auto', minHeight: 0 }} className="smart-editor">
                    <CodeEditor
                      isUploadEnabled
                      isDownloadEnabled
                      isCopyEnabled
                      isLanguageLabelVisible
                      isMinimapVisible
                      language={Language.json}
                      downloadFileName="source-connector.json"
                      isFullHeight
                      code={JSON.stringify(code, null, 2)}
                      customControls={customControl}
                      onCodeChange={(value) => {
                        try {
                          const parsedCode = JSON.parse(value);
                          setCode(parsedCode);
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
              <ActionGroup className="create_source-footer">
                <Button
                  variant="primary"
                  isLoading={isLoading}
                  isDisabled={isLoading || codeAlert !== ""}
                  type={ButtonType.submit}
                  onClick={(e) => {
                    e.preventDefault();

                    handleCreate(values, setError);
                  }}
                >
                  {t('source:create.title')}
                </Button>
                {modelLoaded ? (
                  <Button
                    variant="link"
                    onClick={() => selectSource && selectSource("")}
                  >
                    {t('back')}
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    onClick={() => navigateTo("/source/catalog")}
                  >
                    {t('source:catalog.backToCatalog')}
                  </Button>
                )}
              </ActionGroup>
            </PageSection>
          </>
        )}
      </FormContextProvider>
    </>
  );
};

export { CreateSource };
