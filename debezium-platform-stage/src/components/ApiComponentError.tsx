import { EmptyState, EmptyStateVariant, EmptyStateBody, EmptyStateFooter, EmptyStateActions, Button } from "@patternfly/react-core";
import { ExclamationCircleIcon, RedoIcon } from "@patternfly/react-icons";

export interface ApiComponentErrorProps {
    error: string;
}
const ApiComponentError: React.FC<ApiComponentErrorProps> = ({ error }) => {
    return (
        <EmptyState variant={EmptyStateVariant.xs} titleText="Failed to load database table/collection" headingLevel="h4" status="danger" icon={ExclamationCircleIcon}>
        <EmptyStateBody>{error}</EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button variant="link" icon={<RedoIcon />} >Retry</Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    )
}

export default ApiComponentError;