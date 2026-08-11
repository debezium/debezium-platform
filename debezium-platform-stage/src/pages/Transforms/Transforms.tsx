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
} from "@patternfly/react-core";
import {
  DataProcessorIcon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
} from "@patternfly/react-icons";
import EmptyStatus from "../../components/EmptyStatus";
import "./Transforms.css";
import { useNavigate } from "react-router-dom";
import { fetchData, Pipeline, TransformData, useDeleteData } from "src/apis";
import { API_URL } from "@utils/constants";
import { useResourceQuery } from "src/hooks/useResourceQuery";
import _, { debounce } from "lodash";
import { useState } from "react";
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
import { FeatureGate } from "@components/FeatureGate";
import { useTranslation } from "react-i18next";
import UsedIn from "@components/UsedIn";

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

  type FilterField = "name" | "type";

  const FILTER_OPTIONS: { value: FilterField; label: string }[] = [
    { value: "name", label: "Name" },
    { value: "type", label: "Type" },
  ];

  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [filterField, setFilterField] = React.useState<FilterField>("name");
  const [isFilterSelectOpen, setIsFilterSelectOpen] = React.useState<boolean>(false);

  const {
    data: pipelineList = [],
    error: _pipelineError,
    isLoading: _isPipelineLoading,
  } = useResourceQuery<Pipeline[], Error>(
    "pipelines",
    () => fetchData<Pipeline[]>(`${API_URL}/api/pipelines`)
  );

  const {
    data: transformsList = [],
    error,
    isLoading: isTransformsLoading,
  } = useResourceQuery<TransformData[], Error>(
    "transforms",
    () => fetchData<TransformData[]>(`${API_URL}/api/transforms`)
  );

  // Compute filtered results based on search query and filter field
  const searchResult = React.useMemo(() => {
    if (searchQuery.length === 0) {
      return transformsList;
    }
    return _.filter(transformsList, (o) =>
      o[filterField].toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, filterField, transformsList]);

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

  const debouncedSetSearchQuery = React.useMemo(
    () => debounce((value: string) => {
      setSearchQuery(value);
    }, 700),
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

  const onDeleteHandler = (id: number, name: string) => {
    setIsOpen(true);
    setDeleteInstance({ id: id, name: name });
  };

  const rowActions = (actionData: ActionData): IAction[] => [
    {
      title: t("edit"),
      onClick: () => {
        navigate(`/transform/${actionData.id}?state=edit`);
      },
    },
    {
      title: t("delete"),
      onClick: () => onDeleteHandler(actionData.id, actionData.name),
    },
  ];

  return (
    <div data-tour="transform-page" style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", maxHeight: "100%" }}>
      <FeatureGate flag="Transforms">
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
                            <ToolbarGroup variant="filter-group">
                              <ToolbarItem>
                                <Select
                                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                                    <MenuToggle
                                      ref={toggleRef}
                                      icon={<FilterIcon />}
                                      onClick={() => setIsFilterSelectOpen((prev) => !prev)}
                                      isExpanded={isFilterSelectOpen}
                                      style={{ width: "120px" } as React.CSSProperties}
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
                                  aria-label={`Search transforms by ${filterField}`}
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
                                  {searchQuery.length > 0
                                    ? `${searchResult.length} ${t("of")} ${transformsList.length} ${t("items")}`
                                    : `${transformsList.length} ${t("items")}`}
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
                              <Th key={2}>{t("usedIn")}</Th>
                            </Tr>
                          </Thead>

                          <Tbody>
                            {searchResult.length > 0 ? (
                              searchResult.map((instance: TransformData) => (
                                <Tr key={instance.id}>
                                  <Td dataLabel={t("name")}>
                                    <Button
                                      variant="link"
                                      isInline
                                      onClick={() => navigate(`/transform/${instance.id}?state=view`)}
                                    >
                                      {instance.name}
                                    </Button>
                                  </Td>
                                  <Td dataLabel={t("type")}>{instance.type}</Td>
                                  <Td dataLabel={t("usedIn")}>
                                    <UsedIn resourceList={pipelineList} resourceType={"pipeline"} requestedPageType={"transform"} instance={instance} />

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
                <Form onSubmit={(e) => {
                  e.preventDefault();
                  if (deleteInstanceName === deleteInstance.name) {
                    handleDelete(deleteInstance.id);
                  }
                }}>
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
      </FeatureGate>
    </div>
  );
};

export { Transforms };
