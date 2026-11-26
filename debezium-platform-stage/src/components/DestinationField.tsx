import React, { useEffect, useState } from "react";

import { Button, Flex, FlexItem, Skeleton } from "@patternfly/react-core";
import { fetchData } from "../apis/apis";
import { requestErrorMessage } from "../apis/client";
import { Destination, PipelineDestination } from "../apis/types";
import { Td } from "@patternfly/react-table";
import ConnectorImage from "./ComponentImage";
import ApiError from "./ApiError";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { destinationPath } from "../apis/endpoints";

interface DestinationFieldProps {
  pipelineDestination: PipelineDestination;
}

const DestinationField: React.FC<DestinationFieldProps> = ({
  pipelineDestination,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [destination, setDestination] = useState<Destination>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDestination = async () => {
      setIsLoading(true);
      try {
        setDestination(
          await fetchData<Destination>(destinationPath(pipelineDestination.id))
        );
      } catch (error) {
        setError(requestErrorMessage(error));
      }

      setIsLoading(false);
    };

    fetchDestination();
  }, [pipelineDestination.id]);

  return (
    <Td dataLabel={t("destination")} >
      {error ? (
        <ApiError errorType="small" />
      ) : isLoading ? (
        <Skeleton screenreaderText="Loading contents" />
      ) : (
        <Flex alignItems={{ default: "alignItemsCenter" }}>
          <FlexItem spacer={{ default: "spacerSm" }}>
            {destination && (
              <ConnectorImage
                connectorType={(destination as Destination).type}
                size={23}
              />
            )}
          </FlexItem>
          <FlexItem>
            <Button
              variant="link"
              isInline
              onClick={() => navigate(`/destination/${pipelineDestination.id}?state=view`, { state: { mode: "view" as const } })}
            >
              {pipelineDestination.name}
            </Button>
          </FlexItem>
        </Flex>
      )}
    </Td>
  );
};

export default DestinationField;
