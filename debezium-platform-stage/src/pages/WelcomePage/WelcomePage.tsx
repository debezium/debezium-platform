import {
  PageSection,
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import React from "react";

const WelcomePage: React.FC = () => {
  return (
    <>
      <PageSection isFilled>
        <EmptyState titleText="Welcome to Stage" headingLevel="h4">
          <EmptyStateBody>
            Stage UI provide a visual tool to setup and operate with data
            pipelines where can you define the source, the destination, and any
            data transformations.
          </EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant="primary">Create a pipeline</Button>
            </EmptyStateActions>
            <EmptyStateActions>
              <Button variant="link">Source</Button>
              <Button variant="link">Destination</Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      </PageSection>
    </>
  );
};

export default WelcomePage;
