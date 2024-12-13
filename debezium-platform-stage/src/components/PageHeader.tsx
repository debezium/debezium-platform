import { PageSection, Content } from "@patternfly/react-core";

interface PageHeaderProps {
  title: string;
  description: string;
}

const PageHeader = ({
  title,
  description,
}: PageHeaderProps) => {
  return (
    <PageSection isWidthLimited>
      <Content component="h1">{title}</Content>
     
        <Content component="p">{description}</Content>
    </PageSection>
  );
};

export default PageHeader;
