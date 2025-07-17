import { Modal, ModalVariant, ModalHeader, ModalBody, ModalFooter, Button, MultipleFileUpload, MultipleFileUploadMain, MultipleFileUploadStatus, MultipleFileUploadStatusItem, Alert, AlertActionCloseButton, DropEvent, ProgressStep, ProgressStepper, TextArea } from "@patternfly/react-core";
import { InProgressIcon, PendingIcon, UploadIcon } from "@patternfly/react-icons";
import { useEffect, useState } from "react";
import { FileRejection } from 'react-dropzone';
import { faker } from '@faker-js/faker';
import "./ServerConfigModal.css"
import { formatCode } from "@utils/formatCodeUtils";
import { createPost, Destination, Payload, Source, Transform } from "src/apis";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";

interface ServerConfigModalProps {
    isModalOpen: boolean;
    toggleModal: (event: KeyboardEvent | React.MouseEvent<Element>) => void;
      updateSelectedSource: (source: Source) => void;
      updateSelectedDestination: (destination: Destination) => void;
      updateSelectedTransform: (transform: Transform) => void;
}

interface readFile {
    fileName: string;
    data?: string;
    loadResult?: 'danger' | 'success';
    loadError?: DOMException;
}

type PipelineResourceType = "source" | "transform" | "destination" | "" | "done";

