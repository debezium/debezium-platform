import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from "@patternfly/react-core";
import { useTranslation } from "react-i18next";

export type EditConfirmationModelProps = {
    type: "source" | "destination" | "transform" | "connection";
    isWarningOpen: boolean;
    setIsWarningOpen: (isWarningOpen: boolean) => void;
    pendingSave: {
        values: Record<string, string>;
        setError: (fieldId: string, error: string | undefined) => void;
    } | null;
    setPendingSave: (pendingSave: {
        values: Record<string, string>;
        setError: (fieldId: string, error: string | undefined) => void;
    } | null) => void;
    handleEdit: (values: Record<string, string>, setError: (fieldId: string, error: string | undefined) => void) => void;

}

const EditConfirmationModel = ({ type, isWarningOpen, setIsWarningOpen, pendingSave, setPendingSave, handleEdit }: EditConfirmationModelProps) => {
    const { t } = useTranslation();

    return (
        <Modal
            isOpen={isWarningOpen}
            variant="small"
            aria-describedby="modal-title-icon-description"
            aria-labelledby="title-icon-modal-title"
            onClose={() => setIsWarningOpen(false)}
        >
            <ModalHeader title={t("pipeline:editConfirmationModel.title", { val: type.charAt(0).toUpperCase() + type.slice(1) })} titleIconVariant="info" labelId="title-icon-modal-title" />
            <ModalBody>
                {t("pipeline:editConfirmationModel.description", { val: type })}
            </ModalBody>
            <ModalFooter>
                <Button key="confirm" variant="primary" onClick={() => {
                    if (pendingSave) {
                        handleEdit(pendingSave.values, pendingSave.setError);
                        setPendingSave(null);
                    }
                    setIsWarningOpen(false);
                }}>
                    {t("confirm")}
                </Button>
                <Button key="cancel" variant="link" onClick={() => setIsWarningOpen(false)}>
                    {t("cancel")}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default EditConfirmationModel;