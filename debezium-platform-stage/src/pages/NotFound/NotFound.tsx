import * as React from "react";
import {
  Button,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  PageSection,
} from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { RouteIcon, TimesCircleIcon } from "@patternfly/react-icons";
// import { useDocumentTitle } from '../../utils/useDocumentTitle';

const NotFound: React.FunctionComponent = () => {
  const navigate = useNavigate();

  const navigateTo = (url: string) => {
    navigate(url);
  };

  return (
    <PageSection>
      <EmptyState
        variant={EmptyStateVariant.full}
        titleText={
          <>
            <TimesCircleIcon /> 404: Page Not Found
          </>
        }
        headingLevel="h4"
        icon={RouteIcon}
      >
        <EmptyStateBody>
          <>
            <Content component="p">
              We didn't find a page that matches the address you navigated to.
            </Content>
            <Content component={ContentVariants.small}>
              Please click on the button below to get back to the path, click on
              'Take me home' button to get to the home page or any other page
              from secondary action button.
            </Content>
          </>
        </EmptyStateBody>
        <EmptyStateFooter>
          <Button onClick={() => navigateTo("/")}>Take me home</Button>
          <EmptyStateActions>
            <Button variant="link" onClick={() => navigateTo("/source")}>
              Source
            </Button>
            <Button variant="link" onClick={() => navigateTo("/destination")}>
              Destination
            </Button>
            <Button variant="link" onClick={() => navigateTo("/pipeline")}>
              Pipeline
            </Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    </PageSection>
  );
};

export { NotFound };
