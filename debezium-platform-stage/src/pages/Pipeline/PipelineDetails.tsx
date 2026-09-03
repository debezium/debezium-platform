/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Alert,
  Button,
  EmptyState,
  Icon,
  Label,
  LabelColor,
  PageSection,
  Spinner,
  Tab,
  TabContent,
  TabContentBody,
  Tabs,
  TabTitleText,
} from "@patternfly/react-core";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  editPut,
  fetchDataTypeTwo,
  Pipeline,
  PipelineStatus,
  Transform,
} from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { buildPipelineRestartPayload } from "@utils/pipelineUtils";
import { useVisibilityPolling } from "../../hooks/useVisibilityPolling";

import "./PipelineDetails.css";
import PipelineLog from "./PipelineLog";
import PipelineOverview from "./PipelineOverview";
import { PipelineDesignerEdit } from "./PipelineDesignerEdit";
import { useTranslation } from 'react-i18next';
import PipelineAction from "./PipelineAction";
import PipelineMonitoring from "./PipelineMonitoring";
import {
  getEnabledPipelineTabs,
  isPipelineTabEnabled,
} from "@utils/featureFlag";
import { PageHeader } from "@patternfly/react-component-groups";
import { useNotification } from "../../appLayout/AppNotificationContext";
import { InfoAltIcon, RhUiPathIcon } from "@patternfly/react-icons";
import ApiError from "../../components/ApiError";

const PIPELINE_STATUS_CONFIG: Record<PipelineStatus, { color: LabelColor; labelKey: string; tooltipKey: string }> = {
  FAILED:   { color: LabelColor.red,   labelKey: "statusMessage:pipelineStatus.failed",    tooltipKey: "pipeline:pipelineFailureMsg"   },
  DEPLOYING:{ color: LabelColor.yellow,  labelKey: "statusMessage:pipelineStatus.deploying", tooltipKey: "pipeline:pipelineDeployingMsg" },
  RUNNING:  { color: LabelColor.green, labelKey: "statusMessage:pipelineStatus.running",   tooltipKey: "pipeline:pipelineRunningMsg"   },
};

const EMPTY_TRANSFORMS: Transform[] = [];
const EMPTY_LOG_LEVELS: Record<string, string> = {};

