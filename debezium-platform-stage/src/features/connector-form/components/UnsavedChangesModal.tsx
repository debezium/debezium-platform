import { Modal, ModalBody, ModalFooter, ModalHeader, Button } from '@patternfly/react-core';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({
  isOpen,
  onConfirm,
  onCancel,
}: UnsavedChangesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      variant="small"
      onClose={onCancel}
      aria-label="Unsaved changes confirmation"
    >
      <ModalHeader title="Unsaved changes" />
      <ModalBody>
        You have unsaved changes. Are you sure you want to leave this page? Your
        changes will be lost.
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={onConfirm}>
          Leave page
        </Button>
        <Button variant="link" onClick={onCancel}>
          Stay on page
        </Button>
      </ModalFooter>
    </Modal>
  );
}
