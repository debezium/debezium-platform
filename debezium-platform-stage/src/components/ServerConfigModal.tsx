import { Modal, ModalVariant, ModalHeader, ModalBody, ModalFooter, Button, MultipleFileUpload, MultipleFileUploadMain, MultipleFileUploadStatus, MultipleFileUploadStatusItem, Alert, AlertActionCloseButton, DropEvent, ProgressStep, ProgressStepper, TextArea } from "@patternfly/react-core";
import { ErrorCircleOIcon, InProgressIcon, MinusCircleIcon, PendingIcon, UploadIcon } from "@patternfly/react-icons";
import { useMemo, useState, useEffect } from "react";
import { FileRejection } from 'react-dropzone';
import { faker } from '@faker-js/faker';
import "./ServerConfigModal.css"
import { extractTransformsAndPredicates, formatCode, splitConnectionProperties } from "@utils/formatCodeUtils";
import { createPost, fetchData, Connection, ConnectionsSchema, Destination, Payload, Source, Transform, TransformData } from "src/apis";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";
import { getConnectorTypeName } from "@utils/helpers";
import { useTranslation } from "react-i18next";


interface ServerConfigModalProps {
    isModalOpen: boolean;
    toggleModal: (event: KeyboardEvent | React.MouseEvent<Element>) => void;
    updateSelectedSource: (source: Source) => void;
    updateSelectedDestination: (destination: Destination) => void;
    handleAddTransform: (transform: TransformData[]) => void;
}

interface readFile {
    fileName: string;
    data?: string;
    loadResult?: 'danger' | 'success';
    loadError?: DOMException;
}

type PipelineResourceType = "source_connection" | "source" | "transform" | "destination_connection" | "destination" | "" | "done";

