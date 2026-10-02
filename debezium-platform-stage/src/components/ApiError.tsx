import { ExclamationCircleIcon, RedoIcon, TimesCircleIcon } from "@patternfly/react-icons";
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
  Popover,
} from "@patternfly/react-core";
import { useTranslation } from "react-i18next";

interface ApiErrorProps {
  errorType: "small" | "large" | "popover";
  title?: string;
  errorMsg?: string;
  description?: string;
  secondaryActions?: ReactNode;
  onRetry?: () => void;
  isRetrying?: boolean;
  ariaLabel?: string;
}

const ApiError: React.FC<ApiErrorProps> = ({
  errorType,
  title,
  errorMsg,
  description,
  secondaryActions,
  onRetry,
  isRetrying,
  ariaLabel,
}) => {
  const { t } = useTranslation();
  const refresh = () => {
    window.location.reload();
  };

  const formattedErrorMsg = errorMsg
    ? errorMsg.startsWith(t("error"))
      ? errorMsg
      : `${t("error")}: ${errorMsg}`
    : t("apiError");

  return (
    <>
      {errorType === "small" ? (
        <span className="api_error-small">
          <ExclamationCircleIcon className="api_error-icon" />
          <span>{errorMsg ?? t("apiError")}</span>
          {onRetry && (
            <Button
              variant="link"
              isInline
              icon={<RedoIcon />}
              onClick={onRetry}
              isLoading={isRetrying}
              className="api_error-retry-btn"
            >
              {t("retry", { defaultValue: "Retry" })}
            </Button>
          )}
        </span>
      ) : errorType === "popover" ? (
        <Popover
          alertSeverityVariant="danger"
          alertSeverityScreenReaderText={t("dangerAlert", { defaultValue: "Danger alert:" })}
          headerIcon={<ExclamationCircleIcon />}
          headerContent={title ?? t("failedToLoad")}
          bodyContent={
            <div>
              {errorMsg ? (
                <Content component="p">{errorMsg}</Content>
              ) : (
                <Content component="p">{t("apiError")}</Content>
              )}
              {description && <Content component="p">{description}</Content>}
            </div>
          }
          footerContent={
            onRetry || secondaryActions
              ? (hide) => (
                  <>
                    {onRetry && (
                      <Button
                        variant="link"
                        isInline
                        icon={<RedoIcon />}
                        onClick={() => {
                          onRetry();
                          hide?.();
                        }}
                        isLoading={isRetrying}
                        className="api_error-retry-btn"
                      >
                        {t("retry", { defaultValue: "Retry" })}
                      </Button>
                    )}
                    {secondaryActions}
                  </>
                )
              : undefined
          }
          triggerAction="hover"
          showClose={false}
          aria-label={ariaLabel ?? (title ?? t("failedToLoad"))}
        >
          <Button
            variant="plain"
            hasNoPadding
            className="api_error-popover-trigger"
            aria-label={ariaLabel ?? formattedErrorMsg}
            icon={<TimesCircleIcon className="api_error-icon" />}
          />
        </Popover>
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
