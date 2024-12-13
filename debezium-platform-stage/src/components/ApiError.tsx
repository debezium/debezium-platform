import { ExclamationCircleIcon, RedoIcon } from "@patternfly/react-icons";
import React, { ReactNode } from "react";
import "./ApiError.css";
import {
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
  Button,
  Content,
} from "@patternfly/react-core";

interface ApiErrorProps {
  errorType: "small" | "large";
  errorMsg?: string;
  secondaryActions?: ReactNode;
}

const ApiError: React.FC<ApiErrorProps> = ({ errorType, errorMsg, secondaryActions }) => {
  const refresh = () => {
    window.location.reload(); 
  }
  return (
    <>
      {errorType === "small" ? (
        <>
          <ExclamationCircleIcon className="api_error-icon" /> Error : Failed to
          load{" "}
        </>
      ) : (
        <EmptyState
          variant={EmptyStateVariant.lg}
          status="danger"
          titleText={"Failed to load"}
          headingLevel="h4"
          icon={ExclamationCircleIcon}
        >
          <EmptyStateBody>
              <Content component="p">{"Error: " + errorMsg}</Content>
          </EmptyStateBody>
          <EmptyStateFooter>
            <Button variant="primary" icon={<RedoIcon />} onClick={refresh}>
              Refresh
            </Button>
            <EmptyStateActions>
             {secondaryActions}
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      )}
    </>
  );
};

export default ApiError;
