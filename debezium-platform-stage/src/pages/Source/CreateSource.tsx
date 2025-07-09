/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  ActionGroup,
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
import { Trans, useTranslation } from "react-i18next";
import { connectorSchema } from "@utils/schemas";
import { isValidJson, useFormatDetector } from "src/hooks/useFormatDetector";
import { formatCode } from "@utils/formatCodeUtils";

const ajv = new Ajv();

interface CreateSourceProps {
  modelLoaded?: boolean;
  selectedId?: string;
  selectSource?: (sourceId: string) => void;
  onSelection?: (selection: Source) => void;
}

const initialCodeValue = {
  name: "",
  description: "",
  type: "",
  schema: "schema123",
  vaults: [],
  config: {},
};

type Properties = { key: string; value: string };

const FormSyncManager: React.FC<{
  getFormValue: (key: string) => string;
  setFormValue: (key: string, value: string) => void;
  code: any;
  setCode: (code: any) => void;
  sourceId: string | undefined;
  properties: Map<string, Properties>;
  setProperties: (properties: Map<string, Properties>) => void;
  setCodeAlert: (alert: string | React.ReactElement) => void;
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

    // Use the useFormatDetector hook
    const { formatType, isValidFormat, errorMsg } = useFormatDetector(code, "source");

    // Update form values when code changes
    useEffect(() => {
      if (formatType === "kafka-connect") {
        setFormatType("kafka-connect");
        setCodeAlert(
          <Trans
            i18nKey="statusMessage:smartEditor.kafkaConnectFormatMsg"
            components={[<i key="italic" />]}
          />
        );
        return;
      } else if (formatType === "properties-file") {
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

  const [code, setCode] = useState<string | Payload>(initialCodeValue);

  const sourceIdParam = useParams<{ sourceId: string }>();
  const [codeAlert, setCodeAlert] = useState<string | React.ReactElement>("");
  const [formatType, setFormatType] = useState("dbz-platform");
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
        setError("source-name", t("statusMessage:smartEditor.sourceNameRequired"));
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
          type: find(sourceCatalog, { id: sourceId })?.type || (code as Payload).type || "",
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
        setCode(formatCode("source", formatType, code));
        setIsFormatting(false);
      }}
      isVisible={formatType === "kafka-connect" || formatType === "properties-file"}
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
          title={t('source:create.title')}
          description={rawConfiguration ?
            t('source:create.editorPageDescription') : t('source:create.description')}
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
                      variant={formatType === "dbz-platform" ? "danger" : "warning"}
                      isInline
                      title={formatType === "dbz-platform" ? "Invalid JSON: " + codeAlert : formatType === "kafka-connect" ? "Invalid json format" : "Invalid JSON"}
                      style={{ marginBottom: "20px" }}
                    >
                      {formatType !== "dbz-platform" && codeAlert}
                    </Alert>

                  )}
                  <div style={{ flex: '1 1 auto', minHeight: 0 }} className="smart-editor">
                    <CodeEditor
                      isUploadEnabled
                      isDownloadEnabled
                      isCopyEnabled
                      isLanguageLabelVisible
                      isMinimapVisible
                      language={Language.json || Language.plaintext}
                      downloadFileName="source-connector.json"
                      isFullHeight
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
              <ActionGroup className="create_source-footer">
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
