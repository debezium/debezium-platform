/* eslint-disable @typescript-eslint/no-unused-vars */
import * as React from "react";
import {
  Bullseye,
  Button,
  Card,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  Label,
  LabelColor,
  MenuToggle,
  MenuToggleElement,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  TextInput,
  ToggleGroup,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
} from "@patternfly/react-core";
import { FilterIcon, PlusIcon, SearchIcon } from "@patternfly/react-icons";
import { useNavigate } from "react-router-dom";
import {
  Connection,
  Destination,
  fetchDataTypeTwo,
  Pipeline,
  fetchData,
  fetchFile,
  Source,
  TransformData,
  PipelineStatus,
  editPut,
} from "../../apis/apis";
import {
  generatePropertiesContent,
  triggerPropertiesDownload,
} from "../../utils/generateServerConfig";
import { buildPipelineRestartPayload } from "@utils/pipelineUtils";
import {
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  ActionsColumn,
  IAction,
} from "@patternfly/react-table";
import _, { debounce } from "lodash";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import { API_URL } from "../../utils/constants";
import { ReactNode, useState } from "react";
import SourceField from "../../components/SourceField";
import DestinationField from "../../components/DestinationField";
import ApiError from "../../components/ApiError";
import { useNotification } from "../../appLayout/AppNotificationContext";
import { PipelineEmpty } from "./PipelineEmpty";
import { useDeleteData } from "src/apis";
import PageHeader from "@components/PageHeader";
import "./Pipelines.css";
import { Trans, useTranslation } from "react-i18next";

export type DeleteInstance = {
  id: number;
  name: string;
};

export type ActionData = {
  id: number;
  name: string;
  status?: PipelineStatus
};

type StatusConfig = {
  color: LabelColor;
  labelKey: string;
  tooltipKey: string;
};

const STATUS_CONFIG: Record<PipelineStatus, StatusConfig> = {
  FAILED: {
    color: LabelColor.red,
    labelKey: "statusMessage:pipelineStatus.failed",
    tooltipKey: "pipeline:pipelineFailureMsg",
  },
  DEPLOYING: {
    color: LabelColor.yellow,
    labelKey: "statusMessage:pipelineStatus.deploying",
    tooltipKey: "pipeline:pipelineDeployingMsg",
  },
  RUNNING: {
    color: LabelColor.green,
    labelKey: "statusMessage:pipelineStatus.running",
    tooltipKey: "pipeline:pipelineRunningMsg",
  },
};

type PipelineStatusLabelProps = {
  status: PipelineStatus;
  onLabelClick: () => void;
};

const PipelineStatusLabel: React.FC<PipelineStatusLabelProps> = ({ status, onLabelClick }) => {
  const { t } = useTranslation();
  const { color, labelKey, tooltipKey } = STATUS_CONFIG[status];
  return (
    <Flex alignItems={{ default: "alignItemsCenter" }}>
      <FlexItem>
        <Tooltip
          aria="none"
          aria-live="polite"
          exitDelay={100}
          flipBehavior="flip"
          content={t(tooltipKey)}
        >
          <Label color={color} onClick={status === "FAILED" ? onLabelClick : undefined}>
            {t(labelKey)}
          </Label>
        </Tooltip>
      </FlexItem>
    </Flex>
  );
};

