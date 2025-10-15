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
  Label,
} from "@patternfly/react-core";
import { SearchIcon, TagIcon } from "@patternfly/react-icons";
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
  Destination,
  Source,
} from "../apis/apis";
import { getConnectionRole, getConnectorTypeName } from "../utils/helpers";
import ConnectorImage from "./ComponentImage";
import { API_URL } from "../utils/constants";
import { useNavigate } from "react-router-dom";
import { useNotification } from "../appLayout/AppNotificationContext";
import { useDeleteData } from "src/apis";
import { useTranslation } from "react-i18next";
import { getActiveConnectionCount } from "@utils/connectionsUtils";


interface IConnectionTableProps {
  data: ConnectionsApiResponse;
  sourceList: Source[];
  destinationList: Destination[];
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
  data,
  sourceList,
  destinationList,
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
    onError: (error: Error) => {
      modalToggle(false);
      setIsLoading(false);
      const rawMessage = error?.message ?? "";
      // Extract the [ERROR: ...]  (if present)
      const errorSegmentMatch = rawMessage.match(/\[ERROR:([\s\S]*?)\]/) || rawMessage.match(/\[Error:([\s\S]*?)\]/);
      const errorSegmentRaw = errorSegmentMatch ? errorSegmentMatch[1].trim() : "";
      let errorSummary = errorSegmentRaw;
      let errorDetail = "";
      const detailIndex = errorSegmentRaw.indexOf("Detail:");
      if (detailIndex >= 0) {
        errorSummary = errorSegmentRaw.substring(0, detailIndex).trim();
        errorDetail = errorSegmentRaw.substring(detailIndex + "Detail:".length).trim();
      }

      const descriptionParts = [
        rawMessage.includes(": ") ? rawMessage.split(": ", 1)[0] : rawMessage,
        errorSummary ? `ERROR: ${errorSummary}` : "",
        errorDetail ? `Detail: ${errorDetail}` : "",
      ].filter(Boolean);

      const description = descriptionParts.join("\n");

      addNotification("danger", `Delete failed`, description);
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
                        {t("activeResourceUsingTooltip", { val1: getConnectionRole(instance.type.toLowerCase())+"s", val2: "connection" })}
                      </div>
                    }
                  >
                    <Label icon={<TagIcon />} color="blue">
                      &nbsp;{getActiveConnectionCount(
                        getConnectionRole(instance.type.toLowerCase()) === "source" ? sourceList : destinationList,
                        instance.id
                      )}
                    </Label>
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
                    titleText={t("search.title", { val: "connection" })}
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
              {`${t("connection:connection")}`}
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
