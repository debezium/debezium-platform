/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Content,
  PageSection,
  Tab,
  TabContent,
  TabContentBody,
  Tabs,
  TabTitleText,
} from "@patternfly/react-core";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchDataTypeTwo, Pipeline } from "../../apis/apis";
import { API_URL } from "../../utils/constants";

import "./PipelineDetails.css";
import PipelineLog from "./PipelineLog";
import PipelineOverview from "./PipelineOverview";
import { PipelineDesignerEdit } from "./PipelineDesignerEdit";
import { useTranslation } from 'react-i18next';
import PipelineAction from "./PipelineAction";

const PipelineDetails: React.FunctionComponent = () => {
  const { pipelineId, detailsTab } = useParams<{
    pipelineId: string;
    detailsTab: string;
  }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTabKey, setActiveTabKey] = React.useState("overview");

  const [pipeline, setPipeline] = useState<Pipeline>();

  const [isFetchLoading, setIsFetchLoading] = useState<boolean>(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (detailsTab === "overview") {
      setActiveTabKey;
    } else if (detailsTab === "logs") {
      setActiveTabKey("logs");
    } else if (detailsTab === "edit") {
      setActiveTabKey("edit");
    } else if (detailsTab === "action") {
      setActiveTabKey("action");
    }
  }, [detailsTab]);

  useEffect(() => {
    const fetchPipeline = async () => {
      setIsFetchLoading(true);
      const response = await fetchDataTypeTwo<Pipeline>(
        `${API_URL}/api/pipelines/${pipelineId}`
      );

      if (response.error) {
        setError(response.error);
      } else {
        setPipeline(response.data as Pipeline);
      }

      setIsFetchLoading(false);
    };

    fetchPipeline();
  }, [pipelineId]);

  // Toggle currently active tab and update the URL
  const handleTabClick = (_event: any, tabIndex: string | number) => {
    const selectedTab = tabIndex as string;
    setActiveTabKey(selectedTab);

    // Update the URL without reloading the page
    navigate(`/pipeline/${pipelineId}/${selectedTab}`);
  };

  if (isFetchLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      <PageSection isWidthLimited>
        <Content component="h1"> {pipeline?.name}</Content>
        <Content component="p">
          {t("pipeline:overview.description", {val: pipeline?.name || ""})}
        </Content>
      </PageSection>
      <PageSection type="tabs" isWidthLimited>
        <Tabs
          activeKey={activeTabKey}
          onSelect={handleTabClick}
          usePageInsets
          id="open-tabs-example-tabs-list"
        >
          <Tab
            eventKey={"overview"}
            title={<TabTitleText>{t('pipeline:tabs.overview')}</TabTitleText>}
            tabContentId={`tabContent${"overview"}`}
          />
          <Tab
            eventKey={"logs"}
            title={<TabTitleText>{t('pipeline:tabs.log')}</TabTitleText>}
            tabContentId={`tabContent${"logs"}`}
          />

          <Tab
            eventKey={"action"}
            title={<TabTitleText>Pipeline actions</TabTitleText>}
            tabContentId={`tabContent${"action"}`}
          />
          <Tab
            eventKey={"edit"}
            title={<TabTitleText>{t('pipeline:tabs.edit')}</TabTitleText>}
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
            <PipelineOverview pipelineId={pipelineId || ""} />
          </TabContentBody>
        </TabContent>
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
                pipelineId={pipeline.id}
              />
            )}
          </TabContentBody>
        </TabContent>
        <TabContent
          key={"action"}
          eventKey={"action"}
          id={`tabContent${"action"}`}
          activeKey={activeTabKey}
          hidden={"action" !== activeTabKey}
        >
          <TabContentBody>
            <PipelineAction/>
          </TabContentBody>
        </TabContent>
      </PageSection>
    </>
  );
};

export { PipelineDetails };
