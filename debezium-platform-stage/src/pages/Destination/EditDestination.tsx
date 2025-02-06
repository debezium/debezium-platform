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
import { useNavigate, useParams } from "react-router-dom";
import "./CreateDestination.css";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { useEffect, useRef, useState } from "react";
import {
  Destination,
  DestinationConfig,
  editPut,
  fetchDataTypeTwo,
  Payload,
} from "../../apis/apis";
import { API_URL, connectorSchema, initialConnectorSchema } from "../../utils/constants";
import { convertMapToObject } from "../../utils/helpers";
import { useData } from "../../appLayout/AppContext";
import { useNotification } from "../../appLayout/AppNotificationContext";
import SourceSinkForm from "@components/SourceSinkForm";
import PageHeader from "@components/PageHeader";
import Ajv from "ajv";

const ajv = new Ajv();

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

const EditDestination: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { destinationId } = useParams<{ destinationId: string }>();
  const navigateTo = (url: string) => {
    navigate(url);
  };
  const { navigationCollapsed } = useData();
  const { addNotification } = useNotification();

  const [editorSelected, setEditorSelected] = React.useState("form-editor");
  const [errorWarning, setErrorWarning] = useState<string[]>([]);
  const [destination, setDestination] = useState<Destination>();
  const [isFetchLoading, setIsFetchLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [properties, setProperties] = useState<Map<string, Properties>>(
    new Map([["key0", { key: "", value: "" }]])
  );
  const [keyCount, setKeyCount] = useState<number>(1);

  const [code, setCode] = useState({
    name: "",
    description: "",
    type: "",
    schema: "schema123",
    vaults: [],
    config: {},
  });
  const [codeAlert, setCodeAlert] = useState("");

  const validate = ajv.compile(connectorSchema);

  const setConfigProperties = (configProp: DestinationConfig) => {
    let i = 0;
    const configMap = new Map();
    for (const config in configProp) {
      configMap.set(`key${i}`, { key: config, value: configProp[config] });
      i++;
    }
    setProperties(configMap);
    setKeyCount(configMap.size);
  };

  React.useEffect(() => {
    const fetchDestinations = async () => {
      setIsFetchLoading(true);
      const response = await fetchDataTypeTwo<Destination>(
        `${API_URL}/api/destinations/${destinationId}`
      );

      if (response.error) {
        setError(response.error);
      } else {
        setDestination(response.data as Destination);
        setConfigProperties(response.data?.config ?? { "": "" });
        setCode((prevCode: any) => {
          return {
            ...prevCode,
            type: response.data?.type,
          };
        });
      }

      setIsFetchLoading(false);
    };

    fetchDestinations();
  }, [destinationId]);

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

  const editDestination = async (payload: Payload) => {
    const response = await editPut(
      `${API_URL}/api/destinations/${destinationId}`,
      payload
    );

    if (response.error) {
      addNotification(
        "danger",
        `Edit failed`,
        `Failed to edit ${(response.data as Destination)?.name}: ${
          response.error
        }`
      );
    } else {
      addNotification(
        "success",
        `Edit successful`,
        `Destination "${
          (response.data as Destination)?.name
        }" edited successfully.`
      );
      navigateTo("/destination");
    }
  };

  const handleEditDestination = async (
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
            `Destination edit failed`,
            `Please fill both Key and Value fields for all the properties.`
          );
          setIsLoading(false);
          return;
        }
        const payload = {
          description: values["description"],
          config: convertMapToObject(properties),
          name: values["destination-name"],
        };
        await editDestination(payload as Payload);
        setIsLoading(false);
      }
    } else {
      if (codeAlert) return;
      const payload = code;
      const isValid = validate(payload);
      if (!isValid) {
        setCodeAlert(ajv.errorsText(validate.errors));
        return;
      } else {
        setIsLoading(true);
        await editDestination(payload as Payload);
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

  if (isFetchLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      <PageHeader
        title="Edit destination"
        description=" To configure and create a connector fill out the below form or use
            the smart editor to setup a new Destination connector. If you
            already have a configuration file, you can setup a new Destination
            connector by uploading it in the smart editor."
      />

      <PageSection className="create_destination-toolbar">
        <Toolbar id="destination-editor-toggle">
          <ToolbarContent>
            <ToolbarItem>
              <ToggleGroup aria-label="Toggle between form editor and smart editor">
                <ToggleGroupItem
                  icon={<PencilAltIcon />}
                  text="Form editor"
                  aria-label="Form editor"
                  buttonId="form-editor"
                  isSelected={editorSelected === "form-editor"}
                  onChange={handleItemClick}
                />

                <ToggleGroupItem
                  icon={<CodeIcon />}
                  text="Smart editor"
                  aria-label="Smart editor"
                  buttonId="smart-editor"
                  isSelected={editorSelected === "smart-editor"}
                  onChange={handleItemClick}
                />
              </ToggleGroup>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </PageSection>

      <FormContextProvider
        initialValues={{
          "destination-name": destination?.name || "",
          description: destination?.description || "",
        }}
      >
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
              isWidthLimited
              isCenterAligned
              isFilled
              className={
                navigationCollapsed && editorSelected === "form-editor"
                  ? "custom-page-section create_destination-page_section"
                  : "create_destination-page_section"
              }
            >
              {editorSelected === "form-editor" ? (
                <SourceSinkForm
                  ConnectorId={destinationId || ""}
                  dataType={destination?.type || ""}
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
                        if (parsedCode.type !== destination?.type) {
                          setCodeAlert(
                            "Connector type cannot be changed in the edit flow."
                          );
                        } else {
                          setCode(parsedCode);
                        }
                      } catch (error) {
                        console.error("Invalid JSON:", error);
                      }
                    }}
                    onEditorDidMount={onEditorDidMount}
                  />
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
                    handleEditDestination(values, setError);
                  }}
                >
                  Save changes
                </Button>
                <Button
                  variant="link"
                  onClick={() => navigateTo("/destination")}
                >
                  Cancel
                </Button>
              </ActionGroup>
            </PageSection>
          </>
        )}
      </FormContextProvider>
    </>
  );
};

export { EditDestination };
