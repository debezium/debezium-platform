import React, { useEffect, useState } from "react";

import { API_URL } from "../utils/constants";
import { Flex, FlexItem, Skeleton } from "@patternfly/react-core";
import { Td } from "@patternfly/react-table";
import { PipelineSource, Source, fetchDataTypeTwo } from "../apis/apis";
import ConnectorImage from "./ComponentImage";
import ApiError from "./ApiError";
import { useTranslation } from "react-i18next";

interface SourceFieldProps {
  pipelineSource: PipelineSource;
}

const SourceField: React.FC<SourceFieldProps> = ({ pipelineSource }) => {
  const { t } = useTranslation();
  const [source, setSource] = useState<Source>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSources = async () => {
      setIsLoading(true);
      const response = await fetchDataTypeTwo<Source>(
        `${API_URL}/api/sources/${pipelineSource.id}`
      );

      if (response.error) {
        setError(response.error);
      } else {
        setSource(response.data as Source);
      }

      setIsLoading(false);
    };

    fetchSources();
  }, []);

  return (
    <Td dataLabel={t("source")} style={{ paddingLeft: "0px" }}>
      {error ? (
        <ApiError errorType="small" />
      ) : isLoading ? (
        <Skeleton screenreaderText="Loading contents" />
      ) : (
        <Flex alignItems={{ default: "alignItemsCenter" }}>
          <FlexItem spacer={{ default: "spacerMd" }}>
            {source && (
              <ConnectorImage
                connectorType={(source as Source).type}
                size={35}
              />
            )}
          </FlexItem>
          <FlexItem>{pipelineSource.name}</FlexItem>
        </Flex>
      )}
    </Td>
  );
};

export default SourceField;
