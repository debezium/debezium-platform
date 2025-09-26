import { Modal, ModalBody, ModalHeader } from "@patternfly/react-core";
import { CreateConnection } from "../Connection/CreateConnection";
import { FC } from "react";
import { ConnectionConfig } from "src/apis";
import { useTranslation } from "react-i18next";


interface CreateConnectionModalProps {
  isConnectionModalOpen: boolean;
  handleConnectionModalToggle: () => void;
  selectedConnectionType: "source" | "destination";
  // selectedConnectionId: string;
  resourceId: string | undefined;
  setSelectedConnection: (connection: ConnectionConfig) => void;
}

const CreateConnectionModal: FC<CreateConnectionModalProps> = ({ isConnectionModalOpen, handleConnectionModalToggle, selectedConnectionType, resourceId, setSelectedConnection }) => {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen={isConnectionModalOpen}
      width="80%"
      onClose={handleConnectionModalToggle}
      aria-labelledby="modal-with-description-title"
      aria-describedby="modal-box-body-destination-with-description"
    >
      <ModalHeader
        title={t("connection:create.title")}
        className="pipeline_flow-modal_header"
        labelId="modal-with-destination-description-title"
        description={t("connection:create.modalDescription", { val: selectedConnectionType })}
      />
      <ModalBody
        tabIndex={0}
        id="modal-box-body-destination-with-description"
      >
        <CreateConnection selectedConnectionType={selectedConnectionType} selectedConnectionId={resourceId} handleConnectionModalToggle={handleConnectionModalToggle} setSelectedConnection={setSelectedConnection} />

      </ModalBody>
    </Modal>
  )
}

export default CreateConnectionModal;