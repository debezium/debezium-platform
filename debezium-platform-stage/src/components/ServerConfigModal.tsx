import { Modal, ModalVariant, ModalHeader, ModalBody, ModalFooter, Button, MultipleFileUpload, MultipleFileUploadMain, MultipleFileUploadStatus, MultipleFileUploadStatusItem, Alert, AlertActionCloseButton, DropEvent, ProgressStep, ProgressStepper, TextArea } from "@patternfly/react-core";
import { InProgressIcon, MinusCircleIcon, PendingIcon, UploadIcon } from "@patternfly/react-icons";
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
    // null = not yet determined; false = no schema (skipped); true = schema found
    const [sourceConnectionSupported, setSourceConnectionSupported] = useState<boolean | null>(null);
    const [destConnectionSupported, setDestConnectionSupported] = useState<boolean | null>(null);

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
        const base64Data = data.split(",")[1]; // Remove the "data:application/octet-stream;base64," part
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


    const createNewSource = async (payload: Payload, resourceType: PipelineResourceType) => {
        const response = await createPost(`${API_URL}/api/${resourceType}s`, payload);
        if (response.error) {
            addNotification(
                "danger",
                `${resourceType} creation failed`,
                `Failed to create ${(response.data as Source)?.name}: ${response.error}`
            );
        } else {
            resourceType === "source" && setCreatedSource(response.data as Source);
            resourceType === "source" && updateSelectedSource(response.data as Source);
            resourceType === "destination" && setCreatedDestination(response.data as Destination);
            resourceType === "destination" && updateSelectedDestination(response.data as Destination);
            addNotification(
                "success",
                `Create successful`,
                `${resourceType} "${(response.data as Source).name}" created successfully.`
            );
            setCreatedPipelineResources((prevResources) => [...prevResources, resourceType]);
        }
    };



    const [isCreationLoading, setIsCreationLoading] = useState(false);

    const findConnectionSchema = (connectorType: string): ConnectionsSchema | undefined => {
        // One-directional on purpose: only match when the (usually fully-qualified) connector
        // type string contains the schema's type name, e.g. "...postgresql..." contains "postgresql".
        // Do NOT also check the reverse direction — some schema catalog entries (e.g.
        // "GOOGLE_PUB_SUB", "APACHE_PULSAR", "NATS_STREAMING") use a different string than what the
        // backend's connection-type enum actually accepts on POST /api/connections (e.g. "PUBSUB",
        // "PULSAR", "NATS-STREAMING" respectively). A reverse-direction match would find these and
        // attempt a connection creation that the backend rejects, which aborts the whole
        // Source/Destination creation. Skipping (no match) is the safe, intended fallback.
        const norm = connectorType.toLowerCase().replace(/-/g, "_");
        return connectionsSchemas.find(s =>
            norm.includes(s.type.toLowerCase().replace(/-/g, "_"))
        );
    };

    const createPipelineSource = async () => {
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
                    addNotification("danger", "Source connection creation failed",
                        `Failed to create source connection: ${connResponse.error}`);
                    return; // abort — do NOT create source with missing connection ref
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
        await createNewSource(sourcePayload, "source");
    };

    const createNewTransform = async (payload: Payload) => {
        const response = await createPost(`${API_URL}/api/transforms`, payload) as { data: TransformData | null, error: string | null };
        if (response.error) {
            addNotification(
                "danger",
                `Transforms creation failed`,
                `Failed to create ${(response.data as Source)?.name}: ${response.error}`
            );
        } else {
            addNotification(
                "success",
                `Create successful`,
                `Transforms "${(response.data as Source).name}" created successfully.`
            );
            setCreatedPipelineResources((prevResources) => [...prevResources, "transform"]);
            return response.data as TransformData;
        }
    };

    const createPipelineTransform = async () => {
        setCreatePipelineResource("transform");
        const transformPayloads = extractTransformsAndPredicates(dbzServerFileConfig);
        const addedTransforms: TransformData[] = [];
        for (const transformPayload of transformPayloads) {
            const transform = await createNewTransform(transformPayload);
            if (transform) {
                addedTransforms.push(transform);
            }
        }
        const updatedCreatedTransform = addedTransforms.map((transform) => ({ name: transform.name, id: transform.id } as Transform));
        setCreatedTransform([...(createdTransform || []), ...updatedCreatedTransform]);
        setCreatedTransformData([...(createdTransformData || []), ...addedTransforms]);
        handleAddTransform(addedTransforms);
    }

    const createPipelineDestination = async () => {
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
                    addNotification("danger", "Destination connection creation failed",
                        `Failed to create destination connection: ${connResponse.error}`);
                    return;
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
        await createNewSource(destinationPayload, "destination");
        setCreatePipelineResource("done");
    };

    const handleCreatePipelineResource = async () => {
        setIsCreationLoading(true);
        // Pre-compute both schema flags before any API call so the stepper
        // renders all 5 steps immediately with correct pending vs skipped state
        const srcPayloadPreview = formatCode("source", "properties-file", dbzServerFileConfig);
        const dstPayloadPreview = formatCode("destination", "properties-file", dbzServerFileConfig);
        setSourceConnectionSupported(!!findConnectionSchema(srcPayloadPreview.type));
        setDestConnectionSupported(!!findConnectionSchema(dstPayloadPreview.type));
        await new Promise((resolve) => setTimeout(resolve, 500));
        await createPipelineSource();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await createPipelineTransform();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await createPipelineDestination();
        await new Promise((resolve) => setTimeout(resolve, 500));
        setIsCreationLoading(false);
    };

    const getTransformNames = () => {
        return createdTransform?.map((transform) => transform.name).join(", ") || "";
    }

    const closeModal = (event: KeyboardEvent | React.MouseEvent<Element>) => {
        toggleModal(event);
        setCurrentFiles([]);
        setReadFileData([]);
        setCreatedSourceConnection(null);
        setCreatedDestConnection(null);
        setSourceConnectionSupported(null);
        setDestConnectionSupported(null);
    };

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
                {showStatus ? (
                    <>
                        {createPipelineResource !== "" ? (
                            <ProgressStepper
                                aria-label="Pipeline resource creation progress stepper"
                            >
                                {/* ── Step 1: Source Connection ── always rendered ── */}
                                <ProgressStep
                                    variant={
                                        sourceConnectionSupported === false ? "default"
                                        : createdPipelineResources.includes("source_connection") ? "success"
                                        : createPipelineResource === "source_connection" ? undefined
                                        : "pending"
                                    }
                                    isCurrent={createPipelineResource === "source_connection" || undefined}
                                    icon={
                                        sourceConnectionSupported === false ? <MinusCircleIcon />
                                        : createPipelineResource === "source_connection" ? <InProgressIcon />
                                        : !createdPipelineResources.includes("source_connection") ? <PendingIcon />
                                        : undefined
                                    }
                                    description={
                                        sourceConnectionSupported === false
                                            ? "Skipped — no connection schema for this connector type"
                                            : createdSourceConnection
                                                ? <>Created a {getConnectorTypeName(createdSourceConnection.type)} source connection <b><i>{createdSourceConnection.name}</i></b></>
                                                : t('pipeline:debeziumServerModal.creatingResource', { val: "source connection" })
                                    }
                                    id="source-connection-step"
                                    titleId="source-connection-step-title"
                                    aria-label="Create source connection"
                                >
                                    Source Connection
                                </ProgressStep>
                                {/* ── Step 2: Source ── */}
                                <ProgressStep
                                    variant={createPipelineResource !== "source" ? (createdPipelineResources.includes("source") ? "success" : "pending") : undefined}
                                    isCurrent={createPipelineResource === "source" ? true : undefined}
                                    icon={createPipelineResource === "source" ? <InProgressIcon /> : !createdPipelineResources.includes("source") ? <PendingIcon /> : undefined}
                                    description={createPipelineResource === "source" ? t('pipeline:debeziumServerModal.creatingResource',{val: "source"}) : <>Created a {getConnectorTypeName(createdSource?.type || "")} connector <b><i>{createdSource?.name}</i></b></>}
                                    id="source-step"
                                    titleId="source-step-title"
                                    aria-label="Create a source connector"
                                >
                                    {t('source')}
                                </ProgressStep>
                                {/* ── Step 3: Transforms ── */}
                                <ProgressStep
                                    variant={createPipelineResource !== "transform" ? (createdPipelineResources.includes("transform") ? "success" : "pending") : undefined}
                                    isCurrent={createPipelineResource === "transform" ? true : undefined}
                                    icon={createPipelineResource === "transform" ? <InProgressIcon /> : !createdPipelineResources.includes("transform") ? <PendingIcon /> : undefined}
                                    description={createdTransform ? <>Created <b><i>{getTransformNames()}</i></b> transforms</> : createdPipelineResources.includes("transform") ? "" : t('pipeline:debeziumServerModal.creatingTransform')}
                                    id="transform-step"
                                    titleId="transform-step-title"
                                    aria-label="Create pipeline transformations"
                                >
                                    {t('transforms')}
                                </ProgressStep>
                                {/* ── Step 4: Destination Connection ── always rendered ── */}
                                <ProgressStep
                                    variant={
                                        destConnectionSupported === false ? "default"
                                        : createdPipelineResources.includes("destination_connection") ? "success"
                                        : createPipelineResource === "destination_connection" ? undefined
                                        : "pending"
                                    }
                                    isCurrent={createPipelineResource === "destination_connection" || undefined}
                                    icon={
                                        destConnectionSupported === false ? <MinusCircleIcon />
                                        : createPipelineResource === "destination_connection" ? <InProgressIcon />
                                        : !createdPipelineResources.includes("destination_connection") ? <PendingIcon />
                                        : undefined
                                    }
                                    description={
                                        destConnectionSupported === false
                                            ? "Skipped — no connection schema for this connector type"
                                            : createdDestConnection
                                                ? <>Created a {getConnectorTypeName(createdDestConnection.type)} destination connection <b><i>{createdDestConnection.name}</i></b></>
                                                : t('pipeline:debeziumServerModal.creatingResource', { val: "destination connection" })
                                    }
                                    id="dest-connection-step"
                                    titleId="dest-connection-step-title"
                                    aria-label="Create destination connection"
                                >
                                    Destination Connection
                                </ProgressStep>
                                {/* ── Step 5: Destination ── */}
                                <ProgressStep
                                    variant={createPipelineResource !== "destination" ? (createdPipelineResources.includes("destination") ? "success" : "pending") : undefined}
                                    isCurrent={createPipelineResource === "destination" ? true : undefined}
                                    icon={createPipelineResource === "destination" ? <InProgressIcon /> : !createdPipelineResources.includes("destination") ? <PendingIcon /> : undefined}
                                    description={createdDestination ? <>Created a {getConnectorTypeName(createdDestination?.type || "")} connector <b><i>{createdDestination?.name}</i></b></> : t('pipeline:debeziumServerModal.creatingResource',{val: "destination"})}
                                    id="destination-step"
                                    titleId="destination-step-title"
                                    aria-label="Create a destination connector"
                                >
                                    {t('destination')}
                                </ProgressStep>

                            </ProgressStepper>
                        ) : (
                            <>
                                <div className="pf-v6-c-multiple-file-upload">
                                    {showStatus && (
                                        <MultipleFileUploadStatus
                                            statusToggleText={`${successfullyReadFileCount} of ${currentFiles.length} files uploaded`}
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
                                statusToggleText={`${successfullyReadFileCount} of ${currentFiles.length} files uploaded`}
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
                    {createPipelineResource === "done" ? (<Button key="confirm" variant="primary" onClick={toggleModal} >
                        {t('done')}
                    </Button>) : (
                        <Button key="confirm" variant="primary" onClick={handleCreatePipelineResource} isLoading={isCreationLoading}>
                            {t('create')}
                        </Button>
                    )}
                    <Button key="cancel" variant="link" onClick={closeModal}>
                        {t('cancel')}
                    </Button>
                </ModalFooter>
            )}
        </Modal>
    );
};

export default ServerConfigModal;