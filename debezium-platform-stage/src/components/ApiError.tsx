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
import { useTranslation } from "react-i18next";

interface ApiErrorProps {
  errorType: "small" | "large";
  errorMsg?: string;
  secondaryActions?: ReactNode;
}

const ApiError: React.FC<ApiErrorProps> = ({ errorType, errorMsg, secondaryActions }) => {
  const { t } = useTranslation();
  const refresh = () => {
    window.location.reload();
  }
  return (
    <>
      {errorType === "small" ? (
        <>
          <ExclamationCircleIcon className="api_error-icon" />  {t("apiError")}
        </>
      ) : (
        <EmptyState
          variant={EmptyStateVariant.lg}
          status="danger"
          titleText={t('failedToLoad')}
          headingLevel="h4"
          icon={ExclamationCircleIcon}
        >
          <EmptyStateBody>
            <Content component="p">{t('error')+ ": " + errorMsg}</Content>
          </EmptyStateBody>
          <EmptyStateFooter>
            <Button variant="primary" icon={<RedoIcon />} onClick={refresh}>
              {t("refresh")}
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
