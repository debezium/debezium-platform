import React, { useState, useCallback } from "react";
import Joyride, {
  CallBackProps,
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

const WALKTHROUGH_STORAGE_KEY = "dbz-walkthrough-completed";

export const isWalkthroughCompleted = (): boolean => {
  return localStorage.getItem(WALKTHROUGH_STORAGE_KEY) === "true";
};

export const markWalkthroughCompleted = (): void => {
  localStorage.setItem(WALKTHROUGH_STORAGE_KEY, "true");
};

const PatternFlyTooltip: React.FC<TooltipRenderProps> = ({
  continuous,
  index,
  isLastStep,
  size,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}) => {
  return (
    <div {...tooltipProps}>
      <Card
        style={{
          maxWidth: "500px",
          minWidth: "250px",
              }
      }
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
            <Title headingLevel="h4" size="lg">
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
                  onClick={skipProps.onClick}
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
                {step.showProgress && (
                  <FlexItem>
                    <Content component={ContentVariants.small}>
                      {index + 1} / {size}
                    </Content>
                  </FlexItem>
                )}
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
                    {continuous && !isLastStep
                      ? primaryProps.title
                      : primaryProps.title}
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

const GuidedTour: React.FC = () => {
  const { t } = useTranslation("tour");
  const [run, setRun] = useState(true);

  const steps: Step[] = [
    {
      target: "body",
      placement: "center",
      title: t("welcome.title"),
      content: t("welcome.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="sidebar-nav"]',
      placement: "right",
      title: t("sidebarNav.title"),
      content: t("sidebarNav.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="nav-pipeline"]',
      placement: "right",
      title: t("pipelineNav.title"),
      content: t("pipelineNav.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="nav-source"]',
      placement: "right",
      title: t("sourceNav.title"),
      content: t("sourceNav.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="nav-destination"]',
      placement: "right",
      title: t("destinationNav.title"),
      content: t("destinationNav.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="nav-connections"]',
      placement: "right",
      title: t("connectionNav.title"),
      content: t("connectionNav.content"),
      disableBeacon: true,
    },
    // {
    //   target: '[data-tour="theme-selector"]',
    //   placement: "bottom",
    //   title: t("themeSelector.title"),
    //   content: t("themeSelector.content"),
    //   disableBeacon: true,
    // },
    {
      target: '[data-tour="add-pipeline"]',
      placement: "bottom",
      title: t("addPipeline.title"),
      content: t("addPipeline.content"),
      disableBeacon: true,
    },
  ];

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      markWalkthroughCompleted();
    }
  }, []);

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose={false}
      callback={handleCallback}
      tooltipComponent={PatternFlyTooltip}
      locale={{
        back: t("buttons.back"),
        close: t("buttons.close"),
        last: t("buttons.last"),
        next: t("buttons.next"),
        skip: t("buttons.skip"),
      }}
      styles={{
        options: {
          overlayColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 10000,
        },
        spotlight: {
          borderRadius: "4px",
        },
      }}
    />
  );
};

export default GuidedTour;
