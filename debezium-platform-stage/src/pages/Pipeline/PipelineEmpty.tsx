import * as React from "react";
import {
  Button,
  Card,
  CardBody,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  PageSection,
} from "@patternfly/react-core";

import { useNavigate } from "react-router-dom";
import WelcomeFlow from "@components/pipelineDesigner/WelcomeFlow";
import { ReactFlowProvider } from "reactflow";
import { useTranslation } from 'react-i18next';

const PipelineEmpty: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navigateTo = (url: string) => {
    navigate(url);
  };

  return (
    <PageSection isFilled>
      <EmptyState titleText={t('pipeline:pipelinePage.welcomeTitle')} headingLevel="h1" isFullHeight>
        <EmptyStateBody>
          <Content component="p">
          {t('pipeline:pipelinePage.welcomeDescription')}
          </Content>
          <Content component={ContentVariants.small}>
          {t('pipeline:pipelinePage.welcomeDescriptionSufix')}
          </Content>

          <Card style={{ height: "300px" }} isPlain>
            <CardBody isFilled>
              <ReactFlowProvider>
                <WelcomeFlow />
              </ReactFlowProvider>
            </CardBody>
          </Card>
        </EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button
              variant="primary"
              onClick={() => navigateTo(`/pipeline/pipeline_designer`)}
            >
              {t('pipeline:pipelinePage.welcomeButtom')}
            </Button>
          </EmptyStateActions>
          <EmptyStateActions>
            <Button variant="link" onClick={() => navigateTo("/source")}>
            {t('source')}
            </Button>
            <Button variant="link" onClick={() => navigateTo("/transform")}>
            {t('transform')}
            </Button>
            <Button variant="link" onClick={() => navigateTo("/destination")}>
            {t('destination')}
            </Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    </PageSection>
  );
};

export { PipelineEmpty };
