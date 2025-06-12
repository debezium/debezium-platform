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
  Label,
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
import {
  DataProcessorIcon,
  PlusIcon,
  SearchIcon,
  TagIcon,
} from "@patternfly/react-icons";
import EmptyStatus from "../../components/EmptyStatus";
import "./Transforms.css";
import { useNavigate } from "react-router-dom";
import { fetchData, Pipeline, TransformData, useDeleteData } from "src/apis";
import { API_URL } from "@utils/constants";
import { useQuery } from "react-query";
import _, { debounce } from "lodash";
import { useCallback, useState } from "react";
import ApiError from "@components/ApiError";
import PageHeader from "@components/PageHeader";
import {
  ActionsColumn,
  IAction,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@patternfly/react-table";
import { ActionData, DeleteInstance } from "@pipelinePage/index";
import { useNotification } from "@appContext/index";
import { useTranslation } from "react-i18next";
import { getActivePipelineCount } from "@utils/pipelineUtils";

export interface ITransformsProps {
  sampleProp?: string;
}

const Transforms: React.FunctionComponent<ITransformsProps> = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const navigateTo = (url: string) => {
    navigate(url);
  };

  const { addNotification } = useNotification();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteInstance, setDeleteInstance] = useState<DeleteInstance>({
    id: 0,
    name: "",
  });
  const [deleteInstanceName, setDeleteInstanceName] = useState<string>("");

  const [searchResult, setSearchResult] = React.useState<TransformData[]>([]);
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const onClear = () => {
    onSearch?.("");
  };

  const {
    data: pipelineList = [],
    error: _pipelineError,
    isLoading: _isPipelineLoading,
  } = useQuery<Pipeline[], Error>(
    "pipelines",
    () => fetchData<Pipeline[]>(`${API_URL}/api/pipelines`),
    {
      refetchInterval: 7000,
    }
  );

  const {
    data: transformsList = [],
    error,
    isLoading: isTransformsLoading,
  } = useQuery<TransformData[], Error>(
    "transforms",
    () => fetchData<TransformData[]>(`${API_URL}/api/transforms`),
    {
      refetchInterval: 7000,
      onSuccess: (data) => {
        if (searchQuery.length > 0) {
          const filteredSource = _.filter(data, function (o) {
            return o.name.toLowerCase().includes(searchQuery.toLowerCase());
          });
          setSearchResult(filteredSource);
        } else {
          setSearchResult(data);
        }
      },
    }
  );

  const { mutate: deleteData } = useDeleteData({
    onSuccess: () => {
      modalToggle(false);
      setIsLoading(false);
      addNotification(
        "success",
        `Delete successful`,
        `Transform deleted successfully`
      );
    },
    onError: (error) => {
      modalToggle(false);
      setIsLoading(false);
      addNotification(
        "danger",
        `Delete failed`,
        `Failed to delete transform: ${error}`
      );
    },
  });

  const handleDelete = async (id: number) => {
    setIsLoading(true);
    const url = `${API_URL}/api/transforms/${id}`;
    deleteData(url);
  };

  const modalToggle = (toggleValue: boolean) => {
    setDeleteInstanceName("");
    setIsOpen(toggleValue);
  };

  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      const filteredSource = _.filter(transformsList, function (o) {
        return o.name.toLowerCase().includes(searchQuery.toLowerCase());
      });
      setSearchResult(filteredSource);
    }, 700),
    [transformsList]
  );

  const onSearch = React.useCallback(
    (value: string) => {
      setSearchQuery(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  const onDeleteHandler = (id: number, name: string) => {
    setIsOpen(true);
    setDeleteInstance({ id: id, name: name });
  };

  const rowActions = (actionData: ActionData): IAction[] => [
    {
      title: t("edit"),
      onClick: () => {
        navigateTo(`/transform/edit_transform/${actionData.id}`);
      },
    },
    {
      title: t("delete"),
      onClick: () => onDeleteHandler(actionData.id, actionData.name),
    },
  ];

  return (
    <>
      <>
        {error ? (
          <PageSection isWidthLimited>
            <ApiError
              errorType="large"
              errorMsg={error.message}
              secondaryActions={
                <>
                  <Button variant="link" onClick={() => navigateTo("/source")}>
                    {t("source")}
                  </Button>
                  <Button
                    variant="link"
                    onClick={() => navigateTo("/destination")}
                  >
                    {t("destination")}
                  </Button>
                </>
              }
            />
          </PageSection>
        ) : (
          <>
            {isTransformsLoading ? (
              <EmptyState
                titleText={t("loading")}
                headingLevel="h4"
                icon={Spinner}
              />
            ) : (
              <>
                {transformsList.length > 0 ? (
                  <>
                    <PageHeader
                      title={t("transform")}
                      description={t("transform:page.description")}
                    />
                    <PageSection>
                      <Card className="transform-card">
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
                                    navigateTo("/transform/create_transform")
                                  }
                                >
                                  {t("addButton", {
                                    val: t("transform:transform"),
                                  })}
                                </Button>
                              </ToggleGroup>
                            </ToolbarItem>
                            <ToolbarGroup align={{ default: "alignEnd" }}>
                              <ToolbarItem>
                                <Content component={ContentVariants.small}>
                                  {
                                    (searchQuery.length > 0
                                      ? searchResult
                                      : transformsList
                                    ).length
                                  }{" "}
                                  {t("items")}
                                </Content>
                              </ToolbarItem>
                            </ToolbarGroup>
                          </ToolbarContent>
                        </Toolbar>
                        <Table aria-label="Transform Table">
                          <Thead>
                            <Tr>
                              <Th key={0}>{t("name")}</Th>
                              <Th key={1}>{t("type")}</Th>
                              <Th key={2}>{t("active")}</Th>
                            </Tr>
                          </Thead>

                          <Tbody>
                            {(searchQuery.length > 0
                              ? searchResult
                              : transformsList
                            ).length > 0 ? (
                              (searchQuery.length > 0
                                ? searchResult
                                : transformsList
                              ).map((instance: TransformData) => (
                                <Tr key={instance.id}>
                                  <Td dataLabel={t("name")}>{instance.name}</Td>
                                  <Td dataLabel={t("type")}>{instance.type}</Td>
                                  <Td dataLabel={t("active")}>
                                    <Tooltip
                                      content={
                                        <div>
                                         {t("activePipelineTooltip",{val: "transform"})}
                                        </div>
                                      }
                                    >
                                      <Label icon={<TagIcon />} color="blue">
                                        {getActivePipelineCount(
                                          pipelineList,
                                          instance.id
                                        )}
                                      </Label>
                                    </Tooltip>
                                  </Td>

                                  <Td dataLabel={t("actions")} isActionCell>
                                    <ActionsColumn
                                      items={rowActions({
                                        id: instance.id,
                                        name: instance.name,
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
                                        val: t("transform:transform"),
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
                  <EmptyStatus
                    heading={t("emptyState.title", {
                      val: t("transform:transform"),
                    })}
                    primaryMessage={t("emptyState.description", {
                      val: t("transform:transform"),
                    })}
                    secondaryMessage=""
                    icon={DataProcessorIcon as React.ComponentType<unknown>}
                    primaryAction={
                      <Button
                        variant="primary"
                        icon={<PlusIcon />}
                        onClick={() =>
                          navigateTo("/transform/create_transform")
                        }
                      >
                        {t("addButton", { val: t("transform:transform") })}
                      </Button>
                    }
                    secondaryActions={
                      <>
                        <Button variant="link">{t("source")}</Button>
                        <Button variant="link">{t("destination")}</Button>
                        <Button variant="link">{t("pipeline")}</Button>
                      </>
                    }
                  />
                )}
              </>
            )}

            <Modal
              variant="medium"
              title={t("transform:delete.title")}
              isOpen={isOpen}
              onClose={() => modalToggle(false)}
              aria-labelledby={`delete transform model`}
              aria-describedby="modal-box-body-variant"
            >
              <ModalHeader
                title={
                  <p>
                    {t("transform:delete.description", {
                      val: deleteInstance.name,
                    })}
                  </p>
                }
                titleIconVariant="warning"
                labelId="delete-modal-title"
              />
              <ModalBody id="modal-box-body-variant">
                <Form>
                  <FormGroup isRequired fieldId={`transform-delete-name`}>
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
                  {t("transform:delete.confirm")}
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
    </>
  );
};

export { Transforms };
