/* eslint-disable @typescript-eslint/no-unused-vars */
import * as React from "react";
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Button,
  ButtonType,
  Card,
  CardBody,
  CardFooter,
  Content,
  DataList,
  DataListAction,
  DataListCell,
  DataListItemCells,
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  DrawerPanelDescription,
  Flex,
  FlexItem,
  Form,
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
  Tooltip,
} from "@patternfly/react-core";
import { useAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import "./PipelineDesigner.css";
import {
  Destination,
  editPut,
  fetchDataTypeTwo,
  Pipeline,
  PipelineDestination,
  PipelineSource,
  Source,
  Transform,
} from "../../apis/apis";
import {
  DragDropSort,
  DragDropSortDragEndEvent,
  DraggableObject,
} from "@patternfly/react-drag-drop";
import {
  ArrowRightIcon,
  ExclamationCircleIcon,
  PlusIcon,
  TrashIcon,
} from "@patternfly/react-icons";
import { ReactFlowProvider } from "reactflow";
import { useEffect, useState } from "react";
import { API_URL } from "@utils/constants";
import PipelineEditFlow from "@components/pipelineDesigner/PipelineEditFlow";
import ConnectorImage from "@components/ComponentImage";
import { useNotification } from "@appContext/AppNotificationContext";
import ApiError from "@components/ApiError";
import TrademarkMessage from "@components/TrademarkMessage";
import { useTranslation } from "react-i18next";
import { Properties } from "src/hooks/useConnectorForm";
import { selectedTransformAtom } from "./PipelineDesigner";

const getItems = (
  selectedTransform: Transform[],
  onTempDelete: (id: string) => void
): DraggableObject[] =>
  selectedTransform.map((transform, idx) => ({
    id: `${idx}-${transform.id}=${transform.name}`,
    content: (
      <>
        <DataListItemCells
          dataListCells={[
            <DataListCell key={`item-${idx}`} style={{ alignSelf: "center" }}>
              <Content component="p">{transform.name}</Content>
            </DataListCell>,
          ]}
        />
        <DataListAction
          aria-labelledby="single-action-item1 single-action-action1"
          id="single-action-action1"
          aria-label="Actions"
        >
          <Tooltip content="Delete">
            <Button
              onClick={() =>
                onTempDelete(`${idx}-${transform.id}=${transform.name}`)
              }
              variant="plain"
              key="delete-action"
              icon={<TrashIcon />}
            />
          </Tooltip>
        </DataListAction>
      </>
    ),
  }));

type PipelineDesignerEditProps = {
  pipelineSource: PipelineSource;
  pipelineDestination: PipelineDestination;
  transforms: Transform[];
  name: string;
  desc: string;
  definedLogLevel: string;
  definedLogLevels: Record<string, string>;
  pipelineId: number;
};

const PipelineDesignerEdit: React.FunctionComponent<
  PipelineDesignerEditProps
> = ({
  pipelineSource,
  pipelineDestination,
  transforms,
  name,
  desc,
  definedLogLevel,
  definedLogLevels = {},
  pipelineId,
}) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [items, setItems] = React.useState<DraggableObject[]>([]);
    const [editStep, setEditStep] = useState(0);

    const { addNotification } = useNotification();

    const [selectedTransform, setSelectedTransform] = useAtom(
      selectedTransformAtom
    );

    // const [rearrangeTrigger, setRearrangeTrigger] = React.useState(false);

    const [isLoading, setIsLoading] = useState(false);

    const [isExpanded, setIsExpanded] = React.useState(false);
    const drawerRef = React.useRef<HTMLDivElement>(null);

    const [source, setSource] = useState<Source>();
    const [destination, setDestination] = useState<Destination>();
    const [isSourceFetchLoading, setIsSourceFetchLoading] =
      useState<boolean>(true);
    const [isDestinationFetchLoading, setIsDestinationFetchLoading] =
      useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);


    const [pkgLevelLog, setPkgLevelLog] = useState<Map<string, Properties>>(
      new Map([["key0", { key: "", value: "" }]])
    );
    const [keyCount, setKeyCount] = useState<number>(1);

    useEffect(() => {
      if (definedLogLevels) {
        const updatedPkgLevelLog = new Map<string, Properties>();
        let count = 0;

        Object.entries(definedLogLevels).forEach(([key, value]) => {
          updatedPkgLevelLog.set(`key${count}`, { key, value });
          count++;
        });

        setPkgLevelLog(updatedPkgLevelLog);
        setKeyCount(count);
      }
    }, [definedLogLevels]);

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

    useEffect(() => {
      const fetchSource = async () => {
        setIsSourceFetchLoading(true);
        const response = await fetchDataTypeTwo<Source>(
          `${API_URL}/api/sources/${pipelineSource!.id}`
        );

        if (response.error) {
          setError(response.error);
        } else {
          setSource(response.data as Source);
        }
        setIsSourceFetchLoading(false);
      };

      if (pipelineSource?.id) {
        fetchSource();
      }
    }, [pipelineSource]);

    useEffect(() => {
      const fetchDestination = async () => {
        setIsDestinationFetchLoading(true);
        const response = await fetchDataTypeTwo<Destination>(
          `${API_URL}/api/destinations/${pipelineDestination!.id}`
        );

        if (response.error) {
          setError(response.error);
        } else {
          setDestination(response.data as Destination);
        }
        setIsDestinationFetchLoading(false);
      };

      if (pipelineDestination?.id) {
        fetchDestination();
      }
    }, [pipelineDestination]);

    useEffect(() => {
      setSelectedTransform(transforms);
    }, [setSelectedTransform, transforms]);

    // Handle temporary deletion of items
    const handleTempDelete = React.useCallback((id: string) => {
      setItems((prevItems) => prevItems.filter((item) => item.id !== id));
    }, []);

    // Initialize items when selectedTransform changes
    useEffect(() => {
      if (selectedTransform.length > 0) {
        setItems(getItems(selectedTransform, handleTempDelete));
      }
    }, [selectedTransform, handleTempDelete]);

    const onExpand = () => {
      drawerRef.current && drawerRef.current.focus();
    };

    const onToggleDrawer = () => {
      if (isExpanded) {
        // Reset temporary state when closing drawer without applying
        setItems(getItems(selectedTransform, handleTempDelete));
      }
      setIsExpanded(!isExpanded);
    };

    const onCloseClick = () => {
      // Reset temporary state when closing drawer without applying
      setItems(getItems(selectedTransform, handleTempDelete));
      setIsExpanded(false);
    };

    const updateSelectedTransform = React.useCallback(
      (transform: Transform[]) => {
        setSelectedTransform((prevTransforms) => [...prevTransforms, ...transform]);
      },
      [setSelectedTransform]
    );

    const navigateTo = (url: string) => {
      navigate(url);
    };

    // Function to handle rearrange and delete apply button click
    const handleRearrangeClick = () => {
      const updatedTransforms = items.map((item) => {
        const [indexId, name] = String(item.id).split("=");
        const [_, id] = indexId.split("-");
        return { id: Number(id), name };
      });

      setSelectedTransform(...[updatedTransforms]);
      // setRearrangeTrigger((prev) => !prev);
      onToggleDrawer();
    };

    const reArrangeTransform = (
      _event: DragDropSortDragEndEvent,
      newItems: DraggableObject[],
      _oldIndex?: number | undefined,
      _newIndex?: number | undefined
    ) => {
      setItems(newItems);
    };

    const editPipeline = async (values: Record<string, string>) => {
      setIsLoading(true);
      const payload = {
        description: values["descriptions"],
        logLevel: logLevel,
        name: values["pipeline-name"],
        transforms: selectedTransform,
      };

      const response = await editPut(
        `${API_URL}/api/pipelines/${pipelineId}`,
        payload
      );
      setIsLoading(false);

      if (response.error) {
        addNotification(
          "danger",
          t('statusMessage:edit.title'),
          t('statusMessage:edit.failedDescription', { val: `${(response.data as Pipeline).name}: ${response.error}` }),
        );
      } else {
        addNotification(
          "success",
          t('statusMessage:edit.successTitle'),
          t('statusMessage:edit.successTitle', { val: `${t('pipeline')} ${(response.data as Pipeline).name}` }),
        );
        navigateTo("/pipeline");
      }
    };

    const handleEditPipeline = async (values: Record<string, string>) => {
      await editPipeline(values);
    };

    const [logLevel, setLogLevel] = useState("");


    useEffect(() => {
      setLogLevel(definedLogLevel);
    }, [definedLogLevel]);


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

    const panelContent = (
      <DrawerPanelContent>
        <DrawerHead>
          <Content component="h4" tabIndex={isExpanded ? 0 : -1}>
            {t('pipeline:transformDrawer.title')}
          </Content>
          <DrawerActions>
            <DrawerCloseButton onClick={onCloseClick} />
          </DrawerActions>
        </DrawerHead>
        <DrawerPanelDescription>
          {t('pipeline:transformDrawer.description')}
        </DrawerPanelDescription>
        <DrawerPanelBody style={{ display: "inline-block" }}>
          {selectedTransform.length === 0 ? (
            <>{t('pipeline:transformDrawer.emptyState')}</>
          ) : (
            <>
              <DragDropSort
                items={items}
                onDrop={reArrangeTransform}
                variant="DataList"
                overlayProps={{ isCompact: true }}
              >
                <DataList aria-label="draggable data list example" isCompact />
              </DragDropSort>
              <Button
                variant="primary"
                style={{ marginTop: "15px" }}
                onClick={handleRearrangeClick}
              >
                {t('apply')}
              </Button>
            </>
          )}
        </DrawerPanelBody>
      </DrawerPanelContent>
    );

    if (error) {
      return (
        <PageSection isWidthLimited>
          <ApiError
            errorType="large"
            errorMsg={error}
            secondaryActions={
              <>
                <Button variant="link" onClick={() => navigateTo("/pipeline")}>
                  {t('goToHome')}
                </Button>
              </>
            }
          />
        </PageSection>
      );
    }

    return (
      <>
        {editStep === 0 ? (
          <Drawer isExpanded={isExpanded} onExpand={onExpand}>
            <DrawerContent panelContent={panelContent}>
              <DrawerContentBody>
                <PageSection isFilled padding={{ default: "noPadding" }}>
                  <TrademarkMessage />
                  <Card isFullHeight>
                    <CardBody isFilled style={{ height: "100%", width: "100%", minHeight: "450px" }}>
                      <ReactFlowProvider>
                        <PipelineEditFlow
                          sourceName={source?.name || ""}
                          sourceType={source?.type || ""}
                          selectedTransform={selectedTransform}
                          destinationName={destination?.name || ""}
                          destinationType={destination?.type || ""}
                          updateSelectedTransform={updateSelectedTransform}
                          openTransformDrawer={onToggleDrawer}
                        />
                      </ReactFlowProvider>
                    </CardBody>

                    <CardFooter
                      className="custom-card-footer"
                    >
                      <ActionList>
                        <ActionListGroup>
                          <ActionListItem>
                            <Button
                              variant="primary"
                              onClick={() => {
                                setEditStep((prevStep) => prevStep + 1);
                              }}
                            >
                              {t('saveAndNext')}
                            </Button>
                          </ActionListItem>

                        </ActionListGroup>
                      </ActionList>

                    </CardFooter>
                  </Card>
                </PageSection>
              </DrawerContentBody>
            </DrawerContent>
          </Drawer>
        ) : (
          <>
            <FormContextProvider
              initialValues={{
                "pipeline-name": name || "",
                descriptions: desc || "",
              }}
            >
              {({ setValue, getValue, setError, values, errors }) => (
                <>
                  <PageSection
                    isWidthLimited
                    isCenterAligned
                    isFilled
                    style={{
                      paddingTop: "0",
                      paddingLeft: "0",
                      paddingRight: "0",
                      height: "100%",
                    }}
                    className="pipeline-page-section"
                  >
                    <Card className="pipeline-card-body">
                      <CardBody isFilled>
                        <Form isWidthLimited>
                          <FormGroup
                            label={t('pipeline:form.flowField')}
                            isRequired
                            fieldId="pipeline-flow-field"
                          >
                            <Flex alignItems={{ default: "alignItemsCenter" }}>
                              {isSourceFetchLoading ? (
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
                                      designerComponent={true}
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
                              {isDestinationFetchLoading ? (
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
                                          onChange={(_e, value) =>
                                            handlePropertyChange(key, "key", value)
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
                                          }}
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
                                    </Grid>
                                  </SplitItem>
                                  <SplitItem>
                                    <Button
                                      variant="plain"
                                      aria-label="Remove"
                                      onClick={() => handleDeleteProperty(key)}
                                    >
                                      <TrashIcon />
                                    </Button>
                                  </SplitItem>
                                </Split>
                              ))}
                            </FormFieldGroup>
                          </FormSection>
                        </Form>
                      </CardBody>
                    </Card>
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

                              if (!values["pipeline-name"]) {
                                setError(
                                  "pipeline-name",
                                  "Pipeline name is required."
                                );
                              } else {
                                handleEditPipeline(values);
                              }
                            }}
                          >
                            {t('pipeline:overview.updatePipeline')}
                          </Button>
                        </ActionListItem>
                        <ActionListItem>
                          <Button
                            variant="link"
                            onClick={() => setEditStep((prevStep) => prevStep - 1)}
                          >
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
        )}
      </>
    );
  };

export { PipelineDesignerEdit };
