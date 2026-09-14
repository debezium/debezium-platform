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
  title?: string;
  errorMsg?: string;
  description?: string;
  secondaryActions?: ReactNode;
  onRetry?: () => void;
}

const ApiError: React.FC<ApiErrorProps> = ({
  errorType,
  title,
  errorMsg,
  description,
  secondaryActions,
  onRetry,
}) => {
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
          titleText={title ?? t('failedToLoad')}
          headingLevel="h4"
          icon={ExclamationCircleIcon}
        >
          <EmptyStateBody>
            {errorMsg && (
              <Content component="p">{t('error') + ": " + errorMsg}</Content>
            )}
            {description && <Content component="p">{description}</Content>}
          </EmptyStateBody>
          <EmptyStateFooter>
            <Button
              variant="primary"
              icon={<RedoIcon />}
              onClick={onRetry ?? refresh}
            >
              {onRetry ? t("tryAgain") : t("refresh")}
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
