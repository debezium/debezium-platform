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
import { useNavigate, useParams } from "react-router-dom";
import "./ConfigurePipeline.css";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { useEffect, useState } from "react";
import {
  Destination,
  editPut,
  fetchDataTypeTwo,
  Pipeline,
  Source,
} from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { useData } from "../../appLayout/AppContext";
import { useNotification } from "../../appLayout/AppNotificationContext";

const EditPipeline: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { pipelineId } = useParams<{ pipelineId: string }>();

  const navigateTo = (url: string) => {
    navigate(url);
  };

  const { navigationCollapsed } = useData();

  const { addNotification } = useNotification();

  const [editorSelected, setEditorSelected] = useState("form-editor");

  const [isLoading, setIsLoading] = useState(false);

  const [pipeline, setPipeline] = useState<Pipeline>();
  const [isPipelineLoading, setIsPipelineLoading] = useState<boolean>(true);
  const [isPipelineError, setPipelineError] = useState<string | null>(null);

  const [source, setSource] = useState<Source>();
  const [isSourceLoading, setIsSourceLoading] = useState<boolean>(true);
  const [, setSourceError] = useState<string | null>(null);

  const [destination, setDestination] = useState<Destination>();
  const [isDestinationLoading, setIsDestinationLoading] =
    useState<boolean>(true);
  const [, setDestinationError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPipelines = async () => {
      setIsPipelineLoading(true);
      const response = await fetchDataTypeTwo<Pipeline>(
        `${API_URL}/api/pipelines/${pipelineId}`
      );

      if (response.error) {
        setPipelineError(response.error);
      } else {
        setLogLevel(response?.data?.logLevel || "");
        setPipeline(response.data as Pipeline);
        // Call fetchSources and fetchDestination only on successful pipeline fetch
        await fetchSources(response.data as Pipeline);
        await fetchDestination(response.data as Pipeline);
      }

      setIsPipelineLoading(false);
    };

    fetchPipelines();
  }, [pipelineId]);

  const fetchSources = async (pipeline: Pipeline) => {
    setIsSourceLoading(true);
    const response = await fetchDataTypeTwo<Source>(
      `${API_URL}/api/sources/${pipeline.source.id}`
    );

    if (response.error) {
      setSourceError(response.error);
    } else {
      setSource(response.data as Source);
    }

    setIsSourceLoading(false);
  };

  const fetchDestination = async (pipeline: Pipeline) => {
    setIsDestinationLoading(true);
    const response = await fetchDataTypeTwo<Destination>(
      `${API_URL}/api/destinations/${pipeline.destination.id}`
    );

    if (response.error) {
      setDestinationError(response.error);
    } else {
      setDestination(response.data as Destination);
    }

    setIsDestinationLoading(false);
  };

  const editPipeline = async (values: Record<string, string>) => {
    const payload = {
      description: values["descriptions"],
      logLevel: logLevel,
      name: values["pipeline-name"],
    };

    const response = await editPut(
      `${API_URL}/api/pipelines/${pipelineId}`,
      payload
    );

    if (response.error) {
      addNotification(
        "danger",
        `Edit failed`,
        `Failed to edit ${(response.data as Pipeline).name}: ${response.error}`
      );
    } else {
      addNotification(
        "success",
        `Edit successful`,
        `Pipeline "${(response.data as Pipeline).name}" edited successfully.`
      );
    }
  };

  const handleEditPipeline = async (values: Record<string, string>) => {
    setIsLoading(true);
    await editPipeline(values);

    setIsLoading(false);
    navigateTo("/pipeline");
  };

  const [logLevel, setLogLevel] = React.useState("");

  const onChange = (
    _event: React.FormEvent<HTMLSelectElement>,
    value: string
  ) => {
    setLogLevel(value);
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

  if (isPipelineLoading) {
    return <div>Loading...</div>;
  }

  if (isPipelineError) {
    return <div>Error: {isPipelineError}</div>;
  }

  return (
    <>
      <PageSection isWidthLimited padding={{ md: "noPadding" }}>
        <Toolbar id="edit-editor-toggle" className="edit-toolbar">
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
          "pipeline-name": pipeline?.name || "",
          descriptions: pipeline?.description || "",
        }}
      >
        {({ setValue, getValue, setError, values, errors }) => (
          <>
            <PageSection
              isWidthLimited={editorSelected === "form-editor"}
              isCenterAligned
              isFilled
              style={{ paddingTop: "0", paddingLeft: "0", paddingRight: "0" }}
              // To do: Add custom class to the pf-v6-c-page__main-body for center alignment in collapsed navigation
              className={navigationCollapsed ? "pipeline-page-section" : ""}
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
                            <>
                              <FlexItem spacer={{ default: "spacerMd" }}>
                                <ConnectorImage
                                  connectorType={source?.type || ""}
                                  size={30}
                                />
                              </FlexItem>
                              <FlexItem spacer={{ default: "spacerMd" }}>
                                {source?.name}
                              </FlexItem>
                            </>
                          )}

                          <FlexItem spacer={{ default: "spacerMd" }}>
                            <ArrowRightIcon />
                          </FlexItem>
                          {isDestinationLoading ? (
                            <>
                              <FlexItem spacer={{ default: "spacerMd" }}>
                                <Skeleton
                                  shape="circle"
                                  width="15%"
                                  screenreaderText="Loading destination"
                                />
                              </FlexItem>
                              <FlexItem>
                                <Skeleton
                                  shape="circle"
                                  width="15%"
                                  screenreaderText="Loading destination"
                                />
                              </FlexItem>
                            </>
                          ) : (
                            <>
                              <FlexItem spacer={{ default: "spacerMd" }}>
                                <ConnectorImage
                                  connectorType={destination?.type || ""}
                                  size={30}
                                />
                              </FlexItem>
                              <FlexItem spacer={{ default: "spacerMd" }}>
                                {destination?.name}
                              </FlexItem>
                            </>
                          )}
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
                        fieldId="descriptions-field"
                      >
                        <TextInput
                          id="descriptions"
                          aria-label="Pipeline description"
                          onChange={(_event, value) =>
                            setValue("descriptions", value)
                          }
                          value={getValue("descriptions")}
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
                          fieldId="logLevel-field"
                        >
                          <FormSelect
                            value={logLevel}
                            onChange={onChange}
                            aria-label="FormSelect Input"
                            ouiaId="BasicFormSelect"
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
                  // className="custom-card-body"
                />
              )}
            </PageSection>
            <PageSection className="pf-m-sticky-bottom" isFilled={false}>
              <ActionGroup className="create_pipeline-footer">
                <Button
                  variant="primary"
                  // onClick={handleCreateSource}
                  isLoading={isLoading}
                  isDisabled={isLoading}
                  type={ButtonType.submit}
                  onClick={(e) => {
                    e.preventDefault();

                    if (!values["pipeline-name"]) {
                      setError("pipeline-name", "Pipeline name is required.");
                    } else {
                      handleEditPipeline(values);
                    }
                  }}
                >
                  Save changes
                </Button>
                <Button
                  variant="link"
                  onClick={() => navigateTo("/pipeline/pipeline_designer")}
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

export { EditPipeline };