const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
    isModalOpen,
    toggleModal,
    updateSelectedSource,
    updateSelectedDestination,
    handleAddTransform
}) => {
    const { t } = useTranslation();
    const { addNotification } = useNotification();

    const [currentFiles, setCurrentFiles] = useState<File[]>([]);
    const [readFileData, setReadFileData] = useState<readFile[]>([]);
    const [modalText, setModalText] = useState('');

    const [createdSource, setCreatedSource] = useState<Source | null>(null);
    const [createdTransform, setCreatedTransform] = useState<Transform[] | null>(null);
    const [createdTransformData, setCreatedTransformData] = useState<TransformData[] | null>(null);
    const [createdDestination, setCreatedDestination] = useState<Destination | null>(null);


    const [createPipelineResource, setCreatePipelineResource] = useState<PipelineResourceType>("");
    const [createdPipelineResources, setCreatedPipelineResources] = useState<PipelineResourceType[]>([]);
    const [dbzServerFileConfig, setDbzServerFileConfig] = useState<string | object>("");

    const [connectionsSchemas, setConnectionsSchemas] = useState<ConnectionsSchema[]>([]);
    const [createdSourceConnection, setCreatedSourceConnection] = useState<Connection | null>(null);
    const [createdDestConnection, setCreatedDestConnection] = useState<Connection | null>(null);
    const [sourceConnectionSupported, setSourceConnectionSupported] = useState<boolean | null>(null);
    const [destConnectionSupported, setDestConnectionSupported] = useState<boolean | null>(null);


    const [creationError, setCreationError] = useState<{ step: PipelineResourceType; message: string } | null>(null);
    // Number of transforms declared in the uploaded file, set once the transform step runs.
    const [transformCount, setTransformCount] = useState<number | null>(null);

    useEffect(() => {
        if (!isModalOpen) return;
        fetchData<ConnectionsSchema[]>(`${API_URL}/api/connections/schemas`)
            .then(setConnectionsSchemas)
            .catch(() => { /* silent — all connector types fall back to full config */ });
    }, [isModalOpen]);

    const statusIcon = useMemo(() => {
        if (readFileData.length < currentFiles.length) {
            return 'inProgress';
        } else if (readFileData.every((file) => file.loadResult === 'success')) {
            return 'success';
        } else {
            return 'danger';
        }
    }, [readFileData, currentFiles]);

    const showStatus = useMemo(() => {
        return currentFiles.length > 0;
    }, [currentFiles]);
    // remove files from both state arrays based on their name
    const removeFiles = (namesOfFilesToRemove: string[]) => {
        const newCurrentFiles = currentFiles.filter(
            (currentFile) => !namesOfFilesToRemove.some((fileName) => fileName === currentFile.name)
        );
        setCurrentFiles(newCurrentFiles);
        const newReadFiles = readFileData.filter(
            (readFile) => !namesOfFilesToRemove.some((fileName) => fileName === readFile.fileName)
        );
        setReadFileData(newReadFiles);
    };
    // callback that will be called by the react dropzone with the newly dropped file objects
    const handleFileDrop = (_event: DropEvent, droppedFiles: File[]) => {
        // identify what, if any, files are re-uploads of already uploaded files
        const currentFileNames = currentFiles.map((file) => file.name);
        const reUploads = droppedFiles.filter((droppedFile) => currentFileNames.includes(droppedFile.name));
        /** this promise chain is needed because if the file removal is done at the same time as the file adding react
         * won't realize that the status items for the re-uploaded files needs to be re-rendered */
        Promise.resolve()
            .then(() => removeFiles(reUploads.map((file) => file.name)))
            .then(() => setCurrentFiles((prevFiles) => [...prevFiles, ...droppedFiles]));
    };
    // callback called by the status item when a file is successfully read with the built-in file reader
    const handleReadSuccess = (data: string, file: File) => {
        // Extract the Base64 part from the data URI
        const base64Data = data.split(",")[1]; 
        // Decode the Base64 string
        const decodedData = atob(base64Data);
        // Update the state with the decoded data
        setReadFileData((prevReadFiles) => [
            ...prevReadFiles,
            { data: decodedData, fileName: file.name, loadResult: "success" },
        ]);
        setDbzServerFileConfig(decodedData);
        setModalText("");
    };
    // callback called by the status item when a file encounters an error while being read with the built-in file reader
    const handleReadFail = (error: DOMException, file: File) => {
        setReadFileData((prevReadFiles) => [
            ...prevReadFiles,
            { loadError: error, fileName: file.name, loadResult: 'danger' }
        ]);
    };
    // dropzone prop that communicates to the user that files they've attempted to upload are not an appropriate type
    const handleDropRejected = (fileRejections: FileRejection[]) => {
        if (fileRejections.length === 1) {
            setModalText(t('pipeline:debeziumServerModal.nonSupportedFilesMsg',{val: fileRejections[0].file.name}));
        } else {
            const rejectedMessages = fileRejections.reduce(
                (acc, fileRejection) => (acc += `${fileRejection.file.name}, `),
                ''
            );
            setModalText(t('pipeline:debeziumServerModal.nonSupportedFilesMsg',{val: rejectedMessages}));
        }
    };
    const successfullyReadFileCount = readFileData.filter((fileData) => fileData.loadResult === 'success').length;

    const createNewSource = async (payload: Payload, resourceType: PipelineResourceType): Promise<boolean> => {
        const response = await createPost(`${API_URL}/api/${resourceType}s`, payload);
        const resourceLabel = resourceType === "source"
            ? t('pipeline:debeziumServerModal.sourceLabel')
            : t('pipeline:debeziumServerModal.destinationLabel');
        if (response.error) {
            const message = t('pipeline:debeziumServerModal.resourceCreationFailedMessage', {
                name: payload.name,
                resource: resourceType,
                error: response.error,
            });
            setCreationError({ step: resourceType, message });
            addNotification("danger", t('statusMessage:creation.failedTitle', { val: resourceLabel }), message);
            return false;
        }
        resourceType === "source" && setCreatedSource(response.data as Source);
        resourceType === "source" && updateSelectedSource(response.data as Source);
        resourceType === "destination" && setCreatedDestination(response.data as Destination);
        resourceType === "destination" && updateSelectedDestination(response.data as Destination);
        addNotification(
            "success",
            t('statusMessage:creation.successTitle', { val: resourceLabel }),
            t('statusMessage:creation.successDescription', { val: `${resourceType} "${(response.data as Source).name}"` })
        );
        setCreatedPipelineResources((prevResources) => [...prevResources, resourceType]);
        return true;
    };



    const [isCreationLoading, setIsCreationLoading] = useState(false);

    const findConnectionSchema = (connectorType: string): ConnectionsSchema | undefined => {
        const norm = connectorType.toLowerCase().replace(/-/g, "_");
        return connectionsSchemas.find(s =>
            norm.includes(s.type.toLowerCase().replace(/-/g, "_"))
        );
    };

    const createPipelineSource = async (): Promise<boolean> => {
        const sourcePayload = formatCode("source", "properties-file", dbzServerFileConfig);
        const matchedSchema = findConnectionSchema(sourcePayload.type);

        if (matchedSchema) {
            setCreatePipelineResource("source_connection");
            const { connectionConfig, remainingConfig } =
                splitConnectionProperties(sourcePayload.config, Object.keys(matchedSchema.schema.properties));

            if (Object.keys(connectionConfig).length > 0) {
                const connName = `dbz-src-conn-${faker.word.noun()}-${faker.number.int(1000)}`;
                const connResponse = await createPost<Connection>(`${API_URL}/api/connections`, {
                    name: connName,
                    type: matchedSchema.type,
                    config: connectionConfig,
                });
                if (connResponse.error) {
                    const message = t('pipeline:debeziumServerModal.sourceConnectionFailedMessage', {
                        name: connName,
                        error: connResponse.error,
                    });
                    setCreationError({ step: "source_connection", message });
                    addNotification(
                        "danger",
                        t('statusMessage:creation.failedTitle', { val: t('pipeline:debeziumServerModal.sourceConnectionStep') }),
                        message
                    );
                    return false;
                }
                const conn = connResponse.data as Connection;
                setCreatedSourceConnection(conn);
                setCreatedPipelineResources(prev => [...prev, "source_connection"]);
                sourcePayload.config = remainingConfig;
                sourcePayload.connection = { id: conn.id, name: conn.name };
            } else {
                // schema matched but no overlapping keys in file — mark step done silently
                setCreatedPipelineResources(prev => [...prev, "source_connection"]);
            }
        }

        setCreatePipelineResource("source");
        const name = `dbz-${faker.word.verb()}-${faker.word.noun()}-${faker.number.int(1000)}`;
        sourcePayload.name = name;
        return await createNewSource(sourcePayload, "source");
    };

    const createNewTransform = async (payload: Payload): Promise<TransformData | null> => {
        const response = await createPost(`${API_URL}/api/transforms`, payload) as { data: TransformData | null, error: string | null };
        if (response.error) {
            const message = t('pipeline:debeziumServerModal.transformFailedMessage', {
                name: payload.name,
                error: response.error,
            });
            setCreationError({ step: "transform", message });
            addNotification("danger", t('statusMessage:creation.failedTitle', { val: t('transforms') }), message);
            return null;
        }
        addNotification(
            "success",
            t('statusMessage:creation.successTitle', { val: t('transforms') }),
            t('statusMessage:creation.successDescription', { val: `${t('transforms')} "${(response.data as TransformData).name}"` })
        );
        return response.data as TransformData;
    };

    const createPipelineTransform = async (): Promise<boolean> => {
        setCreatePipelineResource("transform");
        const transformPayloads = extractTransformsAndPredicates(dbzServerFileConfig);
        setTransformCount(transformPayloads.length);

        const addedTransforms: TransformData[] = [];
        for (const transformPayload of transformPayloads) {
            const transform = await createNewTransform(transformPayload);
            if (!transform) {
                return false;
            }
            addedTransforms.push(transform);
        }

        if (addedTransforms.length > 0) {
            const updatedCreatedTransform = addedTransforms.map((transform) => ({ name: transform.name, id: transform.id } as Transform));
            setCreatedTransform([...(createdTransform || []), ...updatedCreatedTransform]);
            setCreatedTransformData([...(createdTransformData || []), ...addedTransforms]);
            handleAddTransform(addedTransforms);
        }
        setCreatedPipelineResources((prevResources) => [...prevResources, "transform"]);
        return true;
    }

    const createPipelineDestination = async (): Promise<boolean> => {
        const destinationPayload = formatCode("destination", "properties-file", dbzServerFileConfig);
        const matchedSchema = findConnectionSchema(destinationPayload.type);

        if (matchedSchema) {
            setCreatePipelineResource("destination_connection");
            const { connectionConfig, remainingConfig } =
                splitConnectionProperties(destinationPayload.config, Object.keys(matchedSchema.schema.properties));

            if (Object.keys(connectionConfig).length > 0) {
                const connName = `dbz-dest-conn-${faker.word.adjective()}-${faker.number.int(1000)}`;
                const connResponse = await createPost<Connection>(`${API_URL}/api/connections`, {
                    name: connName,
                    type: matchedSchema.type,
                    config: connectionConfig,
                });
                if (connResponse.error) {
                    const message = t('pipeline:debeziumServerModal.destConnectionFailedMessage', {
                        name: connName,
                        error: connResponse.error,
                    });
                    setCreationError({ step: "destination_connection", message });
                    addNotification(
                        "danger",
                        t('statusMessage:creation.failedTitle', { val: t('pipeline:debeziumServerModal.destConnectionStep') }),
                        message
                    );
                    return false;
                }
                const conn = connResponse.data as Connection;
                setCreatedDestConnection(conn);
                setCreatedPipelineResources(prev => [...prev, "destination_connection"]);
                destinationPayload.config = remainingConfig;
                destinationPayload.connection = { id: conn.id, name: conn.name };
            } else {
                setCreatedPipelineResources(prev => [...prev, "destination_connection"]);
            }
        }

        setCreatePipelineResource("destination");
        const name = `dbz-${faker.word.adjective()}-${faker.animal.type()}-${faker.number.int(1000)}`;
        destinationPayload.name = name;
        const success = await createNewSource(destinationPayload, "destination");
        if (success) {
            setCreatePipelineResource("done");
        }
        return success;
    };

    const handleCreatePipelineResource = async () => {
        setIsCreationLoading(true);
        setCreationError(null);
        const srcPayloadPreview = formatCode("source", "properties-file", dbzServerFileConfig);
        const dstPayloadPreview = formatCode("destination", "properties-file", dbzServerFileConfig);
        setSourceConnectionSupported(!!findConnectionSchema(srcPayloadPreview.type));
        setDestConnectionSupported(!!findConnectionSchema(dstPayloadPreview.type));
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (!(await createPipelineSource())) {
            setIsCreationLoading(false);
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (!(await createPipelineTransform())) {
            setIsCreationLoading(false);
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (!(await createPipelineDestination())) {
            setIsCreationLoading(false);
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        setIsCreationLoading(false);
    };

    const getTransformNames = () => {
        return createdTransform?.map((transform) => transform.name).join(", ") || "";
    }

    // Single source of truth for a step's visual state
    type StepStatus = "pending" | "current" | "success" | "skipped" | "danger";

    const getStepStatus = (stepKey: PipelineResourceType, schemaSupported?: boolean | null): StepStatus => {
        if (schemaSupported === false) return "skipped";
        if (creationError?.step === stepKey) return "danger";
        if (createdPipelineResources.includes(stepKey)) return "success";
        if (createPipelineResource === stepKey) return "current";
        return "pending";
    };

    const STEP_VARIANT: Record<StepStatus, "pending" | "success" | "danger" | "default" | undefined> = {
        pending: "pending",
        current: undefined,
        success: "success",
        skipped: "default",
        danger: "danger",
    };

    const stepIcon = (status: StepStatus) => {
        switch (status) {
            case "pending": return <PendingIcon />;
            case "current": return <InProgressIcon />;
            case "skipped": return <MinusCircleIcon />;
            case "danger": return <ErrorCircleOIcon />;
            case "success": default: return undefined;
        }
    };

    const closeModal = (event: KeyboardEvent | React.MouseEvent<Element>) => {
        toggleModal(event);
        setCurrentFiles([]);
        setReadFileData([]);
        setCreatedSourceConnection(null);
        setCreatedDestConnection(null);
        setSourceConnectionSupported(null);
        setDestConnectionSupported(null);
        setCreationError(null);
        setTransformCount(null);
    };

    const sourceConnStatus = getStepStatus("source_connection", sourceConnectionSupported);
    const sourceStatus = getStepStatus("source");
    const transformStatus = getStepStatus("transform");
    const destConnStatus = getStepStatus("destination_connection", destConnectionSupported);
    const destStatus = getStepStatus("destination");

    return (
        <Modal
            variant={ModalVariant.large}
            isOpen={isModalOpen}
            onClose={closeModal}
            aria-labelledby="debezium-server-config-modal"
            aria-describedby="debezium-server-config-modal"
        >
            <ModalHeader
                title={t('pipeline:debeziumServerModal.title')}
                labelId="debezium-server-config-modal"
                description={t('pipeline:debeziumServerModal.description')}
            />
            <ModalBody tabIndex={0}>
                {!!modalText && <Alert
                    isInline
                    variant="warning"
                    title={t('pipeline:debeziumServerModal.nonSupportedFilesHeader')}
                    actionClose={<AlertActionCloseButton onClose={() => setModalText("")} />}
                    style={{ marginBottom: '1rem' }}
                >
                    <p>{modalText}</p>
                </Alert>}
                {!!creationError && <Alert
                    isInline
                    variant="danger"
                    title={t('pipeline:debeziumServerModal.creationStoppedTitle')}
                    style={{ marginBottom: '1rem' }}
                >
                    <p>{creationError.message}</p>
                    <p>{t('pipeline:debeziumServerModal.creationStoppedDescription')}</p>
                </Alert>}
                {showStatus ? (
                    <>
                        {createPipelineResource !== "" ? (
                            <ProgressStepper
                                aria-label={t('pipeline:debeziumServerModal.stepperAriaLabel')}
                            >
                                {/* ── Step 1: Source Connection */}
                                <ProgressStep
                                    variant={STEP_VARIANT[sourceConnStatus]}
                                    isCurrent={sourceConnStatus === "current" || undefined}
                                    icon={stepIcon(sourceConnStatus)}
                                    description={
                                        sourceConnStatus === "skipped"
                                            ? t('pipeline:debeziumServerModal.connectionSkipped')
                                            : sourceConnStatus === "danger"
                                                ? creationError?.message
                                                : createdSourceConnection
                                                    ? <>{t('pipeline:debeziumServerModal.createdSourceConnection', { val: getConnectorTypeName(createdSourceConnection.type) })} <b><i>{createdSourceConnection.name}</i></b></>
                                                    : t('pipeline:debeziumServerModal.creatingResource', { val: t('pipeline:debeziumServerModal.sourceConnectionLabel') })
                                    }
                                    id="source-connection-step"
                                    titleId="source-connection-step-title"
                                    aria-label={t('pipeline:debeziumServerModal.createSourceConnectionAriaLabel')}
                                >
                                    {t('pipeline:debeziumServerModal.sourceConnectionStep')}
                                </ProgressStep>
                                {/* ── Step 2: Source ── */}
                                <ProgressStep
                                    variant={STEP_VARIANT[sourceStatus]}
                                    isCurrent={sourceStatus === "current" || undefined}
                                    icon={stepIcon(sourceStatus)}
                                    description={
                                        sourceStatus === "danger"
                                            ? creationError?.message
                                            : createdSource
                                                ? <>{t('pipeline:debeziumServerModal.createdConnector', { val: getConnectorTypeName(createdSource?.type || "") })} <b><i>{createdSource?.name}</i></b></>
                                                : t('pipeline:debeziumServerModal.creatingResource', { val: t('pipeline:debeziumServerModal.sourceRoleLabel') })
                                    }
                                    id="source-step"
                                    titleId="source-step-title"
                                    aria-label={t('pipeline:debeziumServerModal.createSourceAriaLabel')}
                                >
                                    {t('source')}
                                </ProgressStep>
                                {/* ── Step 3: Transforms ── */}
                                <ProgressStep
                                    variant={STEP_VARIANT[transformStatus]}
                                    isCurrent={transformStatus === "current" || undefined}
                                    icon={stepIcon(transformStatus)}
                                    description={
                                        transformStatus === "danger"
                                            ? creationError?.message
                                            : transformStatus === "success"
                                                ? (transformCount === 0
                                                    ? t('pipeline:debeziumServerModal.noTransformsFound')
                                                    : <>{t('pipeline:debeziumServerModal.createdTransformsPrefix')} <b><i>{getTransformNames()}</i></b> {t('pipeline:debeziumServerModal.createdTransformsSuffix')}</>)
                                                : t('pipeline:debeziumServerModal.creatingTransform')
                                    }
                                    id="transform-step"
                                    titleId="transform-step-title"
                                    aria-label={t('pipeline:debeziumServerModal.createTransformsAriaLabel')}
                                >
                                    {t('transforms')}
                                </ProgressStep>
                                {/* ── Step 4: Destination Connection ── */}
                                <ProgressStep
                                    variant={STEP_VARIANT[destConnStatus]}
                                    isCurrent={destConnStatus === "current" || undefined}
                                    icon={stepIcon(destConnStatus)}
                                    description={
                                        destConnStatus === "skipped"
                                            ? t('pipeline:debeziumServerModal.connectionSkipped')
                                            : destConnStatus === "danger"
                                                ? creationError?.message
                                                : createdDestConnection
                                                    ? <>{t('pipeline:debeziumServerModal.createdDestConnection', { val: getConnectorTypeName(createdDestConnection.type) })} <b><i>{createdDestConnection.name}</i></b></>
                                                    : t('pipeline:debeziumServerModal.creatingResource', { val: t('pipeline:debeziumServerModal.destinationConnectionLabel') })
                                    }
                                    id="dest-connection-step"
                                    titleId="dest-connection-step-title"
                                    aria-label={t('pipeline:debeziumServerModal.createDestConnectionAriaLabel')}
                                >
                                    {t('pipeline:debeziumServerModal.destConnectionStep')}
                                </ProgressStep>
                                {/* ── Step 5: Destination ── */}
                                <ProgressStep
                                    variant={STEP_VARIANT[destStatus]}
                                    isCurrent={destStatus === "current" || undefined}
                                    icon={stepIcon(destStatus)}
                                    description={
                                        destStatus === "danger"
                                            ? creationError?.message
                                            : createdDestination
                                                ? <>{t('pipeline:debeziumServerModal.createdConnector', { val: getConnectorTypeName(createdDestination?.type || "") })} <b><i>{createdDestination?.name}</i></b></>
                                                : t('pipeline:debeziumServerModal.creatingResource', { val: t('pipeline:debeziumServerModal.destinationRoleLabel') })
                                    }
                                    id="destination-step"
                                    titleId="destination-step-title"
                                    aria-label={t('pipeline:debeziumServerModal.createDestinationAriaLabel')}
                                >
                                    {t('destination')}
                                </ProgressStep>

                            </ProgressStepper>
                        ) : (
                            <>
                                <div className="pf-v6-c-multiple-file-upload">
                                    {showStatus && (
                                        <MultipleFileUploadStatus
                                            statusToggleText={t('pipeline:debeziumServerModal.filesUploadedStatus', { uploaded: successfullyReadFileCount, total: currentFiles.length })}
                                            statusToggleIcon={statusIcon}
                                        >
                                            {currentFiles.map((file) => (
                                                <MultipleFileUploadStatusItem
                                                    file={file}
                                                    key={file.name}
                                                    onClearClick={() => removeFiles([file.name])}
                                                    onReadSuccess={handleReadSuccess}
                                                    onReadFail={handleReadFail}
                                                />
                                            ))}
                                        </MultipleFileUploadStatus>
                                    )}
                                </div>
                                <TextArea style={{ height: "300px" }} value={readFileData.map((file) => file.data).join('\n')} />
                            </>
                        )}
                    </>
                ) : (
                    <MultipleFileUpload
                        onFileDrop={handleFileDrop}
                        dropzoneProps={{
                            accept: {
                                'application/properties': ['.properties'],
                            },
                            onDropRejected: handleDropRejected
                        }}
                    >
                        <MultipleFileUploadMain
                            titleIcon={<UploadIcon />}
                            titleText={t('pipeline:debeziumServerModal.dragAndDrop')}
                            titleTextSeparator="or"
                            infoText={t('pipeline:debeziumServerModal.acceptedFiles', { val: ".properties" })}
                        />
                        {showStatus && (
                            <MultipleFileUploadStatus
                                statusToggleText={t('pipeline:debeziumServerModal.filesUploadedStatus', { uploaded: successfullyReadFileCount, total: currentFiles.length })}
                                statusToggleIcon={statusIcon}
                            >
                                {currentFiles.map((file) => (
                                    <MultipleFileUploadStatusItem
                                        file={file}
                                        key={file.name}
                                        onClearClick={() => removeFiles([file.name])}
                                        onReadSuccess={handleReadSuccess}
                                        onReadFail={handleReadFail}
                                    />
                                ))}
                            </MultipleFileUploadStatus>
                        )}
                    </MultipleFileUpload>
                )}
            </ModalBody>
            {!!showStatus && (
                <ModalFooter>
                    {createPipelineResource === "done" ? (
                        <Button key="confirm" variant="primary" onClick={toggleModal} >
                            {t('done')}
                        </Button>
                    ) : creationError ? (
                        <Button key="close-error" variant="primary" onClick={closeModal}>
                            {t('pipeline:debeziumServerModal.closeButton')}
                        </Button>
                    ) : (
                        <Button key="confirm" variant="primary" onClick={handleCreatePipelineResource} isLoading={isCreationLoading}>
                            {t('create')}
                        </Button>
                    )}
                    {!creationError && (
                        <Button key="cancel" variant="link" onClick={closeModal}>
                            {t('cancel')}
                        </Button>
                    )}
                </ModalFooter>
            )}
        </Modal>
    );
};

export default ServerConfigModal;