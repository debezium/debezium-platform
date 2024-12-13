/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Label,
} from "@patternfly/react-core";
import { DataProcessorIcon, TagIcon } from "@patternfly/react-icons";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import React from "react";
import {
  Pipeline,
  TransformApiResponse,
  TransformData,
  fetchData,
} from "../apis/apis";
import { API_URL } from "../utils/constants";
import { useQuery } from "react-query";

interface ITransformSelectionListProps {
  data: TransformApiResponse;
  onSelection: (selection: TransformData) => void;
}

const TransformSelectionList: React.FunctionComponent<
  ITransformSelectionListProps
> = ({ data, onSelection }) => {
  const {
    data: _pipelineList = [],
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
        <Table aria-label={`transform table`}>
          <Thead>
            <Tr>
              <Th key={0}>Name</Th>
              <Th key={1}>Type</Th>
              <Th key={2}>Active</Th>
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
                  <Td dataLabel="Name">{instance.name}</Td>
                  <Td dataLabel="Type" style={{ paddingLeft: "0px" }}>
                  {instance.type}
                  </Td>
                  <Td dataLabel="Active">
                    <Label icon={<TagIcon />} color="blue">
                      {/* {getActivePipelineCount(
                        pipelineList,
                        instance.id,
                        tableType
                      )} */}
                      0
                    </Label>
                  </Td>
                </Tr>
              ))}
          </Tbody>
        </Table>
      ) : (
        <EmptyState
          headingLevel="h2"
          titleText={`No transform available`}
          icon={DataProcessorIcon}
          variant={EmptyStateVariant.lg}
        >
          <EmptyStateBody>
            No transform is configure for this cluster yet. Configure a one by
            selecting "Create a transform" option above.
          </EmptyStateBody>
        </EmptyState>
      )}
    </>
  );
};

export default TransformSelectionList;
