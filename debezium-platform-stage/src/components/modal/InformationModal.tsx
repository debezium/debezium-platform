import {
  Button,
  ButtonProps,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from "@patternfly/react-core";
import { ReactNode } from "react";

export type InformationModalAction = {
  label: string;
  onClick: () => void;
  variant?: ButtonProps["variant"];
  isDisabled?: boolean;
  isLoading?: boolean;
};

export type InformationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  titleIconVariant?: "success" | "danger" | "warning" | "info" | "custom";
  variant?: ModalVariant;
  primaryAction: InformationModalAction;
  secondaryAction?: InformationModalAction;
  id?: string;
};

const InformationModal = ({
  isOpen,
  onClose,
  title,
  children,
  titleIconVariant = "info",
  variant = ModalVariant.small,
  primaryAction,
  secondaryAction,
  id = "information-modal",
}: InformationModalProps) => {
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;

  return (
    <Modal
      variant={variant}
      isOpen={isOpen}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
      <ModalHeader
        title={title}
        titleIconVariant={titleIconVariant}
        labelId={titleId}
      />
      <ModalBody id={bodyId}>{children}</ModalBody>
      <ModalFooter>
        <Button
          key="primary"
          variant={primaryAction.variant ?? "primary"}
          onClick={primaryAction.onClick}
          isDisabled={primaryAction.isDisabled}
          isLoading={primaryAction.isLoading}
        >
          {primaryAction.label}
        </Button>
        {secondaryAction && (
          <Button
            key="secondary"
            variant={secondaryAction.variant ?? "link"}
            onClick={secondaryAction.onClick}
            isDisabled={secondaryAction.isDisabled}
            isLoading={secondaryAction.isLoading}
          >
            {secondaryAction.label}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default InformationModal;