const Pipelines: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navigateTo = (url: string) => {
    navigate(url);
  };

  const { addNotification } = useNotification();

  const [isLogLoading, setIsLogLoading] = useState<boolean>(false);
  const [isExportLoading, setIsExportLoading] = useState<boolean>(false);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [deleteInstance, setDeleteInstance] = useState<DeleteInstance>({
    id: 0,
    name: "",
  });
  const [deleteInstanceName, setDeleteInstanceName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  type FilterField = "name" | "source" | "destination";

  const FILTER_OPTIONS: { value: FilterField; label: string }[] = [
    { value: "name", label: "Name" },
    { value: "source", label: "Source" },
    { value: "destination", label: "Destination" },
  ];

  const getFilterValue = (pipeline: Pipeline, field: FilterField): string => {
    if (field === "source") return pipeline.source.name;
    if (field === "destination") return pipeline.destination.name;
    return pipeline.name;
  };

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterField, setFilterField] = useState<FilterField>("name");
  const [isFilterSelectOpen, setIsFilterSelectOpen] = useState<boolean>(false);

  const {
    data: pipelinesList = [],
    error: pipelinesError,
    isLoading: pipelinesLoading,
    refetch: refetchPipelines,
  } = useResourceQuery<Pipeline[], Error>(
    "pipelines",
    () => fetchData<Pipeline[]>(`${API_URL}/api/pipelines`)
  );

  const [restartingPipelineId, setRestartingPipelineId] = useState<number | null>(
    null
  );

  // Compute filtered results based on search query and filter field
  const searchResult = React.useMemo(() => {
    if (searchQuery.length === 0) {
      return pipelinesList;
    }
    return _.filter(pipelinesList, (o) =>
      getFilterValue(o, filterField).toLowerCase().includes(searchQuery.toLowerCase())
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterField, pipelinesList]);

  const onClear = () => {
    onSearch?.("");
  };

  const onFilterFieldSelect = React.useCallback(
    (_event: React.MouseEvent<Element, MouseEvent> | undefined, value: string | number | undefined) => {
      setFilterField((value as FilterField) ?? "name");
      setIsFilterSelectOpen(false);
      onClear();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const logAction = (): ReactNode => {
    return isLogLoading ? (
      <>{t("downloading")}</>
    ) : (
      <>{t("pipeline:userActions.download")}</>
    );
  };

  const downloadLogFile = async (pipelineId: string, pipelineName: string) => {
    setIsLogLoading(true);
    // Fetch the file as a Blob
    const response = await fetchFile(
      `${API_URL}/api/pipelines/${pipelineId}/logs`
    );
    if ("error" in response) {
      addNotification(
        "danger",
        `Download Failed log for ${pipelineName}`,
        `Failed to download logs: ${response.error}`
      );
    } else {
      // Create a URL for the Blob
      const url = window.URL.createObjectURL(response);
      // Create a link element and click it to trigger the download
      const a = document.createElement("a");
      a.href = url;
      a.download = "pipeline.log";
      document.body.appendChild(a);
      a.click();
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }

    setIsLogLoading(false);
  };

  const exportServerConfig = async (pipeline: Pipeline) => {
    setIsExportLoading(true);
    try {
      const [sourceRes, destRes] = await Promise.all([
        fetchDataTypeTwo<Source>(`${API_URL}/api/sources/${pipeline.source.id}`),
        fetchDataTypeTwo<Destination>(
          `${API_URL}/api/destinations/${pipeline.destination.id}`
        ),
      ]);

      if (sourceRes.error || destRes.error) {
        addNotification(
          "danger",
          `Export failed for ${pipeline.name}`,
          `Failed to fetch pipeline resources: ${sourceRes.error ?? destRes.error}`
        );
        return;
      }

      const source = sourceRes.data as Source;
      const dest = destRes.data as Destination;

      const transformFetches = pipeline.transforms.map((t) =>
        fetchDataTypeTwo<TransformData>(`${API_URL}/api/transforms/${t.id}`)
      );
      const connectionFetches: Promise<{ data?: Connection | null; error?: string }>[] = [];
      if (source.connection?.id) {
        connectionFetches.push(
          fetchDataTypeTwo<Connection>(
            `${API_URL}/api/connections/${source.connection.id}`
          )
        );
      } else {
        connectionFetches.push(Promise.resolve({ data: null }));
      }
      if (dest.connection?.id) {
        connectionFetches.push(
          fetchDataTypeTwo<Connection>(
            `${API_URL}/api/connections/${dest.connection.id}`
          )
        );
      } else {
        connectionFetches.push(Promise.resolve({ data: null }));
      }

      const [transformResults, [sourceConnRes, destConnRes]] =
        await Promise.all([
          Promise.all(transformFetches),
          Promise.all(connectionFetches),
        ]);

      const resolvedTransforms = transformResults
        .filter((r) => !r.error && r.data)
        .map((r) => r.data as TransformData);

      const sourceConn =
        !sourceConnRes.error && sourceConnRes.data
          ? (sourceConnRes.data as Connection)
          : null;
      const destConn =
        !destConnRes.error && destConnRes.data
          ? (destConnRes.data as Connection)
          : null;

      const content = generatePropertiesContent(
        pipeline.name,
        source,
        sourceConn,
        dest,
        destConn,
        resolvedTransforms
      );
      triggerPropertiesDownload(`${pipeline.name}.properties`, content);
    } catch {
      addNotification(
        "danger",
        `Export failed for ${pipeline.name}`,
        t("pipeline:userActions.exportServerConfigError")
      );
    } finally {
      setIsExportLoading(false);
    }
  };

  const { mutate: deleteData } = useDeleteData({
    onSuccess: () => {
      modalToggle(false);
      setIsLoading(false);
      addNotification(
        "success",
        `Delete successful`,
        `Pipeline deleted successfully`
      );
    },
    onError: (error) => {
      modalToggle(false);
      setIsLoading(false);
      addNotification(
        "danger",
        `Delete failed`,
        `Failed to delete pipeline: ${error}`
      );
    },
  });

  const handleDelete = async (id: number) => {
    setIsLoading(true);
    const url = `${API_URL}/api/pipelines/${id}`;
    deleteData(url);
  };


  const debouncedSetSearchQuery = React.useMemo(
    () => debounce((value: string) => {
      setSearchQuery(value);
    }, 500),
    []
  );

  React.useEffect(() => {
    return () => {
      debouncedSetSearchQuery.cancel();
    };
  }, [debouncedSetSearchQuery]);

  const onSearch = React.useCallback(
    (value: string) => {
      debouncedSetSearchQuery(value);
    },
    [debouncedSetSearchQuery]
  );

  const onPipelineClick = (id: number) => () => {
    navigateTo(`/pipeline/${id}/overview`);
  };

  const modalToggle = (toggleValue: boolean) => {
    setDeleteInstanceName("");
    setIsOpen(toggleValue);
  };

  const onOverviewHandler = (id: number, _name: string) => {
    navigateTo(`/pipeline/${id}/overview`);
  };

  const onLogViewHandler = (id: number, _name: string) => {
    navigateTo(`/pipeline/${id}/logs`);
  };

  const onActionHandler = (id: number, _name: string) => {
    navigateTo(`/pipeline/${id}/action`);
  };

  const onMonitoringHandler = (id: number, _name: string) => {
    navigateTo(`/pipeline/${id}/monitoring`);
  };

  const onDeleteHandler = (id: number, name: string) => {
    setIsOpen(true);
    setDeleteInstance({ id: id, name: name });
  };

  const onEditHandler = (id: number, _name: string) => {
    navigateTo(`/pipeline/${id}/edit`);
  };

  const onLogDownloadHandler = (id: number, name: string) => {
    downloadLogFile("" + id, name);
  };

  const onExportServerConfigHandler = (pipeline: Pipeline) => {
    void exportServerConfig(pipeline);
  };

  const onRestartHandler = async (pipeline: Pipeline) => {
    setRestartingPipelineId(pipeline.id);
    const response = await editPut(
      `${API_URL}/api/pipelines/${pipeline.id}`,
      buildPipelineRestartPayload(pipeline)
    );
    setRestartingPipelineId(null);

    if (response.error) {
      addNotification(
        "danger",
        t("statusMessage:restart.failedTitle"),
        t("statusMessage:restart.failedDescription", {
          val: `${t("pipeline")} ${pipeline.name}: ${response.error}`,
        })
      );
      return;
    }

    addNotification(
      "success",
      t("statusMessage:restart.successTitle"),
      t("statusMessage:restart.successDescription", {
        val: `${t("pipeline")} ${pipeline.name}`,
      })
    );
    void refetchPipelines();
  };

  const rowActions = (actionData: ActionData): IAction[] => [
    {
      title: t("pipeline:userActions.overview"),
      onClick: () => onOverviewHandler(actionData.id, actionData.name),
    },
    {
      title: t("pipeline:userActions.actions"),
      onClick: () => onActionHandler(actionData.id, actionData.name),
      isDisabled: actionData.status === "FAILED"
    },
    {
      title: t("pipeline:userActions.monitoring"),
      onClick: () => onMonitoringHandler(actionData.id, actionData.name),
      isDisabled: actionData.status === "FAILED"
    },
    {
      title: t("pipeline:userActions.logs"),
      onClick: () => onLogViewHandler(actionData.id, actionData.name),
    },
    {
      title: logAction(),
      onClick: () => onLogDownloadHandler(actionData.id, actionData.name),
    },
    {
      title: isExportLoading
        ? t("downloading")
        : t("pipeline:userActions.exportServerConfig"),
      onClick: () => {
        const pipeline = pipelinesList.find((p) => p.id === actionData.id);
        if (pipeline) onExportServerConfigHandler(pipeline);
      },
    },

    { isSeparator: true },
    {
      title: t("pipeline:userActions.edit"),
      onClick: () => onEditHandler(actionData.id, actionData.name),
    },
    {
      title: t("pipeline:userActions.delete"),
      onClick: () => onDeleteHandler(actionData.id, actionData.name),
    },
  ];

  return (
    <>
      {pipelinesError ? (
        <PageSection isWidthLimited>
          <ApiError
            errorType="large"
            errorMsg={pipelinesError.message}
            secondaryActions={
              <>
                <Button variant="link" onClick={() => navigateTo("/source")}>
                  {t("goto", { val: t("source") })}
                </Button>
                <Button
                  variant="link"
                  onClick={() => navigateTo("/destination")}
                >
                  {t("goto", { val: t("destination") })}
                </Button>
              </>
            }
          />
        </PageSection>
      ) : (
        <>
          {pipelinesLoading ? (
            <EmptyState
              titleText={t("loading")}
              headingLevel="h4"
              icon={Spinner}
            />
          ) : (
            <>
              {pipelinesList.length > 0 ? (
                <>
                  <PageHeader
                    title={t("pipeline")}
                    description={t("pipeline:pipelinePage.description")}
                  />
                  <PageSection>
                    <Card className="pipeline-card">
                      <Toolbar
                        id="toolbar-sticky"
                        className="custom-toolbar"
                        isSticky
                      >
                        <ToolbarContent>
                          <ToolbarGroup variant="filter-group">
                            <ToolbarItem>
                              <Select
                                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                                  <MenuToggle
                                    ref={toggleRef}
                                    icon={<FilterIcon />}
                                    onClick={() => setIsFilterSelectOpen((prev) => !prev)}
                                    isExpanded={isFilterSelectOpen}
                                    style={{ width: "140px" } as React.CSSProperties}
                                  >
                                    {FILTER_OPTIONS.find((o) => o.value === filterField)?.label ?? "Name"}
                                  </MenuToggle>
                                )}
                                onSelect={onFilterFieldSelect}
                                onOpenChange={setIsFilterSelectOpen}
                                selected={filterField}
                                isOpen={isFilterSelectOpen}
                              >
                                <SelectList>
                                  {FILTER_OPTIONS.map((option) => (
                                    <SelectOption key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectOption>
                                  ))}
                                </SelectList>
                              </Select>
                            </ToolbarItem>
                            <ToolbarItem>
                              <SearchInput
                                aria-label={`Search pipelines by ${filterField}`}
                                placeholder={`Find by ${filterField}...`}
                                value={searchQuery}
                                onChange={(_event, value) => onSearch(value)}
                                onClear={onClear}
                              />
                            </ToolbarItem>
                          </ToolbarGroup>
                          <ToolbarItem>
                            <ToggleGroup aria-label="Icon variant toggle group">
                              <Button
                                variant="primary"
                                icon={<PlusIcon />}
                                onClick={() =>
                                  navigateTo("/pipeline/pipeline_designer")
                                }
                                data-tour="add-pipeline"
                              >
                                {t("addButton", {
                                  val: t("pipeline:pipeline"),
                                })}
                              </Button>
                            </ToggleGroup>
                          </ToolbarItem>
                          <ToolbarGroup align={{ default: "alignEnd" }}>
                            <ToolbarItem>
                              <Content component={ContentVariants.small}>
                                {searchQuery.length > 0
                                  ? `${searchResult.length} ${t("of")} ${pipelinesList.length} ${t("items")}`
                                  : `${pipelinesList.length} ${t("items")}`}
                              </Content>
                            </ToolbarItem>
                          </ToolbarGroup>
                        </ToolbarContent>
                      </Toolbar>
                      <Table aria-label="Pipeline Table">
                        <Thead>
                          <Tr>
                            <Th key={0}>{t("name")}</Th>
                            <Th key={1}>{t("source")}</Th>
                            <Th key={2}>{t("destination")}</Th>
                            <Th key={3}>{t("status")}</Th>
                            <Th key={4} screenReaderText="restart" />
                            <Th key={5} screenReaderText={t("actions")} />
                          </Tr>
                        </Thead>

                        <Tbody>
                          {searchResult.length > 0 ? (
                            searchResult.map((instance: Pipeline) => (
                              <Tr key={instance.id}>
                                <Td dataLabel={t("name")} style={{ lineHeight: "35px" }}>
                                  <Tooltip content={
                                    <div>
                                      View pipeline details for <b>{instance.name}</b><br />
                                    </div>
                                  }>
                                    <Button
                                      variant="link"
                                      isInline
                                      onClick={onPipelineClick(instance.id)}
                                    >
                                      {instance.name}
                                    </Button>
                                  </Tooltip>
                                </Td>
                                <SourceField pipelineSource={instance.source} />
                                <DestinationField
                                  pipelineDestination={instance.destination}
                                />

                                <Td dataLabel={t("status")} style={{ alignContent: "center", verticalAlign: "middle" }}>
                                  {instance.status && (
                                    <PipelineStatusLabel
                                      status={instance.status}
                                      onLabelClick={onPipelineClick(instance.id)}
                                    />
                                  )}
                                </Td>
                                <Td modifier="fitContent" hasAction style={{ alignContent: "center" }}>
                                  {instance.status === "FAILED" && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      isLoading={restartingPipelineId === instance.id}
                                      isDisabled={restartingPipelineId === instance.id}
                                      onClick={() => void onRestartHandler(instance)}
                                    >
                                      {t("pipeline:userActions.restart")}
                                    </Button>
                                  )}
                                </Td>
                                <Td dataLabel={t("actions")} isActionCell style={{ alignContent: "center" }}>
                                  <ActionsColumn
                                    items={rowActions({
                                      id: instance.id,
                                      name: instance.name,
                                      status: instance.status
                                    })}
                                  />
                                </Td>
                              </Tr>
                            ))
                          ) : (
                            <Tr>
                              <Td colSpan={8}>
                                <Bullseye>
                                  <EmptyState
                                    headingLevel="h2"
                                    titleText={t("search.title", {
                                      val: "pipeline",
                                    })}
                                    icon={SearchIcon}
                                    variant={EmptyStateVariant.sm}
                                  >
                                    <EmptyStateBody>
                                      {t("search.description")}
                                    </EmptyStateBody>
                                    <EmptyStateFooter>
                                      <EmptyStateActions>
                                        <Button
                                          variant="link"
                                          onClick={onClear}
                                        >
                                          {t("search.button")}
                                        </Button>
                                      </EmptyStateActions>
                                    </EmptyStateFooter>
                                  </EmptyState>
                                </Bullseye>
                              </Td>
                            </Tr>
                          )}
                        </Tbody>
                      </Table>
                    </Card>
                  </PageSection>
                </>
              ) : (
                <div>
                  <PipelineEmpty />
                </div>
              )}
            </>
          )}

          <Modal
            variant="medium"
            title={t("pipeline:deletePipeline")}
            isOpen={isOpen}
            onClose={() => modalToggle(false)}
            aria-labelledby={`delete pipeline model`}
            aria-describedby="modal-box-body-variant"
          >
            <ModalHeader
              title={


                <Trans
                  i18nKey="deleteModel.heading"
                  values={{ val: `"${deleteInstance.name}"`, val2: "pipeline" }}
                  components={[<span />, <i />]}
                />
              }
              description={t("deleteModel.description", {val: "pipeline"})}
              titleIconVariant="warning"
              labelId="delete-modal-title"
            />
            <ModalBody id="modal-box-body-variant">
              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (deleteInstanceName === deleteInstance.name) {
                    handleDelete(deleteInstance.id);
                  }
                }}
              >
                <FormGroup isRequired fieldId={`pipeline-delete-name`}>
                  <TextInput
                    id="delete-name"
                    aria-label="delete name"
                    onChange={(_e, value) => setDeleteInstanceName(value)}
                    value={deleteInstanceName}
                  />
                </FormGroup>
              </Form>
            </ModalBody>
            <ModalFooter>
              <Button
                key="confirm"
                variant="danger"
                onClick={() => handleDelete(deleteInstance.id)}
                isDisabled={deleteInstanceName !== deleteInstance.name}
                isLoading={isLoading}
              >
                {t("confirm")}
              </Button>
              <Button
                key="cancel"
                variant="link"
                onClick={() => modalToggle(false)}
              >
                {t("cancel")}
              </Button>
            </ModalFooter>
          </Modal>
        </>
      )}
    </>
  );
};

export { Pipelines };
