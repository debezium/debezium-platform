import {
  Bullseye,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
} from "@patternfly/react-core";
import { PlusCircleIcon } from "@patternfly/react-icons";
import { ComponentType, FC, ReactNode } from "react";

interface EmptyStatusProps {
  heading: string;
  primaryMessage: string;
  secondaryMessage: string;
  primaryAction: ReactNode;
  icon?: ComponentType<unknown>;
  secondaryActions?: ReactNode;
}

const EmptyStatus: FC<EmptyStatusProps> = ({
  heading,
  primaryMessage,
  secondaryMessage,
  primaryAction,
  icon,
  secondaryActions,
}) => {
  return (
    <Bullseye>
  <EmptyState
    variant={EmptyStateVariant.lg}
    titleText={heading}
    headingLevel="h4"
    icon={icon || PlusCircleIcon}
    style={{ marginTop: '-250px' }}
   >
    <EmptyStateBody>
       <Content component="p">{primaryMessage}</Content>
       <Content component={ContentVariants.small}>{secondaryMessage}</Content>
    </EmptyStateBody>
    <EmptyStateFooter>
      {primaryAction}
      <EmptyStateActions>{secondaryActions}</EmptyStateActions>
    </EmptyStateFooter>
   </EmptyState>
    </Bullseye>
 
  );
};

export default EmptyStatus;
