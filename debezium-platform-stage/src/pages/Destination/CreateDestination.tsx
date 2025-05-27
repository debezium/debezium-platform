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
import { PencilAltIcon, CodeIcon } from "@patternfly/react-icons";
import destinationCatalog from "../../__mocks__/data/DestinationCatalog.json";
import { useNavigate, useParams } from "react-router-dom";
import "./CreateDestination.css";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { find } from "lodash";
import { createPost, Destination, Payload } from "../../apis/apis";
import { API_URL, initialConnectorSchema, connectorSchema } from "../../utils/constants";
import { convertMapToObject } from "../../utils/helpers";
import { useNotification } from "../../appLayout/AppNotificationContext";
import PageHeader from "@components/PageHeader";
import SourceSinkForm from "@components/SourceSinkForm";
import { useEffect, useRef, useState } from "react";
import Ajv from "ajv";
import { useTranslation } from "react-i18next";

const ajv = new Ajv();

interface CreateDestinationProps {
  modelLoaded?: boolean;
  selectedId?: string;
  selectDestination?: (destinationId: string) => void;
  onSelection?: (selection: Destination) => void;
}

type Properties = { key: string; value: string };

const FormSyncManager: React.FC<{
  getFormValue: (key: string) => string;
  setFormValue: (key: string, value: string) => void;
  code: any;
  setCode: (code: any) => void;
  destinationId: string | undefined;
  properties: Map<string, Properties>;
  setProperties: (properties: Map<string, Properties>) => void;
  setCodeAlert: (alert: string) => void;
}> = ({
  getFormValue,
  setFormValue,
  code,
  setCode,
  destinationId,
  properties,
  setProperties,
  setCodeAlert,
}) => {
    const validate = ajv.compile(initialConnectorSchema);
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

    // Update form values when code changes
    useEffect(() => {
      const isValid = validate(code);
      if (isValid) {
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
        setCodeAlert("");
      } else {
        setCodeAlert(ajv.errorsText(validate.errors));
      }
    }, [code]);

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
  const [codeAlert, setCodeAlert] = useState("");

  const [errorWarning, setErrorWarning] = useState<string[]>([]);
  const [editorSelected, setEditorSelected] = React.useState("form-editor");
  const [isLoading, setIsLoading] = React.useState(false);

  const [properties, setProperties] = useState<Map<string, Properties>>(
    new Map([["key0", { key: "", value: "" }]])
  );
  const [keyCount, setKeyCount] = React.useState<number>(1);

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
          description={t("destination:create.description")}
        />
      )}

      <PageSection className="create_destination-toolbar">
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
                  ? "custom-page-section create_destination-page_section"
                  : "create_destination-page_section"
              }
            >
              {editorSelected === "form-editor" ? (
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
                />
              ) : (
                <>
                  {codeAlert && (
                    <Alert
                      variant="danger"
                      isInline
                      title={`Provided json is not valid: ${codeAlert}`}
                      style={{ marginBottom: "10px" }}
                    />
                  )}
                  <div style={{ flex: '1 1 auto', minHeight: 0 }} className="smart-editor">
                    <CodeEditor
                      isUploadEnabled
                      isDownloadEnabled
                      isCopyEnabled
                      isLanguageLabelVisible
                      isMinimapVisible
                      language={Language.json}
                      downloadFileName="destination-connector.json"
                      isFullHeight
                      code={JSON.stringify(code, null, 2)}
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
              <ActionGroup className="create_destination-footer">
                <Button
                  variant="primary"
                  isLoading={isLoading}
                  isDisabled={isLoading}
                  type={ButtonType.submit}
                  onClick={(e) => {
                    e.preventDefault();

                    handleCreate(values, setError);
                  }}
                >
                  {t("destination:create.title")}
                </Button>
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
              </ActionGroup>
            </PageSection>
          </>
        )}
      </FormContextProvider>
    </>
  );
};

export { CreateDestination };
