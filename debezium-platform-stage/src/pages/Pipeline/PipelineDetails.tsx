/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Alert,
  Button,
  Icon,
  Label,
  LabelStatus,
  PageSection,
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
} from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { buildPipelineRestartPayload } from "@utils/pipelineUtils";

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
import { RhUiPathIcon } from "@patternfly/react-icons";

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
      } else {
        setPipeline(response.data as Pipeline);
      }
      setIsFetchLoading(false);
    };

    void loadPipeline();

    return () => {
      cancelled = true;
    };
  }, [pipelineId]);

  const refreshPipeline = async () => {
    const response = await fetchDataTypeTwo<Pipeline>(
      `${API_URL}/api/pipelines/${pipelineId}`
    );

    if (response.error) {
      setError(response.error);
      return;
    }

    setPipeline(response.data as Pipeline);
  };

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
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      <PageHeader
        title={pipeline?.name}
        subtitle={pipeline?.description}
        label={pipeline?.status === "FAILED" ? <Label className="pf-v5-u-align-content-center" status={LabelStatus.danger}>  {t("failed")}</Label> : ""}
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
      {pipeline?.errorMessage && (
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
            <PipelineOverview pipelineId={pipelineId || ""} activeTabKey={activeTabKey} />
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
            {pipeline?.id && (
              <PipelineDesignerEdit
                pipelineSource={pipeline?.source}
                pipelineDestination={pipeline?.destination}
                transforms={pipeline?.transforms}
                name={pipeline?.name}
                desc={pipeline.description || ""}
                definedLogLevel={pipeline.logLevel}
                definedLogLevels={pipeline?.logLevels}
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
