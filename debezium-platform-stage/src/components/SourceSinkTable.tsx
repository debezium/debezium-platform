/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Flex,
  FlexItem,
  Label,
  Bullseye,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Form,
  FormGroup,
  TextInput,
} from "@patternfly/react-core";
import { TagIcon, SearchIcon } from "@patternfly/react-icons";
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
import React, { useState } from "react";
import {
  DestinationApiResponse,
  Pipeline,
  SourceApiResponse,
  fetchData,
} from "../apis/apis";
import { getConnectorTypeName } from "../utils/helpers";
import ConnectorImage from "./ComponentImage";
import { API_URL } from "../utils/constants";
import { useQuery } from "react-query";
import { getActivePipelineCount } from "../utils/pipelineUtils";
import { useNavigate } from "react-router-dom";
import { useNotification } from "../appLayout/AppNotificationContext";
import { useDeleteData } from "src/apis";

interface ISourceSinkTableProps {
  tableType: "source" | "destination";
  data: SourceApiResponse | DestinationApiResponse;
  onClear: () => void;
}

type DeleteInstance = {
  id: number;
  name: string;
};

type ActionData = {
  id: number;
  name: string;
};

const SourceSinkTable: React.FunctionComponent<ISourceSinkTableProps> = ({
  tableType,
  data,
  onClear,
}) => {
  const navigate = useNavigate();

  const { addNotification } = useNotification();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [deleteInstance, setDeleteInstance] = useState<DeleteInstance>({
    id: 0,
    name: "",
  });
  const [deleteInstanceName, setDeleteInstanceName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

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

  const { mutate: deleteData } = useDeleteData({
    onSuccess: () => {
      modalToggle(false);
      setIsLoading(false);
      addNotification(
        "success",
        `Delete successful`,
        `${tableType} deleted successfully`
      );
    },
    onError: (error) => {
      modalToggle(false);
      setIsLoading(false);
      addNotification(
        "danger",
        `Delete failed`,
        `Failed to delete ${tableType}: ${error}`
      );
    },
  });

  const handleDelete = async (id: number, type: string) => {
    setIsLoading(true);
    const resourceType = type === "source" ? "sources" : "destinations";
    const url = `${API_URL}/api/${resourceType}/${id}`;
    deleteData(url);
  };

  const onDeleteHandler = (id: number, name: string) => {
    setIsOpen(true);
    setDeleteInstance({ id: id, name: name });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onEditHandler = (id: number, _name: string) => {
    navigate(`/${tableType}/edit_${tableType}/${id}`);
  };

  const modalToggle = (toggleValue: boolean) => {
    setDeleteInstanceName("");
    setIsOpen(toggleValue);
  };

  const rowActions = (actionData: ActionData): IAction[] => [
    {
      title: "Edit",
      onClick: () => onEditHandler(actionData.id, actionData.name),
    },

    {
      title: "Delete",
      onClick: () => onDeleteHandler(actionData.id, actionData.name),
    },
  ];

  return (
    <>
      <Table aria-label={`${tableType} table`}>
        <Thead>
          <Tr>
            <Th key={0}>Name</Th>
            <Th key={1}>Type</Th>
            <Th key={2}>Active</Th>
            <Th key={3}>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.length > 0 ? (
            data.map((instance) => (
              <Tr key={instance.id}>
                <Td dataLabel="Name">{instance.name}</Td>
                <Td dataLabel="Type" style={{ paddingLeft: "0px" }}>
                  <Flex alignItems={{ default: "alignItemsCenter" }}>
                    <FlexItem>
                      <ConnectorImage connectorType={instance.type} size={35} />
                    </FlexItem>
                    <FlexItem>{getConnectorTypeName(instance.type)}</FlexItem>
                  </Flex>
                </Td>
                <Td dataLabel="Active">
                  <Label icon={<TagIcon />} color="blue">
                    {getActivePipelineCount(
                      pipelineList,
                      instance.id,
                      tableType
                    )}
                  </Label>
                </Td>
                <Td dataLabel="Actions" isActionCell>
                  <ActionsColumn
                    items={rowActions({ id: instance.id, name: instance.name })}
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
                    titleText={`No matching ${tableType} is present. `}
                    icon={SearchIcon}
                    variant={EmptyStateVariant.sm}
                  >
                    <EmptyStateBody>Clear search and try again.</EmptyStateBody>
                    <EmptyStateFooter>
                      <EmptyStateActions>
                        <Button variant="link" onClick={onClear}>
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
      <Modal
        variant="medium"
        title="Delete modal"
        isOpen={isOpen}
        onClose={() => modalToggle(false)}
        aria-labelledby={`delete ${tableType} model`}
        aria-describedby="modal-box-body-variant"
      >
        <ModalHeader
          title={
            <p>
              {" "}
              Enter <i>"{`${deleteInstance.name}`}"</i> to delete{" "}
              {`${tableType}`}
            </p>
          }
          titleIconVariant="warning"
          labelId="delete-modal-title"
        />
        <ModalBody id="modal-box-body-variant">
          <Form style={{ paddingRight: 45 }}>
            <FormGroup isRequired fieldId={`${tableType}-delete-name`}>
              <TextInput
                id="dalete-name"
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
            onClick={() => handleDelete(deleteInstance.id, tableType)}
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
  );
};

export default SourceSinkTable;
