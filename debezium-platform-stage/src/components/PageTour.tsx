import React, { useState, useCallback, useEffect, useRef } from "react";
import Joyride, {
  CallBackProps,
  ACTIONS,
  EVENTS,
  STATUS,
  Step,
  TooltipRenderProps,
} from "react-joyride";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Title,
} from "@patternfly/react-core";
import { TimesIcon } from "@patternfly/react-icons";
import {
  useGuidedTour,
  isWalkthroughCompleted,
  arePageToursDisabled,
} from "./GuidedTourContext";

const PageTourTooltip: React.FC<TooltipRenderProps> = ({
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}) => {
  const { skipAllPageTours } = useGuidedTour();

  return (
    <div {...tooltipProps}>
      <Card
        style={{
          maxWidth: "450px",
          minWidth: "250px",
        }}
      >
        <CardHeader
          actions={{
            actions: (
              <Button
                variant="plain"
                aria-label={closeProps["aria-label"]}
                onClick={closeProps.onClick}
                icon={<TimesIcon />}
              />
            ),
            hasNoOffset: true,
          }}
        >
          {step.title && (
            <Title headingLevel="h4" size="md">
              {step.title}
            </Title>
          )}
        </CardHeader>

        <CardBody>
          <Content component={ContentVariants.p}>{step.content}</Content>
        </CardBody>

        <CardFooter>
          <Flex
            justifyContent={{ default: "justifyContentSpaceBetween" }}
            alignItems={{ default: "alignItemsCenter" }}
          >
            <FlexItem>
              {step.showSkipButton && (
                <Button
                  variant="link"
                  onClick={(e) => {
                    skipAllPageTours();
                    skipProps.onClick(e as unknown as React.MouseEvent<HTMLElement>);
                  }}
                  aria-label={skipProps["aria-label"]}
                  isDanger
                >
                  {skipProps.title}
                </Button>
              )}
            </FlexItem>
            <FlexItem>
              <Flex
                gap={{ default: "gapSm" }}
                alignItems={{ default: "alignItemsCenter" }}
              >
                {index > 0 && !step.hideBackButton && (
                  <FlexItem>
                    <Button
                      variant="secondary"
                      onClick={backProps.onClick}
                      aria-label={backProps["aria-label"]}
                    >
                      {backProps.title}
                    </Button>
                  </FlexItem>
                )}
                <FlexItem>
                  <Button
                    variant="primary"
                    onClick={primaryProps.onClick}
                    aria-label={primaryProps["aria-label"]}
                  >
                    {primaryProps.title}
                  </Button>
                </FlexItem>
              </Flex>
            </FlexItem>
          </Flex>
        </CardFooter>
      </Card>
    </div>
  );
};

interface PageTourProps {
  pageKey: string;
  steps: Step[];
}

const PageTour: React.FC<PageTourProps> = ({ pageKey, steps }) => {
  const { t } = useTranslation("tour");
  const {
    isTourActive,
    isAdvancedUser,
    isPageTourCompleted,
    markPageTourCompleted,
    skipAllPageTours,
  } = useGuidedTour();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hideBackOnCurrentStep, setHideBackOnCurrentStep] = useState(false);

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  const mainTourDone = isWalkthroughCompleted();

  const shouldShow =
    isAdvancedUser &&
    mainTourDone &&
    !isTourActive &&
    !arePageToursDisabled() &&
    !isPageTourCompleted(pageKey);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (!shouldShow) {
      return;
    }
    const timer = setTimeout(() => {
      setRun(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [shouldShow]);

  const handleComplete = useCallback(() => {
    setRun(false);
    setStepIndex(0);
    setHideBackOnCurrentStep(false);
    markPageTourCompleted(pageKey);
  }, [pageKey, markPageTourCompleted]);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status, action, index, type } = data;

      if (status === STATUS.FINISHED) {
        handleComplete();
        return;
      }

      if (status === STATUS.SKIPPED) {
        setRun(false);
        setStepIndex(0);
        skipAllPageTours();
        return;
      }

      if (type === EVENTS.STEP_AFTER) {
        if (action === ACTIONS.CLOSE) {
          handleComplete();
          return;
        }

        if (action === ACTIONS.SKIP) {
          setRun(false);
          setStepIndex(0);
          setHideBackOnCurrentStep(false);
          skipAllPageTours();
          return;
        }

        const nextIndex =
          action === ACTIONS.PREV ? index - 1 : index + 1;

        retryCountRef.current = 0;

        if (nextIndex >= steps.length) {
          handleComplete();
          return;
        }

        if (nextIndex >= 0) {
          setHideBackOnCurrentStep(false);
          setStepIndex(nextIndex);
        }
        return;
      }

      if (type === EVENTS.TARGET_NOT_FOUND) {
        if (retryCountRef.current >= MAX_RETRIES) {
          retryCountRef.current = 0;
          const nextIndex = index + 1;
          if (nextIndex < steps.length) {
            setHideBackOnCurrentStep(true);
            setStepIndex(nextIndex);
          } else {
            handleComplete();
          }
          return;
        }
        retryCountRef.current += 1;
        setRun(false);
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          setRun(true);
        }, 800);
      }
    },
    [steps.length, handleComplete, skipAllPageTours]
  );

  if (!shouldShow || steps.length === 0) {
    return null;
  }

  const joyrideSteps = steps.map((step, index) =>
    index === stepIndex && hideBackOnCurrentStep
      ? { ...step, hideBackButton: true }
      : step
  );

  return (
    <Joyride
      steps={joyrideSteps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      disableOverlayClose={false}
      callback={handleCallback}
      tooltipComponent={PageTourTooltip}
      locale={{
        back: t("buttons.back"),
        close: t("buttons.close"),
        last: t("buttons.last"),
        next: t("buttons.next"),
        skip: t("buttons.skip"),
      }}
      styles={{
        options: {
          overlayColor: "rgba(0, 0, 0, 0.4)",
          zIndex: 10000,
        },
        spotlight: {
          borderRadius: "4px",
        },
      }}
    />
  );
};

export default PageTour;