const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
    isModalOpen,
    toggleModal,
    updateSelectedSource,
    updateSelectedDestination,
    // updateSelectedTransform
}) => {

    const { addNotification } = useNotification();

    const [currentFiles, setCurrentFiles] = useState<File[]>([]);
    const [readFileData, setReadFileData] = useState<readFile[]>([]);
    const [showStatus, setShowStatus] = useState(false);
    const [modalText, setModalText] = useState('');
    const [statusIcon, setStatusIcon] = useState('inProgress');

    const [createdSource, setCreatedSource] = useState<Source | null>(null);
    const [createdDestination, setCreatedDestination] = useState<Destination | null>(null);


    const [createPipelineResource, setCreatePipelineResource] = useState<PipelineResourceType>("");
    const [createdPipelineResources, setCreatedPipelineResources] = useState<PipelineResourceType[]>([]);
    const [dbzServerFileConfig, setDbzServerFileConfig] = useState<string | object>("");

    useEffect(() => {
        if (readFileData.length < currentFiles.length) {
            setStatusIcon('inProgress');
        } else if (readFileData.every((file) => file.loadResult === 'success')) {
            setStatusIcon('success');
        } else {
            setStatusIcon('danger');
        }
    }, [readFileData, currentFiles]);
    useEffect(() => {
        if (currentFiles.length > 0) {
            setShowStatus(true);
        } else {
            setShowStatus(false);
        }
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
            setModalText(`${fileRejections[0].file.name} is not an accepted file type`);
        } else {
            const rejectedMessages = fileRejections.reduce(
                (acc, fileRejection) => (acc += `${fileRejection.file.name}, `),
                ''
            );
            setModalText(`${rejectedMessages}are not accepted file types`);
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
            console.log("Source created successfully:", response.data);
            //   modelLoaded && onSelection && onSelection(response.data as Source);
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

    const createPipelineSource = async () => {
        setCreatePipelineResource("source");
        const sourcePayload = formatCode("source", "properties-file", dbzServerFileConfig);
        const name = `${faker.word.adjective()}-${faker.animal.type()}-${faker.number.int(1000)}`;
        sourcePayload.name = name;
        await createNewSource(sourcePayload, "source");
    }

    const createPipelineTransform = async () => {
        setCreatePipelineResource("transform");
        setCreatedPipelineResources((prevResources) => [...prevResources, "transform"]);
    }

    const createPipelineDestination = async () => {
        setCreatePipelineResource("destination");
        const sourcePayload = formatCode("destination", "properties-file", dbzServerFileConfig);
        const name = `${faker.word.adjective()}-${faker.animal.type()}-${faker.number.int(1000)}`;
        sourcePayload.name = name;
        await createNewSource(sourcePayload, "destination");
        setCreatePipelineResource("done");
    }

    const handleCreatePipelineResource = async () => {
        setIsCreationLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 500));
        await createPipelineSource();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await createPipelineTransform();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await createPipelineDestination();
        await new Promise((resolve) => setTimeout(resolve, 500));
        setIsCreationLoading(false);


        // console.log("Creating pipeline resource with file", formatCode("source", "properties-file", dbzServerFile));

    }


    return (
        <Modal
            variant={ModalVariant.medium}
            isOpen={isModalOpen}
            onClose={toggleModal}
            aria-labelledby="modal-with-description-title"
            aria-describedby="modal-box-body-with-description"
        >
            <ModalHeader
                title="Create pipeline resources using Debezium server configuration"
                labelId="modal-with-description-title"
                description="Upload a Debezium server configuration file to automaticly create a pipeline. On uploading a file, the pipeline will be created by srychinsly  creating the source, transforms and destination defined finaly using these creased resource to create a pipeline."

            />

            <ModalBody tabIndex={0} id="modal-box-body-with-description">
                {!!modalText && <Alert
                    isInline
                    variant="warning"
                    title="Unsupported file"
                    actionClose={<AlertActionCloseButton onClose={() => console.log('Clicked the close button')} />}
                    style={{ marginBottom: '1rem' }}
                >
                    <p>{modalText}</p>
                </Alert>}
                {showStatus ? (
                    <>

                        {createPipelineResource !== "" ? (
                            <ProgressStepper
                                // isVertical
                                aria-label="Basic progress stepper with alignment"
                            >
                                <ProgressStep
                                    variant={createPipelineResource !== "source" ? (createdPipelineResources.includes("source") ? "success" : "pending") : undefined}
                                    isCurrent={createPipelineResource === "source" ? true : undefined}
                                    icon={createPipelineResource === "source" ? <InProgressIcon /> : !createdPipelineResources.includes("source") ? <PendingIcon /> : undefined}
                                    description={createPipelineResource === "source" ? "Creating a postgres source connector" : <>Created a postgres connector <b><i>{createdSource?.name}</i></b></>}
                                    id="basic-alignment-step1"
                                    titleId="basic-alignment-step1-title"
                                    aria-label="completed step, step with success"
                                >
                                    Source
                                </ProgressStep>
                                <ProgressStep
                                    variant={createPipelineResource !== "transform" ? (createdPipelineResources.includes("transform") ? "success" : "pending") : undefined}
                                    isCurrent={createPipelineResource === "transform" ? true : undefined}
                                    icon={createPipelineResource === "transform" ? <InProgressIcon /> : !createdPipelineResources.includes("transform") ? <PendingIcon /> : undefined}
                                    description={createPipelineResource === "transform" ? "Creating a pipeline transform" : "Done creating a pipeline transform"}
                                    id="basic-alignment-step1"
                                    titleId="basic-alignment-step1-title"
                                    aria-label="completed step, step with success"
                                >
                                    Transforms
                                </ProgressStep>
                                <ProgressStep
                                    variant={createPipelineResource !== "destination" ? (createdPipelineResources.includes("destination") ? "success" : "pending") : undefined}
                                    isCurrent={createPipelineResource === "destination" ? true : undefined}
                                    icon={createPipelineResource === "destination" ? <InProgressIcon /> : !createdPipelineResources.includes("destination") ? <PendingIcon /> : undefined}
                                    description={createPipelineResource === "destination" ? "Creating a kafka destination connector" : <>Created a kafka connector <b><i>{createdDestination?.name}</i></b></>}
                                    id="basic-alignment-step2"
                                    titleId="basic-alignment-step2-title"
                                    aria-label="step with info"
                                >
                                    Destination
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
                            titleText="Drag and drop files here"
                            titleTextSeparator="or"
                            infoText="Accepted file types: .properties"
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
                    {createPipelineResource === "done" ? ( <Button key="confirm" variant="primary" onClick={toggleModal} >
                        Done
                    </Button>):( 
                        <Button key="confirm" variant="primary" onClick={handleCreatePipelineResource} isLoading={isCreationLoading}>
                       Create
                    </Button>
                     )}
                   
                    
                    <Button key="cancel" variant="link" onClick={() => { }}>
                        Cancel
                    </Button>
                </ModalFooter>
            )}

        </Modal>
    );

};

export default ServerConfigModal;