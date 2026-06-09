import React, { useEffect, useState } from "react";

import { API_URL } from "../utils/constants";
import { Button, Flex, FlexItem, Skeleton } from "@patternfly/react-core";
import {
  Destination,
  PipelineDestination,
  fetchDataTypeTwo,
} from "../apis/apis";
import { Td } from "@patternfly/react-table";
import ConnectorImage from "./ComponentImage";
import ApiError from "./ApiError";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

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
      const response = await fetchDataTypeTwo<Destination>(
        API_URL + `/api/destinations/${pipelineDestination.id}`
      );

      if (response.error) {
        setError(response.error);
      } else {
        setDestination(response.data as Destination);
      }

      setIsLoading(false);
    };

    fetchDestination();
  }, [pipelineDestination.id]);

  return (
    <Td dataLabel={t("destination")} style={{ paddingLeft: "0px" }}>
      {error ? (
        <ApiError errorType="small" />
      ) : isLoading ? (
        <Skeleton screenreaderText="Loading contents" />
      ) : (
        <Flex alignItems={{ default: "alignItemsCenter" }}>
          <FlexItem spacer={{ default: "spacerMd" }}>
            {destination && (
              <ConnectorImage
                connectorType={(destination as Destination).type}
                size={35}
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
