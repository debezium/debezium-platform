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
} from "@patternfly/react-core";
import { DataProcessorIcon, PlusIcon, SearchIcon } from "@patternfly/react-icons";
import EmptyStatus from "../../components/EmptyStatus";
import "./Transforms.css";
import { useNavigate } from "react-router-dom";
import { fetchData, TransformData, useDeleteData } from "src/apis";
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

export interface ITransformsProps {
  sampleProp?: string;
}

const Transforms: React.FunctionComponent<ITransformsProps> = () => {
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
      title: "Edit",
      onClick: () => {
        navigateTo(`/transform/edit_transform/${actionData.id}`);
      },
    },
    {
      title: "Delete",
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
                    Go to source
                  </Button>
                  <Button
                    variant="link"
                    onClick={() => navigateTo("/destination")}
                  >
                    Go to destination
                  </Button>
                </>
              }
            />
          </PageSection>
        ) : (
          <>
            {isTransformsLoading ? (
              <EmptyState
                titleText="Loading..."
                headingLevel="h4"
                icon={Spinner}
              />
            ) : (
              <>
                {transformsList.length > 0 ? (
                  <>
                    <PageHeader
                      title="Transform"
                      description="Add a pipeline to streams change events from a pipeline
                      database. To start select a connector below once you
                      select a connector you can configure it using form or
                      smart editor option. You can also search the connector by
                      its name or toggle the catalog between the list view or
                      card view."
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
                                placeholder="Find by name"
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
                                  Add transform
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
                                  Items
                                </Content>
                              </ToolbarItem>
                            </ToolbarGroup>
                          </ToolbarContent>
                        </Toolbar>
                        <Table aria-label="Transform Table">
                          <Thead>
                            <Tr>
                              <Th key={0}>Name</Th>
                              <Th key={1}>Type</Th>
                              <Th key={2}>Active</Th>

                              <Th key={5}>Actions</Th>
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
                                  <Td dataLabel="Name">{instance.name}</Td>
                                  <Td dataLabel="Type">{instance.type}</Td>
                                  <Td dataLabel="Active">0</Td>

                                  <Td dataLabel="Actions" isActionCell>
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
                                      titleText="No matching transform is present."
                                      icon={SearchIcon}
                                      variant={EmptyStateVariant.sm}
                                    >
                                      <EmptyStateBody>
                                        Clear search and try again.
                                      </EmptyStateBody>
                                      <EmptyStateFooter>
                                        <EmptyStateActions>
                                          <Button
                                            variant="link"
                                            onClick={onClear}
                                          >
                                            Clear search
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
                      heading="No Transform available"
                      primaryMessage=' No Transform is configure for this cluster yet. To streams change
              events from a Transformation database you can configure a source by click
              the "Add Transform" button.'
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
                          Add Transform
                        </Button>
                      }
                      secondaryActions={
                        <>
                          <Button variant="link">Go to source</Button>
                          <Button variant="link">Go to destination</Button>
                          <Button variant="link">Go to pipeline</Button>
                        </>
                      }
                    />
                  
                )}
              </>
            )}

            <Modal
              variant="medium"
              title="Delete transform"
              isOpen={isOpen}
              onClose={() => modalToggle(false)}
              aria-labelledby={`delete transform model`}
              aria-describedby="modal-box-body-variant"
            >
              <ModalHeader
                title={
                  <p>
                    {" "}
                    Enter <i>"{`${deleteInstance.name}`}"</i> to delete
                    transform
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
                  Confirm
                </Button>
                <Button
                  key="cancel"
                  variant="link"
                  onClick={() => modalToggle(false)}
                >
                  Cancel
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
