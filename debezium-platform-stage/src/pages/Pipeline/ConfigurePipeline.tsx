/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Alert,
  Button,
  ButtonType,
  Card,
  CardBody,
  Flex,
  FlexItem,
  Form,
  FormAlert,
  FormContextProvider,
  FormFieldGroup,
  FormFieldGroupHeader,
  FormGroup,
  FormHelperText,
  FormSection,
  FormSelect,
  FormSelectOption,
  Grid,
  HelperText,
  HelperTextItem,
  PageSection,
  Skeleton,
  Split,
  SplitItem,
  TextInput,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from "@patternfly/react-core";
import {
  PencilAltIcon,
  CodeIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  TrashIcon,
  PlusIcon,
} from "@patternfly/react-icons";
import ConnectorImage from "../../components/ComponentImage";
import { useLocation, useNavigate } from "react-router-dom";
import "./ConfigurePipeline.css";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { useEffect, useRef, useState } from "react";
import {
  createPost,
  Destination,
  fetchDataTypeTwo,
  PipelinePayload,
  Source,
  Transform,
} from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import PageHeader from "@components/PageHeader";
import { useAtom } from "jotai";
import { selectedTransformAtom } from "./PipelineDesigner";
import { useNotification } from "@appContext/AppNotificationContext";
import Ajv from "ajv";
import { useTranslation } from "react-i18next";
import { pipelineSchema } from "@utils/schemas";
import style from "../../styles/createConnector.module.css"
import { Properties } from "src/hooks/useConnectorForm";
import { useData } from "@appContext/AppContext";

const ajv = new Ajv();

const FormSyncManager: React.FC<{
  getFormValue: (key: string) => string;
  setFormValue: (key: string, value: string) => void;
  code: any;
  setCode: (code: any) => void;
  setCodeAlert: (alert: string) => void;
}> = ({ getFormValue, setFormValue, code, setCode, setCodeAlert }) => {
  const validate = ajv.compile(pipelineSchema);
  // Ref to track the source of the update
  const updateSource = useRef<"form" | "code" | null>(null);

  // Update code state when form values change
  useEffect(() => {
    if (updateSource.current === "code") {
      updateSource.current = null;
      return;
    }

    updateSource.current = "form";

    setCode((prevCode: any) => {
      if (
        prevCode.name === getFormValue("pipeline-name") &&
        prevCode.description === getFormValue("description") &&
        prevCode.logLevel === getFormValue("log-level")
      ) {
        return prevCode;
      }

      return {
        ...prevCode,
        name: getFormValue("pipeline-name") || "",
        description: getFormValue("description") || "",
        logLevel: getFormValue("log-level") || "",
      };
    });
  }, [
    getFormValue("pipeline-name"),
    getFormValue("description"),
    getFormValue("log-level"),
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
      if (code.name !== getFormValue("pipeline-name")) {
        setFormValue(
          "pipeline-name",
          typeof code.name === "string" ? code.name : ""
        );
      }
      if (code.description !== getFormValue("description")) {
        setFormValue(
          "description",
          typeof code.description === "string" ? code.description : ""
        );
      }
      if (code["log-level"] !== getFormValue("log-level")) {
        setFormValue(
          "log-level",
          typeof code["logLevel"] === "string" ? code["logLevel"] : ""
        );
      }
      setCodeAlert("");
    } else {
      setCodeAlert(ajv.errorsText(validate.errors));
    }
  }, [code]);

  return null;
};

