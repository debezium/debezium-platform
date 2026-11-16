import React, { useEffect, useState } from "react";

import { Button, Flex, FlexItem, Skeleton } from "@patternfly/react-core";
import { Td } from "@patternfly/react-table";
import { fetchData } from "../apis/apis";
import { requestErrorMessage } from "../apis/client";
import { PipelineSource, Source } from "../apis/types";
import ConnectorImage from "./ComponentImage";
import ApiError from "./ApiError";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { sourcePath } from "../apis/endpoints";

interface SourceFieldProps {
  pipelineSource: PipelineSource;
}

const SourceField: React.FC<SourceFieldProps> = ({ pipelineSource }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [source, setSource] = useState<Source>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSources = async () => {
      setIsLoading(true);
      try {
        setSource(await fetchData<Source>(sourcePath(pipelineSource.id)));
      } catch (error) {
        setError(requestErrorMessage(error));
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
          <FlexItem>
            <Button
              variant="link"
              isInline
              onClick={() => navigate(`/source/${pipelineSource.id}?state=view`, { state: { mode: "view" as const } })}
            >
              {pipelineSource.name}
            </Button>
          </FlexItem>
        </Flex>
      )}
    </Td>
  );
};

export default SourceField;