const PipelineDetails: React.FunctionComponent = () => {
  const { pipelineId, detailsTab } = useParams<{
    pipelineId: string;
    detailsTab: string;
  }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const validTabs = React.useMemo(() => getEnabledPipelineTabs(), []);

  const [activeTabKey, setActiveTabKey] = React.useState(() => {
    const initialTab = detailsTab || "overview";
    return isPipelineTabEnabled(initialTab) ? initialTab : "overview";
  });

  const [pipeline, setPipeline] = useState<Pipeline>();
  const [isFetchLoading, setIsFetchLoading] = useState<boolean>(true);
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedPipelineId, setFetchedPipelineId] = useState(pipelineId);
  const [syncedDetailsTab, setSyncedDetailsTab] = useState(detailsTab);

  if (detailsTab !== syncedDetailsTab) {
    setSyncedDetailsTab(detailsTab);
    if (detailsTab && validTabs.includes(detailsTab)) {
      setActiveTabKey(detailsTab);
    }
  }

  if (pipelineId !== fetchedPipelineId) {
    setFetchedPipelineId(pipelineId);
    setIsFetchLoading(true);
    setPipeline(undefined);
    setError(null);
  }

  useEffect(() => {
    if (
      detailsTab &&
      pipelineId &&
      !isPipelineTabEnabled(detailsTab)
    ) {
      navigate(`/pipeline/${pipelineId}/overview`, { replace: true });
    }
  }, [detailsTab, pipelineId, navigate]);

  useEffect(() => {
    let cancelled = false;

    const loadPipeline = async () => {
      const response = await fetchDataTypeTwo<Pipeline>(
        `${API_URL}/api/pipelines/${pipelineId}`
      );

      if (cancelled) {
        return;
      }

      if (response.error) {
        setError(response.error);
        setPipeline(undefined);
      } else {
        setError(null);
        setPipeline(response.data as Pipeline);
      }
      setIsFetchLoading(false);
    };

    void loadPipeline();

    return () => {
      cancelled = true;
    };
  }, [pipelineId]);

  const refreshPipeline = React.useCallback(async () => {
    const response = await fetchDataTypeTwo<Pipeline>(
      `${API_URL}/api/pipelines/${pipelineId}`
    );

    if (response.error) {
      return;
    }

    setError(null);
    setPipeline(response.data as Pipeline);
  }, [pipelineId]);

  // Poll the pipeline every 5s so the header status can move DEPLOYING → RUNNING.
  // Skip until the first load succeeds, and pause on Edit so in-progress form
  // state is not competing with a full refetch. Pauses when the browser tab is hidden.
  useVisibilityPolling(
    5_000,
    () => { void refreshPipeline(); },
    !!pipeline && activeTabKey !== "edit"
  );

  // Stabilize the sub-objects so PipelineDesignerEdit's useEffect deps don't
  const stablePipelineSource = React.useMemo(
    () => pipeline?.source,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(pipeline?.source)]
  );
  const stablePipelineDestination = React.useMemo(
    () => pipeline?.destination,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(pipeline?.destination)]
  );
  const stableTransforms = React.useMemo(
    () => pipeline?.transforms,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(pipeline?.transforms)]
  );
  const stableLogLevels = React.useMemo(
    () => pipeline?.logLevels,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(pipeline?.logLevels)]
  );

  const onRestartHandler = async () => {
    if (!pipeline) {
      return;
    }

    setIsRestarting(true);
    const response = await editPut(
      `${API_URL}/api/pipelines/${pipeline.id}`,
      buildPipelineRestartPayload(pipeline)
    );
    setIsRestarting(false);

    if (response.error) {
      addNotification(
        "danger",
        t("statusMessage:restart.failedTitle"),
        t("statusMessage:restart.failedDescription", {
          val: `${t("pipeline")} ${pipeline.name}: ${response.error}`,
        })
      );
      return;
    }

    addNotification(
      "success",
      t("statusMessage:restart.successTitle"),
      t("statusMessage:restart.successDescription", {
        val: `${t("pipeline")} ${pipeline.name}`,
      })
    );
    void refreshPipeline();
  };

  // Update local active tab first so the accent can animate, then sync the URL 
  const handleTabClick = (_event: any, tabIndex: string | number) => {
    const selectedTab = tabIndex as string;
    if (selectedTab === activeTabKey) {
      return;
    }
    setActiveTabKey(selectedTab);
    requestAnimationFrame(() => {
      navigate(`/pipeline/${pipelineId}/${selectedTab}`);
    });
  };

  // Stable title nodes prevent Tab's internal useEffect from calling
  // setAccentStyles(true) on every render, which zeroes the accent transition.
  const overviewTabTitle = React.useMemo(
    () => <TabTitleText>{t("pipeline:tabs.overview")}</TabTitleText>,
    [t]
  );
  const actionTabTitle = React.useMemo(
    () => <TabTitleText>{t("pipeline:tabs.action")}</TabTitleText>,
    [t]
  );
  const monitoringTabTitle = React.useMemo(
    () => <TabTitleText>{t("pipeline:tabs.monitoring")}</TabTitleText>,
    [t]
  );
  const logsTabTitle = React.useMemo(
    () => <TabTitleText>{t("pipeline:tabs.log")}</TabTitleText>,
    [t]
  );
  const editTabTitle = React.useMemo(
    () => <TabTitleText>{t("pipeline:tabs.edit")}</TabTitleText>,
    [t]
  );

  if (isFetchLoading) {
    return (
      <PageSection isWidthLimited>
        <EmptyState
          titleText={t("loading")}
          headingLevel="h4"
          icon={Spinner}
        />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection isWidthLimited>
        <ApiError
          errorType="large"
          errorMsg={error}
          secondaryActions={
            <Button variant="link" onClick={() => navigate("/pipeline")}>
              {t("goTo", { val: t("pipeline") })}
            </Button>
          }
        />
      </PageSection>
    );
  }

  const statusConfig = pipeline?.status ? PIPELINE_STATUS_CONFIG[pipeline.status] : null;

  return (
    <>
      <PageHeader
        title={pipeline?.name}
        subtitle={pipeline?.description}
        label={
          statusConfig ? (
             <Label color={statusConfig.color}>
                    {t(statusConfig.labelKey)}
                  </Label>
          ) : ""
        }
        icon={<Icon size="2xl" className="custom-header_icon" isInProgress={pipeline === undefined} >
          <RhUiPathIcon />
        </Icon>}
        actionMenu={
          pipeline?.status === "FAILED" ? (
            <Button
              variant="primary"
              isLoading={isRestarting}
              isDisabled={isRestarting}
              onClick={() => void onRestartHandler()}
            >
              {t("pipeline:userActions.restart")}
            </Button>
          ) : undefined
        }
      />
      {pipeline?.status === "FAILED" && pipeline.errorMessage && (
        <PageSection
          isWidthLimited
          padding={{ default: "noPadding" }}
          style={{
            paddingInlineStart: "var(--pf-v6-c-page__main-section--PaddingInlineStart)",
            paddingInlineEnd: "var(--pf-v6-c-page__main-section--PaddingInlineEnd)",
          }}
        >
          <Alert
            isExpandable
            customIcon={<InfoAltIcon />}
            variant="danger"
            title={t("pipeline:pipelineFailureMsg")}
          >
            <p>{pipeline.errorMessage}</p>
          </Alert>
        </PageSection>
      )}
      <PageSection type="tabs" isWidthLimited>
        <Tabs
          activeKey={activeTabKey}
          onSelect={handleTabClick}
          usePageInsets
          id="pipeline-details-tabs"
        >
          <Tab
            eventKey={"overview"}
            title={overviewTabTitle}
            tabContentId={`tabContent${"overview"}`}
          />
          {isPipelineTabEnabled("action") && (
            <Tab
              eventKey={"action"}
              title={actionTabTitle}
              tabContentId={`tabContent${"action"}`}
              isDisabled={pipeline?.status === "FAILED"}
            />
          )}
          {isPipelineTabEnabled("monitoring") && (
            <Tab
              eventKey={"monitoring"}
              title={monitoringTabTitle}
              tabContentId={`tabContent${"monitoring"}`}
              isDisabled={pipeline?.status === "FAILED"}
            />
          )}
          {isPipelineTabEnabled("logs") && (
            <Tab
              eventKey={"logs"}
              title={logsTabTitle}
              tabContentId={`tabContent${"logs"}`}
            />
          )}
          <Tab
            eventKey={"edit"}
            title={editTabTitle}
            tabContentId={`tabContent${"edit"}`}
          />

        </Tabs>
      </PageSection>
      <PageSection isWidthLimited isFilled>
        <TabContent
          key={"overview"}
          eventKey={"overview"}
          id={`tabContent${"overview"}`}
          activeKey={activeTabKey}
          hidden={"overview" !== activeTabKey}
        >
          <TabContentBody>
            {pipeline && (
              <PipelineOverview
                pipelineId={pipelineId || ""}
                activeTabKey={activeTabKey}
                pipeline={pipeline}
              />
            )}
          </TabContentBody>
        </TabContent>
        {isPipelineTabEnabled("logs") && (
          <TabContent
            key={"logs"}
            eventKey={"logs"}
            id={`tabContent${"logs"}`}
            activeKey={activeTabKey}
            hidden={"logs" !== activeTabKey}
          >
            <TabContentBody>
              <PipelineLog
                activeTabKey={activeTabKey}
                pipelineId={pipelineId}
                pipelineName={pipeline?.name || ""}
              />
            </TabContentBody>
          </TabContent>
        )}
        <TabContent
          key={"edit"}
          eventKey={"edit"}
          id={`tabContent${"edit"}`}
          activeKey={activeTabKey}
          hidden={"edit" !== activeTabKey}
          className="pipeline-details__tab-error"
        >
          <TabContentBody className="pipeline-details__tab-error">
            {pipeline?.id && stablePipelineSource && stablePipelineDestination && (
              <PipelineDesignerEdit
                pipelineSource={stablePipelineSource}
                pipelineDestination={stablePipelineDestination}
                transforms={stableTransforms ?? EMPTY_TRANSFORMS}
                name={pipeline.name}
                desc={pipeline.description || ""}
                definedLogLevel={pipeline.logLevel}
                definedLogLevels={stableLogLevels ?? EMPTY_LOG_LEVELS}
                pipelineId={pipeline.id}
              />
            )}
          </TabContentBody>
        </TabContent>
        {isPipelineTabEnabled("action") && (
          <TabContent
            key={"action"}
            eventKey={"action"}
            id={`tabContent${"action"}`}
            activeKey={activeTabKey}
            hidden={"action" !== activeTabKey}
          >
            <TabContentBody>
              <PipelineAction pipelineId={pipelineId} sourceId={pipeline?.source.id} activeTabKey={activeTabKey} />
            </TabContentBody>
          </TabContent>
        )}
        {isPipelineTabEnabled("monitoring") && (
          <TabContent
            key={"monitoring"}
            eventKey={"monitoring"}
            id={`tabContent${"monitoring"}`}
            activeKey={activeTabKey}
            hidden={"monitoring" !== activeTabKey}
          >
            <TabContentBody>
              <PipelineMonitoring pipelineName={pipeline?.name || ""} activeTabKey={activeTabKey} />
            </TabContentBody>
          </TabContent>
        )}
      </PageSection>
    </>
  );
};

export { PipelineDetails };
