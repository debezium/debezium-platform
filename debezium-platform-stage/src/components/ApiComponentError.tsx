import { EmptyState, EmptyStateVariant, EmptyStateBody, EmptyStateFooter, EmptyStateActions, Button, ExpandableSection, CodeBlock, CodeBlockCode } from "@patternfly/react-core";
import { ExclamationCircleIcon, RedoIcon } from "@patternfly/react-icons";
import { useState } from "react";
import "./ApiComponentError.css";

export interface ApiComponentErrorProps {
    error: object;
    retry: () => void;
    isCompact?: boolean;
}
const ApiComponentError: React.FC<ApiComponentErrorProps> = ({ error, retry, isCompact }) => {

  const [isExpanded, setIsExpanded] = useState(false);

  const onToggle = (_event: React.MouseEvent, isExpanded: boolean) => {
    setIsExpanded(isExpanded);
  };
  
    return (
        <EmptyState className={isCompact ? "":  "api-component-error"} variant={EmptyStateVariant.xs} titleText="Failed to load database table/collection" headingLevel="h4" status="danger" icon={ExclamationCircleIcon}>
        <EmptyStateBody>
        <ExpandableSection
      toggleText={isExpanded ?  'Hide details' : 'Show details'}
      onToggle={onToggle}
      isExpanded={isExpanded}
    >
      <CodeBlock style={{textAlign: 'left'}} >
      <CodeBlockCode id="code-content">{JSON.stringify(error, null, 2)}</CodeBlockCode>
    </CodeBlock>
    </ExpandableSection>
          </EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button variant="link" icon={<RedoIcon />} onClick={retry}>Retry</Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    )
}

export default ApiComponentError;