const ConfigurePipeline: React.FunctionComponent = () => {
  const { darkMode } = useData();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const sourceId = params.get("sourceId");
  const destinationId = params.get("destinationId");


  const [pkgLevelLog, setPkgLevelLog] = useState<Map<string, Properties>>(
    new Map()
  );
  const [keyCount, setKeyCount] = useState<number>(1);

  const handleAddProperty = () => {
    const newKey = `key${keyCount}`;
    setPkgLevelLog(
      (prevPkgLevelLog) =>
        new Map(prevPkgLevelLog.set(newKey, { key: "", value: "" }))
    );
    setKeyCount((prevCount) => prevCount + 1);
  };

  const handlePropertyChange = (
    key: string,
    type: "key" | "value",
    newValue: string
  ) => {
    setPkgLevelLog((prevPkgLevelLog) => {
      const newProperties = new Map(prevPkgLevelLog);
      const property = newProperties.get(key);
      if (property) {
        if (type === "key") property.key = newValue;
        else if (type === "value") property.value = newValue;
        newProperties.set(key, property);
      }
      return newProperties;
    });
  };

  const handleDeleteProperty = (key: string) => {
    setPkgLevelLog((prevPkgLevelLog) => {
      const newProperties = new Map(prevPkgLevelLog);
      newProperties.delete(key);
      return newProperties;
    });
  };

  const [code, setCode] = useState({
    name: "",
    description: "",
    source: {
      id: 0,
      name: "",
    },
    destination: {
      id: 0,
      name: "",
    },
    transforms: [] as Transform[],
    logLevel: "",
    logLevels: {} as Record<string, string>,
  });
  const [codeAlert, setCodeAlert] = useState("");

  const validate = ajv.compile(pipelineSchema);

  const { addNotification } = useNotification();

  const navigateTo = (url: string) => {
    navigate(url);
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const [editorSelected, setEditorSelected] = useState("form-editor");

  const [isLoading, setIsLoading] = useState(false);

  const [source, setSource] = useState<Source>();
  const [isSourceLoading, setIsSourceLoading] = useState<boolean>(true);
  const [, setSourceError] = useState<string | null>(null);

  const [destination, setDestination] = useState<Destination>();
  const [, setIsDestinationLoading] = useState<boolean>(true);
  const [, setDestinationError] = useState<string | null>(null);

  const [selectedTransform] = useAtom(selectedTransformAtom);

  React.useEffect(() => {
    if (source?.name && destination?.name) {
      setCode((prev) => {
        const hasChanged = 
          prev.source.id !== source.id ||
          prev.source.name !== source.name ||
          prev.destination.id !== destination.id ||
          prev.destination.name !== destination.name ||
          JSON.stringify(prev.transforms) !== JSON.stringify(selectedTransform || []);
        
        if (!hasChanged) return prev;
        
        return {
          ...prev,
          source: { name: source.name, id: source.id },
          transforms: selectedTransform ? [...selectedTransform] : [],
          destination: { name: destination.name, id: destination.id },
        };
      });
    }
  }, [source, destination, selectedTransform]);

  useEffect(() => {
    const fetchSources = async () => {
      setIsSourceLoading(true);
      const response = await fetchDataTypeTwo<Source>(
        `${API_URL}/api/sources/${sourceId}`
      );

      if (response.error) {
        setSourceError(response.error);
      } else {
        setSource(response.data as Source);
      }

      setIsSourceLoading(false);
    };

    fetchSources();
  }, [sourceId]);

  useEffect(() => {
    const fetchDestination = async () => {
      setIsDestinationLoading(true);
      const response = await fetchDataTypeTwo<Destination>(
        API_URL + `/api/destinations/${destinationId}`
      );

      if (response.error) {
        setDestinationError(response.error);
      } else {
        setDestination(response.data as Destination);
      }

      setIsDestinationLoading(false);
    };

    fetchDestination();
  }, [destinationId]);

  const createNewPipeline = async (payload: PipelinePayload) => {
    const response = await createPost(`${API_URL}/api/pipelines`, payload);

    if (response.error) {
      addNotification(
        "danger",
        t('statusMessage:creation.failedTitle', { val: t('pipeline') }),
        `${response.error}`
      );
      return;
    }
    addNotification(
      "success",
      t('statusMessage:creation.successTitle', { val: t('pipeline') }),
      t('statusMessage:creation.successDescription', { val: `${t('pipeline')} ${payload["name"]}` }),
    );
    navigateTo("/pipeline");

    return response;
  };

  const handleCreate = async (
    values: Record<string, string>,
    setError: (fieldId: string, error: string | undefined) => void
  ) => {
    if (editorSelected === "form-editor") {
      if (!values["pipeline-name"]) {
        setError("pipeline-name", "Pipeline name is required.");
      } else if (!values["log-level"]) {
        setError("log-level", "Root log level is required.");
        return;
      } else {
        setIsLoading(true);
        const invalidLogEntries = Array.from(pkgLevelLog.entries())
          .filter(([, entry]) => !entry.key || !entry.value)
          .map(([key]) => key);
        if (invalidLogEntries.length > 0) {
          setError(`pkg-level-log-config-props-key-field-${invalidLogEntries[0]}`, "Key and value are required.");
          setError(`pkg-level-log-config-props-value-field-${invalidLogEntries[0]}`, "Key and value are required.");
          setIsLoading(false);
          return;
        }
        const payload = {
          description: values["description"],
          logLevel: values["log-level"],
          logLevels: Array.from(pkgLevelLog.entries()).reduce(
            (acc, [, value]) => ({
              ...acc,
              [value.key]: value.value,
            }),
            {}
          ),
          source: {
            name: source?.name,
            id: source?.id,
          },
          destination: {
            name: destination?.name,
            id: destination?.id,
          },
          transforms: [...selectedTransform],
          name: values["pipeline-name"],
        } as PipelinePayload;
        await createNewPipeline(payload);
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
        await createNewPipeline(payload as any);
        setIsLoading(false);
      }
    }
  };

  const options = [
    { value: "", label: "Select log level", disabled: true },
    { value: "OFF", label: "OFF", disabled: false },
    { value: "FATAL", label: "FATAL", disabled: false },
    { value: "ERROR", label: "ERROR", disabled: false },
    { value: "WARN", label: "WARN", disabled: false },
    { value: "INFO", label: "INFO", disabled: false },
    { value: "DEBUG", label: "DEBUG", disabled: false },
    { value: "TRACE", label: "TRACE", disabled: false },
    { value: "ALL", label: "ALL", disabled: false },
  ];

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
      <PageHeader
        title={t('pipeline:form.title')}
        description={t('pipeline:form.description')}
      />
      <PageSection className={style.createConnector_toolbar}>
        <Toolbar id="create-editor-toggle" >
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

      <FormContextProvider initialValues={{}}>
        {({ setValue, getValue, setError, values, errors }) => (
          <>
            <FormSyncManager
              getFormValue={getValue}
              setFormValue={setValue}
              code={code}
              setCode={setCode}
              setCodeAlert={setCodeAlert}
            />
            <PageSection
              isWidthLimited={true}
              isCenterAligned
              isFilled
              className={`customPageSection ${style.createConnector_pageSection}`}
            >
              {editorSelected === "form-editor" ? (
                <Card >
                  <CardBody isFilled>
                    <Form isWidthLimited>
                      {Object.keys(errors).length > 0 && (
                        <FormAlert>
                          <Alert variant="danger" title={t("common:form.error.title")} aria-live="polite" isInline>
                          </Alert>
                        </FormAlert>
                      )}
                      <FormGroup
                        label={t('pipeline:form.flowField')}
                        isRequired
                        fieldId="pipeline-flow-field"
                      >
                        <Flex alignItems={{ default: "alignItemsCenter" }}>
                          {isSourceLoading ? (
                            <>
                              <FlexItem spacer={{ default: "spacerMd" }}>
                                <Skeleton
                                  shape="circle"
                                  width="15%"
                                  screenreaderText="Loading source"
                                />
                              </FlexItem>
                              <FlexItem>
                                <Skeleton
                                  shape="circle"
                                  width="15%"
                                  screenreaderText="Loading source"
                                />
                              </FlexItem>
                            </>
                          ) : (
                            <FlexItem spacer={{ default: "spacerMd" }}>
                              <ConnectorImage
                                connectorType={source?.type || ""}
                                size={30}
                              />
                            </FlexItem>
                          )}

                          <FlexItem spacer={{ default: "spacerMd" }}>
                            {source?.name}
                          </FlexItem>
                          <FlexItem spacer={{ default: "spacerMd" }}>
                            <ArrowRightIcon />
                          </FlexItem>
                          <FlexItem spacer={{ default: "spacerMd" }}>
                            <ConnectorImage
                              connectorType={destination?.type || ""}
                              size={30}
                            />
                          </FlexItem>
                          <FlexItem spacer={{ default: "spacerMd" }}>
                            {destination?.name}
                          </FlexItem>
                        </Flex>
                      </FormGroup>
                      <FormGroup
                        label={t('pipeline:form.nameField')}
                        isRequired
                        fieldId="pipeline-name-field"
                      >
                        <TextInput
                          id="pipeline-name"
                          aria-label="pipeline name"
                          onChange={(_event, value) => {
                            setValue("pipeline-name", value);
                            setError("pipeline-name", undefined);
                          }}
                          value={getValue("pipeline-name")}
                          validated={
                            errors["pipeline-name"] ? "error" : "default"
                          }
                        />
                        <FormHelperText>
                          <HelperText>
                            <HelperTextItem
                              variant={
                                errors["pipeline-name"] ? "error" : "default"
                              }
                              {...(errors["pipeline-name"] && {
                                icon: <ExclamationCircleIcon />,
                              })}
                            >
                              {errors["pipeline-name"]}
                            </HelperTextItem>
                          </HelperText>
                        </FormHelperText>
                      </FormGroup>
                      <FormGroup
                        label={t('pipeline:form.descriptionField')}
                        fieldId="description-field"
                      >
                        <TextInput
                          id="description"
                          aria-label="Pipeline description"
                          onChange={(_event, value) =>
                            setValue("description", value)
                          }
                          value={getValue("description")}
                        />
                        <FormHelperText>
                          <HelperText>
                            <HelperTextItem>
                              {t('pipeline:form.descriptionFieldHelperText')}
                            </HelperTextItem>
                          </HelperText>
                        </FormHelperText>
                      </FormGroup>
                      <FormSection
                        title={t('pipeline:form.subsectionTitle')}
                        titleElement="h2"
                      >
                        <FormGroup
                          label={t("pipeline:form.rootLevelLog")}
                          //  labelInfo="Global setting for all packages"
                          isRequired
                          fieldId="log-level-field"
                        >
                          <FormSelect
                            value={getValue("log-level")}
                            isRequired
                            id={"log-level"}
                            onChange={(_event, value) => {
                              setValue("log-level", value);
                              setError("log-level", undefined);
                            }}
                            aria-label="FormSelect Input"
                            ouiaId="BasicFormSelect"
                            validated={ errors["log-level"] ? "error" : "default"}
                          >
                            {options.map((option, index) => (
                              <FormSelectOption
                                isDisabled={option.disabled}
                                key={index}
                                value={option.value}
                                label={option.label}
                              />
                            ))}
                          </FormSelect>
                          <FormHelperText>
                            <HelperText>
                              <HelperTextItem>{t("pipeline:form.logLevelFieldHelperText")}</HelperTextItem>
                            </HelperText>
                          </FormHelperText>
                        </FormGroup>
                        <FormFieldGroup
                          header={
                            <FormFieldGroupHeader
                              titleText={{
                                text: t("pipeline:form.logLevelSectionHeading"),
                                id: `field-group--id`,
                              }}
                              titleDescription={t("pipeline:form.logLevelSectionDescription")}
                              actions={
                                <>
                                  <Button
                                    variant="secondary"
                                    icon={<PlusIcon />}
                                    onClick={handleAddProperty}
                                  >
                                    {t("pipeline:form.addPackage")}
                                  </Button>
                                </>
                              }
                            />
                          }
                        >
                          {Array.from(pkgLevelLog.keys()).map((key) => (
                            <Split hasGutter key={key}>
                              <SplitItem isFilled>
                                <Grid hasGutter md={6}>
                                  <FormGroup
                                    label=""
                                    isRequired
                                    fieldId={`pkg-level-log-config-props-key-field-${key}`}
                                  >
                                    <TextInput
                                      isRequired
                                      type="text"
                                      placeholder={t("pipeline:form.pkgLogLevelPlaceholder")}
                                      // validated={errorWarning.includes(key) ? "error" : "default"}
                                      id={`pkg-level-log-config-props-key-${key}`}
                                      name={`pkg-level-log-config-props-key-${key}`}
                                      value={pkgLevelLog.get(key)?.key || ""}
                                      validated={
                                        errors[`pkg-level-log-config-props-key-field-${key}`] ? "error" : "default"
                                      }
                                      onChange={(_e, value) => {
                                        handlePropertyChange(key, "key", value);
                                        setError(`pkg-level-log-config-props-key-field-${key}`, undefined);
                                        setError(`pkg-level-log-config-props-value-field-${key}`, undefined);
                                      }


                                      }
                                    />
                                  </FormGroup>
                                  <FormGroup
                                    label=""
                                    isRequired
                                    fieldId={`pkg-level-log-config-props-value-field-${key}`}
                                  >

                                    <FormSelect
                                      value={pkgLevelLog.get(key)?.value || ""}
                                      isRequired
                                      id={`-config-props-value-${key}`}
                                      name={`-config-props-value-${key}`}
                                      onChange={(_event, value) => {
                                        handlePropertyChange(key, "value", value)
                                        setError(`pkg-level-log-config-props-key-field-${key}`, undefined);
                                        setError(`pkg-level-log-config-props-value-field-${key}`, undefined);
                                      }}
                                      aria-label="FormSelect Input"
                                      ouiaId="BasicFormSelect"
                                      validated={
                                        errors[`pkg-level-log-config-props-value-field-${key}`] ? "error" : "default"
                                      }
                                    >
                                      {options.map((option, index) => (
                                        <FormSelectOption
                                          isDisabled={option.disabled}
                                          key={index}
                                          value={option.value}
                                          label={option.label}
                                        />
                                      ))}
                                    </FormSelect>
                                  </FormGroup>
                                </Grid>
                              </SplitItem>
                              <SplitItem>
                                <Tooltip
                                  content={
                                    <div>
                                      {t("delete")}
                                    </div>
                                  }
                                >
                                  <Button
                                    variant="plain"
                                    aria-label="Remove"
                                    onClick={() => handleDeleteProperty(key)}
                                  >
                                    <TrashIcon />
                                  </Button>
                                </Tooltip>

                              </SplitItem>
                            </Split>
                          ))}
                        </FormFieldGroup>
                      </FormSection>
                    </Form>
                  </CardBody>
                </Card>
              ) : (
                <>
                  {codeAlert && (
                    <Alert
                      variant="danger"
                      isInline
                      title={t('statusMessage:codeAlert', { val: codeAlert })}
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
                      isDarkTheme={darkMode}
                      language={Language.json}
                      downloadFileName="pipeline.json"
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
                        handleCreate(values, setError);
                      }}
                    >
                      {t('pipeline:createPipeline')}
                    </Button>
                  </ActionListItem>
                  <ActionListItem>
                    <Button variant="link" onClick={handleGoBack}>
                      {t('back')}
                    </Button>
                  </ActionListItem>
                </ActionListGroup>
              </ActionList>

            </PageSection>
          </>
        )}
      </FormContextProvider>
    </>
  );
};

export { ConfigurePipeline };
