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
import WelcomeFlow from "@components/dataFlow/WelcomeFlow";

const PipelineEmpty: React.FunctionComponent = () => {
  const navigate = useNavigate();

  const navigateTo = (url: string) => {
    navigate(url);
  };

  return (
    <PageSection isFilled>
      <EmptyState
        titleText="Welcome to Stage"
        headingLevel="h1"
        // variant={EmptyStateVariant.full}
        isFullHeight
      >
        <EmptyStateBody>
          <Content component="p">
            Stage UI provide a visual tool to setup and operate with data
            pipelines where can you define the source, the destination, and any
            data transformations.
          </Content>
          <Content component={ContentVariants.small}>
            Add a pipeline to stream change event from a pipeline source
            database. To create a pipeline, you can select a already configured
            or add a new source and a destination.
          </Content>

          <Card style={{ height: "300px" }} isPlain>
            <CardBody isFilled>
              <WelcomeFlow />
            </CardBody>
          </Card>
        </EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button
              variant="primary"
              onClick={() => navigateTo(`/pipeline/pipeline_designer`)}
            >
              Create your first pipeline
            </Button>
          </EmptyStateActions>
          <EmptyStateActions>
            <Button variant="link" onClick={() => navigateTo("/source")}>
              Go to source
            </Button>
            <Button variant="link" onClick={() => navigateTo("/destination")}>
              Go to Destination
            </Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    </PageSection>
  );
};

export { PipelineEmpty };
