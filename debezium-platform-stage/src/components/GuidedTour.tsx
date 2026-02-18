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
import { useNavigate, useLocation } from "react-router-dom";
import { useGuidedTour, TourMode } from "./GuidedTourContext";

const PatternFlyTooltip: React.FC<TooltipRenderProps> = ({
  index,
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

interface FlowSelectorProps {
  onSelect: (mode: TourMode) => void;
  onDefer: () => void;
}

const FlowSelector: React.FC<FlowSelectorProps> = ({ onSelect, onDefer }) => {
  const { t } = useTranslation("tour");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
    >
      <Card
        style={{
          maxWidth: "550px",
          minWidth: "400px",
        }}
      >
        <CardHeader>
          <Title headingLevel="h3" size="xl">
            {t("flowSelector.title")}
          </Title>
        </CardHeader>
        <CardBody>
          <Content component={ContentVariants.p} style={{ marginBottom: "16px" }}>
            {t("flowSelector.description")}
          </Content>

          <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
            <FlexItem>
              <Button
                variant="stateful"
                state="read"
                isBlock
                onClick={() => onSelect("basic")}
                style={{
                  padding: "16px",
                  textAlign: "left",
                  whiteSpace: "normal",
                  height: "auto",
                }}
              >
                <Title headingLevel="h4" size="md">
                  {t("flowSelector.basicLabel")}
                </Title>
                <Content
                  component={ContentVariants.small}
                  style={{ fontWeight: "normal", marginTop: "4px" }}
                >
                  {t("flowSelector.basicDescription")}
                </Content>
              </Button>
            </FlexItem>
            <FlexItem>
              <Button
                variant="stateful"
                state="read"
                isBlock
                onClick={() => onSelect("advanced")}
                style={{
                  padding: "16px",
                  textAlign: "left",
                  whiteSpace: "normal",
                  height: "auto",
                }}
              >
                <Title headingLevel="h4" size="md">
                  {t("flowSelector.advancedLabel")}
                </Title>
                <Content
                  component={ContentVariants.small}
                  style={{ fontWeight: "normal", marginTop: "4px" }}
                >
                  {t("flowSelector.advancedDescription")}
                </Content>
              </Button>
            </FlexItem>
          </Flex>
        </CardBody>
        <CardFooter>
          <Button variant="link" onClick={onDefer}>
            {t("flowSelector.maybeLater")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

interface TourStepDef extends Omit<Step, "target"> {
  target: string;
  requiredPath?: string; 
}

const useBasicSteps = (): TourStepDef[] => {
  const { t } = useTranslation("tour");

  return [
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
    {
      target: '[data-tour="add-pipeline"]',
      placement: "bottom",
      title: t("addPipeline.title"),
      content: t("addPipeline.content"),
      disableBeacon: true,
      requiredPath: "/pipeline",
    },
  ];
};

const useAdvancedSteps = (): TourStepDef[] => {
  const { t } = useTranslation("tour");
  const basicSteps = useBasicSteps();

  const basicWithoutLast = basicSteps.slice(0, -1);

  const advancedSteps: TourStepDef[] = [
    {
      target: '[data-tour="add-pipeline"]',
      placement: "bottom",
      title: t("advAddPipeline.title"),
      content: t("advAddPipeline.content"),
      disableBeacon: true,
      requiredPath: "/pipeline",
    },
    {
      target: '.react-flow__node[data-id="source"]',
      placement: "bottom",
      title: t("advDesignerSource.title"),
      content: t("advDesignerSource.content"),
      disableBeacon: true,
      requiredPath: "/pipeline/pipeline_designer",
    },
    {
      target: '.react-flow__node[data-id="destination"]',
      placement: "bottom",
      title: t("advDesignerDestination.title"),
      content: t("advDesignerDestination.content"),
      disableBeacon: true,
      requiredPath: "/pipeline/pipeline_designer",
    },
    {
      target: '.react-flow__node[data-id="transform_selector"]',
      placement: "bottom",
      title: t("advDesignerTransform.title"),
      content: t("advDesignerTransform.content"),
      disableBeacon: true,
      requiredPath: "/pipeline/pipeline_designer",
    },
    {
      target: '[data-tour="dbz-server-config"]',
      placement: "bottom",
      title: t("advDbzServerConfig.title"),
      content: t("advDbzServerConfig.content"),
      disableBeacon: true,
      requiredPath: "/pipeline/pipeline_designer",
    },
    {
      target: '[data-tour="configure-pipeline-btn"]',
      placement: "top",
      title: t("advConfigurePipeline.title"),
      content: t("advConfigurePipeline.content"),
      disableBeacon: true,
      requiredPath: "/pipeline/pipeline_designer",
    },
  ];

  return [...basicWithoutLast, ...advancedSteps];
};

// Main GuidedTour Component

const GuidedTour: React.FC = () => {
  const { t } = useTranslation("tour");
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isTourActive,
    tourMode,
    stepIndex,
    setTourMode,
    setStepIndex,
    completeTour,
    deferTour,
  } = useGuidedTour();

  const [paused, setPaused] = useState(false);
  const run = isTourActive && !!tourMode && !paused;
  const isNavigatingRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  const basicSteps = useBasicSteps();
  const advancedSteps = useAdvancedSteps();

  const steps: TourStepDef[] =
    tourMode === "advanced" ? advancedSteps : basicSteps;

  // Clean up 
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isTourActive || !tourMode) return;
    if (!isNavigatingRef.current) return;

    const currentStep = steps[stepIndex];
    if (!currentStep?.requiredPath) return;

    const onCorrectPage =
      location.pathname === currentStep.requiredPath ||
      location.pathname.startsWith(currentStep.requiredPath + "/");

    if (onCorrectPage) {
      const timer = setTimeout(() => {
        isNavigatingRef.current = false;
        retryCountRef.current = 0;
        setPaused(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, stepIndex, isTourActive, tourMode, steps]);

  const handleFlowSelect = useCallback(
    (mode: TourMode) => {
      setTourMode(mode);
      setStepIndex(0);
    },
    [setTourMode, setStepIndex]
  );

  const handleDefer = useCallback(() => {
    deferTour();
  }, [deferTour]);

  const stopTour = useCallback(() => {
    setPaused(false);
    isNavigatingRef.current = false;
    retryCountRef.current = 0;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    completeTour();
  }, [completeTour]);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status, action, index, type } = data;

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        stopTour();
        return;
      }

      if (type === EVENTS.STEP_AFTER) {
        if (action === ACTIONS.CLOSE) {
          stopTour();
          return;
        }

        const nextIndex =
          action === ACTIONS.PREV ? index - 1 : index + 1;

        retryCountRef.current = 0;

        if (nextIndex >= steps.length) {
          stopTour();
          return;
        }

        if (nextIndex < 0) {
          return;
        }

        const nextStep = steps[nextIndex];

        if (nextStep.requiredPath) {
          const onCorrectPage =
            window.location.pathname === nextStep.requiredPath ||
            window.location.pathname.startsWith(
              nextStep.requiredPath + "/"
            );

          if (!onCorrectPage) {
            setPaused(true);
            isNavigatingRef.current = true;
            setStepIndex(nextIndex);
            navigate(nextStep.requiredPath);
            return;
          }
        }

        setStepIndex(nextIndex);
        return;
      }

      // Handle target not found — navigate to the required page or retry
      if (type === EVENTS.TARGET_NOT_FOUND) {
        if (retryCountRef.current >= MAX_RETRIES) {
          retryCountRef.current = 0;
          const nextIndex = index + 1;
          if (nextIndex < steps.length) {
            setStepIndex(nextIndex);
          } else {
            stopTour();
          }
          return;
        }

        const currentStep = steps[index];
        if (currentStep?.requiredPath) {
          const onCorrectPage =
            window.location.pathname === currentStep.requiredPath ||
            window.location.pathname.startsWith(
              currentStep.requiredPath + "/"
            );
          if (!onCorrectPage) {
            setPaused(true);
            isNavigatingRef.current = true;
            navigate(currentStep.requiredPath);
            return;
          }
        }

        retryCountRef.current += 1;
        setPaused(true);
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          setPaused(false);
        }, 800);
      }
    },
    [steps, navigate, setStepIndex, stopTour]
  );

  if (!isTourActive) {
    return null;
  }
  if (!tourMode) {
    return <FlowSelector onSelect={handleFlowSelect} onDefer={handleDefer} />;
  }

  return (
    <Joyride
      steps={steps as Step[]}
      run={run}
      stepIndex={stepIndex}
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
