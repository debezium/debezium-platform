/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Flex,
  FlexItem,
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
  Tooltip,
} from "@patternfly/react-core";
import { SearchIcon } from "@patternfly/react-icons";
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
  ConnectionsApiResponse,
} from "../apis/apis";
import { getConnectionRole, getConnectorTypeName } from "../utils/helpers";
import ConnectorImage from "./ComponentImage";
import { API_URL } from "../utils/constants";
import { useNavigate } from "react-router-dom";
import { useNotification } from "../appLayout/AppNotificationContext";
import { useDeleteData } from "src/apis";
import { useTranslation } from "react-i18next";
import { TagCount } from "@patternfly/react-component-groups";


interface IConnectionTableProps {
  data: ConnectionsApiResponse;
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

const ConnectionTable: React.FunctionComponent<IConnectionTableProps> = ({
  // tableType,
  data,
  onClear,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { addNotification } = useNotification();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [deleteInstance, setDeleteInstance] = useState<DeleteInstance>({
    id: 0,
    name: "",
  });
  const [deleteInstanceName, setDeleteInstanceName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // const {
  //   data: pipelineList = [],
  //   error: _pipelineError,
  //   isLoading: _isPipelineLoading,
  // } = useQuery<Pipeline[], Error>(
  //   "pipelines",
  //   () => fetchData<Pipeline[]>(`${API_URL}/api/pipelines`),
  //   {
  //     refetchInterval: 7000,
  //   }
  // );

  const { mutate: deleteData } = useDeleteData({
    onSuccess: () => {
      modalToggle(false);
      setIsLoading(false);
      addNotification(
        "success",
        `Delete successful`,
        `Connection deleted successfully`
      );
    },
    onError: (error) => {
      modalToggle(false);
      setIsLoading(false);
      addNotification(
        "danger",
        `Delete failed`,
        `Failed to delete Connection: ${error}`
      );
    },
  });

  const handleDelete = async (id: number) => {
    setIsLoading(true);
    const url = `${API_URL}/api/connections/${id}`;
    deleteData(url);
  };

  const onDeleteHandler = (id: number, name: string) => {
    setIsOpen(true);
    setDeleteInstance({ id: id, name: name });
  };

  const onEditHandler = (id: number, _name: string) => {
    navigate(`/connections/${id}?state=edit`);
  };

  const modalToggle = (toggleValue: boolean) => {
    setDeleteInstanceName("");
    setIsOpen(toggleValue);
  };

  const onNameClick = (id: number) => () => {
    navigate(`/connections/${id}?state=view`);
  };

  const rowActions = (actionData: ActionData): IAction[] => [
    {
      title: t("edit"),
      onClick: () => onEditHandler(actionData.id, actionData.name),
    },

    {
      title: t("delete"),
      onClick: () => onDeleteHandler(actionData.id, actionData.name),
    },
  ];

  return (
    <>
      <Table aria-label={`connection table`}>
        <Thead>
          <Tr>
            <Th key={0}>{t("name")}</Th>
            <Th key={1} style={{ paddingLeft: "60px" }}>{t("type")}</Th>
            <Th key={2}>{t("active")}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.length > 0 ? (
            data.map((instance) => (
              <Tr key={instance.id}>
                <Td dataLabel={t("name")}>
                  <Button
                    variant="link"
                    isInline
                    onClick={onNameClick(instance.id)}
                  >
                    {instance.name}
                  </Button>
                </Td>
                <Td dataLabel={t("type")} style={{ paddingLeft: "0px" }}>
                  <Flex alignItems={{ default: "alignItemsCenter" }}>
                    <FlexItem>
                      <ConnectorImage connectorType={instance.type.toLowerCase()} size={35} />
                    </FlexItem>
                    <FlexItem>{getConnectorTypeName(instance.type.toLowerCase())} {getConnectionRole(instance.type.toLowerCase())}</FlexItem>
                  </Flex>
                </Td>
                <Td dataLabel={t("active")}>
                  <Tooltip
                    content={
                      <div>
                        {t("activePipelineTooltip", { val: "Connection" })}
                      </div>
                    }
                  >
                    {/* <Label icon={<TagIcon />} color="blue">
                      0
                    </Label> */}
                    <TagCount />
                  </Tooltip>
                </Td>
                <Td dataLabel={t("actions")} isActionCell>
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
                    titleText={t("search.title", { val: "Connection" })}
                    icon={SearchIcon}
                    variant={EmptyStateVariant.sm}
                  >
                    <EmptyStateBody>{t("search.description")}</EmptyStateBody>
                    <EmptyStateFooter>
                      <EmptyStateActions>
                        <Button variant="link" onClick={onClear}>
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
      <Modal
        variant="medium"
        title={t("deleteModel.title")}
        isOpen={isOpen}
        onClose={() => modalToggle(false)}
        aria-labelledby={`delete connection model`}
        aria-describedby="modal-box-body-variant"
      >
        <ModalHeader
          title={
            <p>
              {t("deleteModel.description", {
                val: deleteInstance.name,
              })}
              {`connection`}
            </p>
          }
          titleIconVariant="warning"
          labelId="delete-modal-title"
        />
        <ModalBody id="modal-box-body-variant">
          <Form style={{ paddingRight: 45 }}>
            <FormGroup isRequired fieldId={`connection-delete-name`}>
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
            onClick={() => handleDelete(deleteInstance.id)}
            isDisabled={deleteInstanceName !== deleteInstance.name}
            isLoading={isLoading}
          >
            {t("deleteModel.confirm")}
          </Button>
          <Button
            key="cancel"
            variant="link"
            onClick={() => modalToggle(false)}
          >
            {t("deleteModel.cancel")}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default ConnectionTable;
