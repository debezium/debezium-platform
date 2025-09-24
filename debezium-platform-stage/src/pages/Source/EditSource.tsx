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
  Modal,
  ModalBody,
  ModalHeader,
  PageSection,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { PencilAltIcon, CodeIcon } from "@patternfly/react-icons";
import { useParams, useSearchParams } from "react-router-dom";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { PageHeader } from "@patternfly/react-component-groups"
import { useCallback, useEffect, useState } from "react";
import {
  ConnectionConfig,
  editPut,
  fetchDataTypeTwo,
  Payload,
  Source,
  SourceConfig,
} from "../../apis/apis";
import {
  API_URL
} from "../../utils/constants";
import { convertMapToObject, getConnectorTypeName } from "../../utils/helpers";
import { useNotification } from "../../appLayout/AppNotificationContext";
import SourceSinkForm from "@components/SourceSinkForm";
import Ajv from "ajv";
import { useTranslation } from "react-i18next";
import { connectorSchema, initialConnectorSchema } from "@utils/schemas";
import style from "../../styles/createConnector.module.css";
import EditConfirmationModel from "../components/EditConfirmationModel";
import { CreateConnection } from "../Connection/CreateConnection";

const ajv = new Ajv();

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
}> = ({
  getFormValue,
  setFormValue,
  code,
  setCode,
  sourceId,
  properties,
  setProperties,
  setCodeAlert,
}) => {
    const validate = ajv.compile(initialConnectorSchema);
    // Ref to track the source of the update
    const updateSource = React.useRef<"form" | "code" | null>(null);

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
          prevCode.name === getFormValue("source-name") &&
          prevCode.description === getFormValue("description") &&
          JSON.stringify(prevCode.config) === JSON.stringify(configuration)
        ) {
          return prevCode;
        }

        return {
          ...prevCode,
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
      const isValid = validate(code);
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

const EditSource: React.FunctionComponent = () => {
  const { t } = useTranslation();
  const { sourceId } = useParams<{ sourceId: string }>();
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{
    values: Record<string, string>;
    setError: (fieldId: string, error: string | undefined) => void;
  } | null>(null);

  const { addNotification } = useNotification();

  // const { navigationCollapsed } = useData();
  const [editorSelected, setEditorSelected] = React.useState("form-editor");
  const [errorWarning, setErrorWarning] = useState<string[]>([]);
  const [source, setSource] = useState<Source>();
  const [isFetchLoading, setIsFetchLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [properties, setProperties] = useState<Map<string, Properties>>(
    new Map([["key0", { key: "", value: "" }]])
  );
  const [keyCount, setKeyCount] = useState<number>(1);

  const [selectedConnection, setSelectedConnection] = useState<ConnectionConfig | undefined>();

  const [searchParams] = useSearchParams();
  const initialState = searchParams.get("state") as "view" | "edit" | null;

  const [viewMode, setViewMode] = useState<boolean>(initialState === "view");

  const [code, setCode] = useState({
    name: "",
    description: "",
    type: "",
    schema: "schema123",
    vaults: [],
    config: {},
  });
  const [codeAlert, setCodeAlert] = useState("");

  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);


  const handleConnectionModalToggle = useCallback(() => {
    setIsConnectionModalOpen(!isConnectionModalOpen);
  }, [isConnectionModalOpen]);

  const validate = ajv.compile(connectorSchema);

  const setConfigProperties = (configProp: SourceConfig) => {
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
    const fetchSources = async () => {
      setIsFetchLoading(true);
      const response = await fetchDataTypeTwo<Source>(
        `${API_URL}/api/sources/${sourceId}`
      );

      if (response.error) {
        setError(response.error);
      } else {
        setSource(response.data as Source);
        setConfigProperties(response.data?.config ?? { "": "" });
        setSelectedConnection(response.data?.connection as ConnectionConfig);
        setCode((prevCode: any) => {
          return {
            ...prevCode,
            type: response.data?.type,
          };
        });
      }

      setIsFetchLoading(false);
    };

    fetchSources();
  }, [sourceId, setSelectedConnection]);

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

  const editSource = async (payload: Payload) => {
    const response = await editPut(
      `${API_URL}/api/sources/${sourceId}`,
      payload
    );

    if (response.error) {
      addNotification(
        "danger",
        t('statusMessage:edit.failedTitle'),
        t("statusMessage:edit.failedDescription", { val: `${(response.data as Source)?.name}: ${response.error}` }),
      );
    } else {
      addNotification(
        "success",
        t('statusMessage:edit.successTitle'),
        t("statusMessage:edit.successDescription", { val: `${(response.data as Source)?.name}` })
      );
      setViewMode(true);
    }
  };

  const handleEditSource = async (
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
            `Source edit failed`,
            `Please fill both Key and Value fields for all the properties.`
          );
          setIsLoading(false);
          return;
        }
        const payload = {
          description: values["description"],
          config: convertMapToObject(properties),
          ...(selectedConnection ? { connection: selectedConnection } : {}),
          name: values["source-name"],
        };
        await editSource(payload as Payload);
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
        await editSource(payload);
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
    return <div>{t('loading')}</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      {viewMode ? (

        <PageHeader
          title={source?.name || t("source:edit.title")}
          subtitle={`${getConnectorTypeName(source?.type || sourceId || "")} source connector.`}
          actionMenu={
            <Button variant="secondary" ouiaId="Primary" icon={<PencilAltIcon />}
              onClick={() => { setViewMode(false); }}>
              {t("edit")}
            </Button>
          }
        // icon={ <ConnectorImage connectorType={source?.type || sourceId || ""} size={35} />}
        />
      ) : (
        <PageHeader
          title={<>{t("edit")} <i>{source?.name}</i></>}
          subtitle={t("source:edit.description")}
        />
      )}

      {!viewMode && (
        <PageSection className={style.createConnector_toolbar}>
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


      <FormContextProvider
        initialValues={{
          "source-name": source?.name || "",
          description: source?.description || "",
        }}
      >
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
            />
            <PageSection
              isWidthLimited
              isCenterAligned
              isFilled
              className={`customPageSection ${style.createConnector_pageSection}`}
            >
              {editorSelected === "form-editor" ? (
                <SourceSinkForm
                  ConnectorId={sourceId || ""}
                  dataType={source?.type || ""}
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
                  editFlow={true}
                  viewMode={viewMode}
                  setSelectedConnection={setSelectedConnection}
                  selectedConnection={selectedConnection}
                  handleConnectionModalToggle={handleConnectionModalToggle}
                />
              ) : (
                <>
                  {codeAlert && (
                    <Alert
                      variant="danger"
                      isInline
                      title={`Provided json is not valid: ${codeAlert}`}
                      className={style.createConnector_alert}
                    />
                  )}
                  <div className={`${style.smartEditor} smartEditor`}>
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
                      onCodeChange={(value) => {
                        try {
                          const parsedCode = JSON.parse(value);
                          if (parsedCode.type !== source?.type) {
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

                  </div>

                </>
              )}
            </PageSection>
            {!viewMode && (
              <PageSection className="pf-m-sticky-bottom" isFilled={false}>
                <ActionList>
                  <ActionListGroup>
                    <ActionListItem>
                      <Button
                        variant="primary"
                        isLoading={isLoading}
                        isDisabled={isLoading}
                        type={ButtonType.submit}
                        onClick={(e) => {
                          e.preventDefault();
                          setPendingSave({ values, setError });
                          setIsWarningOpen(true);
                        }}
                      >
                        {t("saveChanges")}
                      </Button>
                    </ActionListItem>
                    <ActionListItem>
                      <Button variant="link" onClick={() => setViewMode(true)}>
                        {t("cancel")}
                      </Button>
                    </ActionListItem>
                  </ActionListGroup>
                </ActionList>
              </PageSection>
            )}

          </>
        )}
      </FormContextProvider>
      <EditConfirmationModel
        type="source"
        isWarningOpen={isWarningOpen}
        setIsWarningOpen={setIsWarningOpen}
        pendingSave={pendingSave}
        setPendingSave={setPendingSave}
        handleEdit={handleEditSource} />
              <Modal
        isOpen={isConnectionModalOpen}
        width="80%"
        onClose={handleConnectionModalToggle}
        aria-labelledby="modal-with-description-title"
        aria-describedby="modal-box-body-destination-with-description"
      >
        <ModalHeader
          title="Create connection"
          className="pipeline_flow-modal_header"
          labelId="modal-with-destination-description-title"
          description="Create a new connection for your source, select the connection type from the list below."
        />
        <ModalBody
          tabIndex={0}
          id="modal-box-body-destination-with-description"
        >
          <CreateConnection selectedConnectionType={"source"} selectedConnectionId={selectedConnection?.name || ""} handleConnectionModalToggle={handleConnectionModalToggle} setSelectedConnection={setSelectedConnection} />
        </ModalBody>
      </Modal>
    </>
  );
};

export { EditSource };
