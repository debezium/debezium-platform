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
  Form,
  FormGroup,
  Icon,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  SearchInput,
  Spinner,
  TextInput,
  ToggleGroup,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
} from "@patternfly/react-core";
import { PlusIcon, RhUiErrorFillIcon, SearchIcon } from "@patternfly/react-icons";
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
import { useTranslation } from "react-i18next";

export type DeleteInstance = {
  id: number;
  name: string;
};

export type ActionData = {
  id: number;
  name: string;
  status?: PipelineStatus
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

  const [searchQuery, setSearchQuery] = useState<string>("");

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

  // Compute filtered results based on search query
  const searchResult = React.useMemo(() => {
    if (searchQuery.length === 0) {
      return pipelinesList;
    }
    return _.filter(pipelinesList, (o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, pipelinesList]);

  const onClear = () => {
    onSearch?.("");
  };

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
                          <ToolbarItem>
                            <SearchInput
                              aria-label="Items example search input"
                              placeholder={t("findByName")}
                              value={searchQuery}
                              onChange={(_event, value) => onSearch(value)}
                              onClear={onClear}
                            />
                          </ToolbarItem>
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
                                  : `${searchResult.length} ${t("items")}`}
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
                          {(searchQuery.length > 0
                            ? searchResult
                            : pipelinesList
                          ).length > 0 ? (
                            (searchQuery.length > 0
                              ? searchResult
                              : pipelinesList
                            ).map((instance: Pipeline) => (
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

                                <Td style={{ lineHeight: "35px" }}>
                                  {instance.status === "FAILED" &&
                                    
                                      <p style={{ cursor: "pointer" }}>
                                        <Icon status="danger" isInline>
                                          <RhUiErrorFillIcon />
                                        </Icon>{" "}
                                        <Tooltip aria="none" aria-live="polite" exitDelay={100} flipBehavior="flip" content={t("pipeline:pipelineFailureMsg")}>
                                        <Button variant="link" isInline onClick={onPipelineClick(instance.id)} >
                                          {t("failed")}
                                        </Button>
                                        </Tooltip>

                                      </p>
                                    }
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
                <p>
                  Enter <i>"{`${deleteInstance.name}`}"</i> to delete pipeline
                </p>
              }
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
                variant="primary"
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
