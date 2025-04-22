/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Flex,
  FlexItem,
  Label,
} from "@patternfly/react-core";
import { DataSinkIcon, DataSourceIcon, TagIcon } from "@patternfly/react-icons";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import React from "react";
import {
  Destination,
  DestinationApiResponse,
  Pipeline,
  Source,
  SourceApiResponse,
  fetchData,
} from "../apis/apis";
import { getConnectorTypeName } from "../utils/helpers";
import ConnectorImage from "./ComponentImage";
import { API_URL } from "../utils/constants";
import { useQuery } from "react-query";
import { getActivePipelineCount } from "../utils/pipelineUtils";
import { useTranslation } from "react-i18next";

interface ISourceDestinationSelectionListProps {
  tableType: "source" | "destination";
  data: SourceApiResponse | DestinationApiResponse;
  onSelection: (selection: Source | Destination) => void;
}

const SourceDestinationSelectionList: React.FunctionComponent<
  ISourceDestinationSelectionListProps
> = ({ tableType, data, onSelection }) => {
  const { t } = useTranslation();
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

  return (
    <>
      {data.length > 0 ? (
        <Table aria-label={`${tableType} table`}>
          <Thead>
            <Tr>
              <Th key={0}>{t("name")}</Th>
              <Th key={1}>{t("type")}</Th>
              <Th key={2}>{t("active")}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.length > 0 &&
              data.map((instance) => (
                <Tr
                  key={instance.id}
                  onRowClick={() => onSelection(instance)}
                  isSelectable
                  isClickable
                >
                  <Td dataLabel={t("name")}>{instance.name}</Td>
                  <Td dataLabel={t("type")} style={{ paddingLeft: "0px" }}>
                    <Flex alignItems={{ default: "alignItemsCenter" }}>
                      <FlexItem>
                        <ConnectorImage
                          connectorType={instance.type}
                          size={35}
                        />
                      </FlexItem>
                      <FlexItem>{getConnectorTypeName(instance.type)}</FlexItem>
                    </Flex>
                  </Td>
                  <Td dataLabel={t("active")}>
                    <Label icon={<TagIcon />} color="blue">
                      {getActivePipelineCount(
                        pipelineList,
                        instance.id,
                        tableType
                      )}
                    </Label>
                  </Td>
                </Tr>
              ))}
          </Tbody>
        </Table>
      ) : (
        <EmptyState
          headingLevel="h2"
          titleText={t("emptyState.title", {val: tableType})}
          icon={tableType === "source" ? DataSourceIcon : DataSinkIcon}
          variant={EmptyStateVariant.lg}
        >
          <EmptyStateBody>
           {t("emptyState.description", {val: tableType})}
          </EmptyStateBody>
          {/* <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant="secondary" onClick={() => {}}>
                Create a destination
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter> */}
        </EmptyState>
      )}
    </>
  );
};

export default SourceDestinationSelectionList;
