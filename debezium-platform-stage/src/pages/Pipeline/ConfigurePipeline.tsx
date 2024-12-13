/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  ActionGroup,
  Button,
  ButtonType,
  Card,
  CardBody,
  Flex,
  FlexItem,
  Form,
  FormContextProvider,
  FormGroup,
  FormHelperText,
  FormSection,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  PageSection,
  Skeleton,
  TextInput,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import {
  PencilAltIcon,
  CodeIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
} from "@patternfly/react-icons";
import ConnectorImage from "../../components/ComponentImage";
import { useLocation, useNavigate } from "react-router-dom";
import "./ConfigurePipeline.css";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { useEffect, useState } from "react";
import {
  createPost,
  Destination,
  fetchDataTypeTwo,
  Source,
} from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import PageHeader from "@components/PageHeader";
import { useAtom } from "jotai";
import { selectedTransformAtom } from "./PipelineDesigner";
import { useNotification } from "@appContext/AppNotificationContext";

const ConfigurePipeline: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const sourceId = params.get("sourceId");
  const destinationId = params.get("destinationId");

  const [selectedTransform] = useAtom(selectedTransformAtom);

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

  const createNewPipeline = async (values: Record<string, string>) => {
    const payload = {
      description: values["description"],
      logLevel: values["log-level"],
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
    };

    const response = await createPost(`${API_URL}/api/pipelines`, payload);

    return response;
  };

  const handleCreatePipeline = async (values: Record<string, string>) => {
    console.log("values", values);
    setIsLoading(true);
    if(!values["log-level"]) {
      setLogLevelError(true);
      setIsLoading(false);
      return;
    }
    const response = await createNewPipeline(values);
    if (response.error) {
      addNotification(
        "danger",
        `Pipeline creation failed`,
        `${response.error}`
      );
      setIsLoading(false);
      return;
    }
    addNotification(
      "success",
      `Pipeline creation successful.`,
      `Pipeline "${values["pipeline-name"]}" created successfully.`
    );
    setIsLoading(false);

    navigateTo("/pipeline");
  };

  const [logLevelError, setLogLevelError] = React.useState<boolean>(false);

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

  return (
    <>
      <PageHeader
        title="Create pipeline"
        description="To configure and create a data pipeline fill out the below form or
            use the smart editor to setup a new data pipeline. If you already
            have a configuration file, you can setup a new data pipeline by
            uploading it in the smart editor."
      />
      <PageSection className="create_pipeline-toolbar">
        <Toolbar id="create-editor-toggle" className="create_pipeline-toolbar">
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

      <FormContextProvider initialValues={{}}>
        {({ setValue, getValue, setError, values, errors }) => (
          <>
            <PageSection
              isWidthLimited={true}
              isCenterAligned
              isFilled
              className={
                editorSelected === "form-editor" ? "pipeline-page-section" : ""
              }
            >
              {editorSelected === "form-editor" ? (
                <Card className="pipeline-card-body">
                  <CardBody isFilled>
                    <Form isWidthLimited>
                      <FormGroup
                        label="Pipeline flow"
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
                        label="Pipeline name"
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
                        label="Description"
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
                              Add a one liner to describe your pipeline or what
                              you plan to capture.
                            </HelperTextItem>
                          </HelperText>
                        </FormHelperText>
                      </FormGroup>
                      <FormSection
                        title="Configuration properties"
                        titleElement="h2"
                        className="custom-form-group"
                      >
                        <FormGroup
                          label="Log level"
                          isRequired
                          fieldId="log-level-field"
                        >
                          <FormSelect
                           value={getValue("log-level")}
                          isRequired
                          id={'log-level'}
                          onChange={(_event, value) => {
                            setValue("log-level", value);
                            setLogLevelError(false);
                          }}
                          aria-label="FormSelect Input"
                          ouiaId="BasicFormSelect"
                          validated={
                            logLevelError ? "error" : "default"
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
                      </FormSection>
                    </Form>
                  </CardBody>
                </Card>
              ) : (
                <CodeEditor
                  isUploadEnabled
                  isDownloadEnabled
                  isCopyEnabled
                  isLanguageLabelVisible
                  isMinimapVisible
                  language={Language.yaml}
                  height="450px"
                />
              )}
            </PageSection>
            <PageSection className="pf-m-sticky-bottom" isFilled={false}>
              <ActionGroup className="create_pipeline-footer">
                <Button
                  variant="primary"
                  isLoading={isLoading}
                  isDisabled={isLoading}
                  type={ButtonType.submit}
                  onClick={(e) => {
                    e.preventDefault();

                    if (!values["pipeline-name"]) {
                      setError("pipeline-name", "Pipeline name is required.");
                    } else {
                      handleCreatePipeline(values);
                    }
                  }}
                >
                  Create pipeline
                </Button>
                <Button variant="link" onClick={handleGoBack}>
                  Back
                </Button>
              </ActionGroup>
            </PageSection>
          </>
        )}
      </FormContextProvider>
    </>
  );
};

export { ConfigurePipeline };
