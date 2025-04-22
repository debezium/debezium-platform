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
import { useTranslation } from "react-i18next";

interface ITransformSelectionListProps {
  data: TransformApiResponse;
  onSelection: (selection: TransformData) => void;
}

const TransformSelectionList: React.FunctionComponent<
  ITransformSelectionListProps
> = ({ data, onSelection }) => {
  const { t } = useTranslation();
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
              <Th key={0}>{t('name')}</Th>
              <Th key={1}>{t('type')}</Th>
              <Th key={2}>{t('active')}</Th>
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
                  <Td dataLabel={t('name')}>{instance.name}</Td>
                  <Td dataLabel={t('type')} style={{ paddingLeft: "0px" }}>
                    {instance.type}
                  </Td>
                  <Td dataLabel={t('active')}>
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
          titleText={t('emptyState.title',{val: "Transform"})}
          icon={DataProcessorIcon}
          variant={EmptyStateVariant.lg}
        >
          <EmptyStateBody>
          {t('emptyState.shortDescription',{val: "Transform"})}
          </EmptyStateBody>
        </EmptyState>
      )}
    </>
  );
};

export default TransformSelectionList;
