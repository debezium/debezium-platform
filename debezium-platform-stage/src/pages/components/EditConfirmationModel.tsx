import { useState } from "react";
import {
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Radio,
    Label,
    Flex,
    FlexItem,
} from "@patternfly/react-core";
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
    usedInCount?: number;
    onSaveAsCopy?: () => void;
}

const EditConfirmationModel = ({
    type,
    isWarningOpen,
    setIsWarningOpen,
    pendingSave,
    setPendingSave,
    handleEdit,
    usedInCount = 0,
    onSaveAsCopy,
}: EditConfirmationModelProps) => {
    const { t } = useTranslation();
    const showCopyChoice = type === "transform" && usedInCount > 0 && !!onSaveAsCopy;
    const [saveChoice, setSaveChoice] = useState<"copy" | "update">("copy");

    const resetAndClose = () => {
        setSaveChoice("copy");
        setPendingSave(null);
        setIsWarningOpen(false);
    };

    const onContinue = () => {
        if (showCopyChoice && saveChoice === "copy") {
            onSaveAsCopy?.();
            resetAndClose();
            return;
        }
        if (pendingSave) {
            handleEdit(pendingSave.values, pendingSave.setError);
        }
        resetAndClose();
    };

    return (
        <Modal
            isOpen={isWarningOpen}
            variant="small"
            aria-describedby="modal-title-icon-description"
            aria-labelledby="title-icon-modal-title"
            onClose={resetAndClose}
        >
            <ModalHeader
                title={
                    showCopyChoice
                        ? t("transform:editConfirmation.title")
                        : t("pipeline:editConfirmationModel.title", { val: type.charAt(0).toUpperCase() + type.slice(1) })
                }
                titleIconVariant="info"
                labelId="title-icon-modal-title"
            />
            <ModalBody>
                {showCopyChoice ? (
                    <>
                        <Radio
                            id="transform-save-as-copy"
                            name="transform-save-choice"
                            isChecked={saveChoice === "copy"}
                            onChange={() => setSaveChoice("copy")}
                            label={
                                <Flex spaceItems={{ default: "spaceItemsSm" }} alignItems={{ default: "alignItemsCenter" }}>
                                    <FlexItem>{t("transform:editConfirmation.saveAsCopy")}</FlexItem>
                                    <FlexItem>
                                        <Label color="green">{t("recommended")}</Label>
                                    </FlexItem>
                                </Flex>
                            }
                            description={t("transform:editConfirmation.saveAsCopyDescription")}
                        />
                        <div style={{ marginTop: "1rem" }}>
                            <Radio
                                id="transform-update-shared"
                                name="transform-save-choice"
                                isChecked={saveChoice === "update"}
                                onChange={() => setSaveChoice("update")}
                                label={t("transform:editConfirmation.updateShared")}
                                description={t("transform:editConfirmation.updateSharedDescription")}
                            />
                        </div>
                    </>
                ) : (
                    t("pipeline:editConfirmationModel.description", { val: type })
                )}
            </ModalBody>
            <ModalFooter>
                <Button key="confirm" variant="primary" onClick={onContinue}>
                    {showCopyChoice ? t("continue") : t("confirm")}
                </Button>
                <Button key="cancel" variant="link" onClick={resetAndClose}>
                    {t("cancel")}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default EditConfirmationModel;
