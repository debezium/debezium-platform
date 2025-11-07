import { FormGroup, FormSelect, FormSelectOption, ActionGroup, Button, Form, FormSelectOptionGroup, TextInput, FormSection, TextArea, FormGroupLabelHelp, Popover, FormHelperText, HelperText, HelperTextItem, FormFieldGroupExpandable, FormFieldGroupHeader, FormFieldGroup, Skeleton, Grid, GridItem } from '@patternfly/react-core';
import React, { useEffect, useState } from 'react';
import { useForm, SubmitHandler, useFieldArray } from "react-hook-form"
import { useTranslation } from 'react-i18next';
import signalActions from "../../__mocks__/data/Signals.json";
import { API_URL } from '@utils/constants';
import { createPost, fetchDataCall, PipelineSignalPayload, Source, TableData } from 'src/apis';
import { useNotification } from '@appContext/index';
import { TrashIcon } from '@patternfly/react-icons';
import { v4 as uuidv4 } from 'uuid';
import TableViewComponent from '@components/TableViewComponent';
import { getConnectorTypeName } from '@utils/helpers';
import ApiComponentError from '@components/ApiComponentError';


const getSignalActions = () => {
    const placeholder = {
        groupLabel: '',
        disabled: false,
        options: [
            {
                value: '', label: 'Select an action', disabled: false
                , isPlaceholder: true
            },
        ]
    }
    const signalActionsGroup = [placeholder];
    signalActions.forEach((action) => {
        if (signalActionsGroup.find((group) => group.groupLabel === action.display.group)) {
            signalActionsGroup.find((group) => group.groupLabel === action.display.group)?.options.push({
                value: action.name,
                label: action.display.label,
                disabled: action.display.disabled,
                isPlaceholder: false
            });
        } else {
            signalActionsGroup.splice(action.display.groupOrder, 0, {
                groupLabel: action.display.group,
                disabled: false,
                options: [
                    { value: action.name, label: action.display.label, disabled: action.display.disabled, isPlaceholder: false },
                ]
            })
        }
    });
    return signalActionsGroup;
}

interface FilterConditions {
    filterCollectionName: string;
    filterCondition: string;
}

// Define the Inputs interface for form fields
interface Inputs {
    actionType: string;
    actionId: string;
    logMessage?: string;
    collectionName?: string;
    additionalConditions?: FilterConditions[];
}

interface PipelineActionProps {
    pipelineId: string | undefined;
    sourceId: number | undefined;
}

const PipelineAction: React.FC<PipelineActionProps> = ({
    pipelineId,
    sourceId
}) => {
    const { t } = useTranslation();
    const { addNotification } = useNotification();
    const [pipelineAction, setPipelineAction] = React.useState('please choose');
    const [isLoading, setIsLoading] = React.useState(false);

    const [isCollectionsLoading, setIsCollectionsLoading] = useState(false);
    const [collectionsError, setCollectionsError] = useState("");
    const [collections, setCollections] = useState<TableData | undefined>(undefined);
    const [sourceName, setSourceName] = useState<string | undefined>(undefined);

    useEffect(() => {
        let connectionId = undefined;
        const fetchConnection = async () => {
            setIsCollectionsLoading(true);
            const sourceResponse = await fetchDataCall<Source>(
                `${API_URL}/api/sources/${sourceId}`
            );
            if (sourceResponse.error) {
                setCollectionsError(sourceResponse.error.body?.error || "");
            } else {
                connectionId = sourceResponse.data?.connection?.id;
                setSourceName(getConnectorTypeName(sourceResponse.data?.type || ""));
                const collectionResponse = await fetchDataCall<TableData>(
                    `${API_URL}/api/connections/${connectionId}/collections`
                );
                if (collectionResponse.error) {
                    setCollectionsError(collectionResponse.error.body?.error || "");
                } else {
                    setCollections(collectionResponse.data as TableData);
                }
            }
            setIsCollectionsLoading(false);
        };
        if (sourceId) {
            fetchConnection();
        }
    }, [sourceId]);

    const {
        register,
        handleSubmit,
        control,
        formState: { errors }
    } = useForm<Inputs>({
        defaultValues: {
            actionId: uuidv4(),
            additionalConditions: []
        },
    })

    const { fields, append, remove } = useFieldArray({
        control,
        name: "additionalConditions"
    });

    const addFilterCondition = () => {
        append({ filterCollectionName: '', filterCondition: '' });
    };

    const deleteAdditionalCondition = (index: number) => {
        remove(index);
    };

    const deleteAllConditions = () => {
        for (let i = fields.length - 1; i >= 0; i--) {
            remove(i);
        }
    };

    const onSubmit: SubmitHandler<Inputs> = (data) => {
        setIsLoading(true);
        let payload: PipelineSignalPayload = {
            "id": data.actionId,
            "type": signalActions.find((action) => action.name === pipelineAction)?.value || "",
        };

        switch (pipelineAction) {
            case "logAction":
                payload = {
                    ...payload,
                    "data": JSON.stringify({
                        "message": data.logMessage,
                    }),
                }
                break;
            case "adhocSnapshotActions":
                payload = {
                    ...payload,
                    "data": JSON.stringify({
                        "data-collections": data.collectionName ? data.collectionName.split(",").map(name => name.trim()) : [""],
                        "type": "INCREMENTAL",
                        ...(data.additionalConditions && data.additionalConditions.length > 0 && {
                            "additional-conditions": data.additionalConditions.map(condition => ({
                                "filter-collection-name": condition.filterCollectionName,
                                "filter-condition": condition.filterCondition
                            }))
                        }),
                    }),
                }
                break;
            case "stopAdhocSnapshotActions":
                payload = {
                    ...payload,
                    "data": JSON.stringify({
                        "data-collections": data.collectionName ? data.collectionName.split(",").map(name => name.trim()) : [""],
                        "type": "INCREMENTAL"
                    }),
                }
                break;
            case "pauseAdhocSnapshotActions":
            case "resumeAdhocSnapshotActions":
                break
            case "blockingSnapshotActions":
                payload = {
                    ...payload,
                    "data": JSON.stringify({
                        "data-collections": data.collectionName ? data.collectionName.split(",").map(name => name.trim()) : [""],
                        "type": "BLOCKING",
                        ...(data.additionalConditions && data.additionalConditions.length > 0 && {
                            "additional-conditions": data.additionalConditions.map(condition => ({
                                "filter-collection-name": condition.filterCollectionName,
                                "filter-condition": condition.filterCondition
                            }))
                        }),
                    }),
                }
                break;
        }
        sendPipelineSignalAction(payload);
    }

    const handleOptionChange = (_event: React.FormEvent<HTMLSelectElement>, value: string) => {
        setPipelineAction(value);
    };

    const sendPipelineSignalAction = async (payload: PipelineSignalPayload) => {
        const response = await createPost(`${API_URL}/api/pipelines/${pipelineId}/signals`, payload);
        if (response.error) {
            setIsLoading(false);
            addNotification(
                "danger",
                `Signal action failed`,
                `Failed to send signal action: ${response.error
                }`
            );
        } else {
            setIsLoading(false);
            addNotification(
                "success",
                `Signal action success`,
                `Send action "${payload.type
                }" created successfully.`
            );
        }
    };

    return (
        <>

            <Grid hasGutter style={{ height: "calc(100vh - 200px)", alignItems: "stretch" }}>
                <GridItem span={8} style={{ borderRight: "1px solid #ccc", paddingRight: "10px", height: "100%", overflowY: "auto" }}>
                    <Form isHorizontal onSubmit={handleSubmit(onSubmit)}>
                        <FormSection title={t("pipeline:actions.description")} titleElement="h2">
                            <FormGroup label={t("pipeline:actions.actionField")} fieldId="action-type" isRequired>
                                <FormSelect
                                    value={pipelineAction}
                                    onChange={handleOptionChange}
                                    id="action-type"
                                    name="actionType"
                                    aria-label="action type"
                                >
                                    {getSignalActions().map((group, index) => (
                                        <FormSelectOptionGroup isDisabled={group.disabled} key={index} label={group.groupLabel}>
                                            {group.options.map((option, i) => (
                                                <FormSelectOption isDisabled={option.disabled} key={i} value={option.value} label={option.label} />
                                            ))}
                                        </FormSelectOptionGroup>
                                    ))}
                                </FormSelect>
                            </FormGroup>
                            {
                                pipelineAction !== "" && pipelineAction !== "please choose" && (
                                    <>
                                        <FormGroup label={t("Action Id")} fieldId="action-id" isRequired
                                            labelHelp={
                                                <Popover
                                                    bodyContent={
                                                        <div>
                                                            {t("pipeline:actions.actionTypeFieldDescription")}
                                                        </div>
                                                    }
                                                >
                                                    <FormGroupLabelHelp aria-label={t("pipeline:actions.actionTypeFieldDescription")} />
                                                </Popover>
                                            }
                                        >
                                            <TextInput isRequired type="text" id="action-id"
                                                validated={errors.actionId ? "error" : "default"}
                                                {...register("actionId", {
                                                    required: "Action Id is required",
                                                    minLength: { value: 5, message: "Action id be at least 5 characters" }
                                                })} />
                                            <FormHelperText>
                                                <HelperText>
                                                    <HelperTextItem>{t("pipeline:actions.actionIdHelper")}</HelperTextItem>
                                                </HelperText>
                                            </FormHelperText>

                                        </FormGroup>

                                    </>
                                )
                            }
                            {(() => {
                                switch (pipelineAction) {
                                    case "logAction":
                                        return (
                                            <FormGroup label={t("pipeline:actions.messageField")} fieldId="log-message" isRequired
                                                labelHelp={
                                                    <Popover
                                                        bodyContent={
                                                            <div>
                                                                {t("pipeline:actions.messageFieldDescription")}
                                                            </div>
                                                        }
                                                    >
                                                        <FormGroupLabelHelp aria-label="Log helper msg" />
                                                    </Popover>
                                                }>
                                                <TextArea
                                                    isRequired
                                                    id="log-message"
                                                    aria-label="log message"
                                                    validated={errors.logMessage ? "error" : "default"}
                                                    {...register("logMessage", {
                                                        required: "Log message is required",
                                                    })}
                                                />
                                            </FormGroup>
                                        );
                                    case "stopAdhocSnapshotActions":
                                        return (

                                            <FormGroup label={t("pipeline:actions.collectionField")} fieldId="collection-name"
                                                labelHelp={
                                                    <Popover
                                                        bodyContent={
                                                            <div>

                                                                {t("pipeline:actions.collectionFieldDescription")}
                                                            </div>
                                                        }
                                                    >
                                                        <FormGroupLabelHelp aria-label="More info for name field" />
                                                    </Popover>
                                                }
                                            >
                                                <TextInput type="text" id="collection-name"

                                                    {...register("collectionName")} />
                                            </FormGroup>
                                        );
                                    case "blockingSnapshotActions":
                                    case "adhocSnapshotActions":
                                        return (
                                            <>
                                                <FormGroup label={t("pipeline:actions.collectionField")} fieldId="collection-name"
                                                    labelHelp={
                                                        <Popover
                                                            bodyContent={
                                                                <div>

                                                                    {t("pipeline:actions.collectionFieldDescription")}
                                                                </div>
                                                            }
                                                        >
                                                            <FormGroupLabelHelp aria-label="More info for name field" />
                                                        </Popover>
                                                    }
                                                >
                                                    <TextInput type="text" id="collection-name"
                                                        {...register("collectionName")} />
                                                </FormGroup>
                                                <FormFieldGroupExpandable
                                                    isExpanded
                                                    toggleAriaLabel="Details"
                                                    header={
                                                        <FormFieldGroupHeader
                                                            titleText={{ text: t('pipeline:actions.additionalConditions'), id: 'action-filter-condition' }}
                                                            titleDescription={t('pipeline:actions.additioanlConditionsDesc')}
                                                            actions={
                                                                <>
                                                                    <Button variant="link" onClick={deleteAllConditions}>{t("deleteAll")}</Button>
                                                                    <Button variant="secondary" onClick={addFilterCondition}>{t("pipeline:actions.addFilter")}</Button>
                                                                </>
                                                            }
                                                        />
                                                    }
                                                >
                                                    {fields.map((field, index) => (
                                                        <FormFieldGroup
                                                            key={field.id}
                                                            header={
                                                                <FormFieldGroupHeader
                                                                    titleText={{ text: t("pipeline:actions.filterCondition", { val: index + 1 }), id: `nested-field-group${index}-titleText-id` }}
                                                                    actions={
                                                                        <Button
                                                                            variant="plain"
                                                                            aria-label="Remove"
                                                                            icon={<TrashIcon />}
                                                                            onClick={() => deleteAdditionalCondition(index)}
                                                                        />
                                                                    }
                                                                />
                                                            }
                                                        >
                                                            <FormGroup label={t("pipeline:actions.filterConditionFields.filtersField")} fieldId={`filter-filed-${index}`}
                                                                labelHelp={
                                                                    <Popover
                                                                        bodyContent={
                                                                            <div>
                                                                                {t("pipeline:actions.filterConditionFields.filtersHelperText")}
                                                                            </div>
                                                                        }
                                                                    >
                                                                        <FormGroupLabelHelp aria-label="More info for name field" />
                                                                    </Popover>
                                                                }
                                                            >
                                                                <TextInput
                                                                    type="text"
                                                                    id={`filter-condition-${index}`}
                                                                    {...register(`additionalConditions.${index}.filterCondition` as const)}
                                                                />
                                                            </FormGroup>
                                                            <FormGroup label={t("pipeline:actions.filterConditionFields.collectionsField")} fieldId={`filter-collection-name-field-${index}`}
                                                                labelHelp={
                                                                    <Popover
                                                                        bodyContent={
                                                                            <div>
                                                                                {t("pipeline:actions.filterConditionFields.collectionsHelperText")}
                                                                            </div>
                                                                        }
                                                                    >
                                                                        <FormGroupLabelHelp aria-label="More info for name field" />
                                                                    </Popover>
                                                                }
                                                            >
                                                                <TextInput
                                                                    type="text"
                                                                    id={`filter-collection-name-${index}`}
                                                                    {...register(`additionalConditions.${index}.filterCollectionName` as const)}
                                                                />
                                                            </FormGroup>
                                                        </FormFieldGroup>
                                                    ))}
                                                </FormFieldGroupExpandable>
                                            </>
                                        );
                                    default:
                                        return null;
                                }
                            })()}
                        </FormSection>
                        {
                            pipelineAction !== "" && pipelineAction !== "please choose" && (
                                <ActionGroup>
                                    <Button variant="primary" type="submit" isLoading={isLoading} isDisabled={isLoading}>{t("submit")}</Button>
                                    {/* <Button variant="link">{t("clear")}</Button> */}
                                </ActionGroup>
                            )
                        }

                    </Form>
                </GridItem>
                <GridItem span={4} style={{ height: "100%", overflowY: "auto" }}>
                    {
                        isCollectionsLoading ?
                            <FormFieldGroup>
                                <br />
                                <Skeleton fontSize="md" width="75%" />
                                <br />
                                <Skeleton fontSize="2xl" width="75%" />
                                <br />
                                <Skeleton fontSize="md" width="50%" />
                                <br />
                                <Skeleton fontSize="md" width="50%" />
                                <br />
                                <Skeleton fontSize="md" width="50%" />
                                <br />
                            </FormFieldGroup> : collectionsError ? <FormFieldGroup> <ApiComponentError error={collectionsError} />   </FormFieldGroup> : <FormFieldGroup
                                className="table-explorer-section"
                                header={
                                    <FormFieldGroupHeader
                                        titleText={{
                                            text: <span style={{ fontWeight: 500 }}>{t("source:create.dataTableTitle", { val: sourceName })}</span>,
                                            id: `field-group-data-table-id`,
                                        }}
                                        titleDescription={t("source:create.dataTableDescription")}
                                    />
                                }
                            >
                                <TableViewComponent collections={collections} />
                            </FormFieldGroup>
                    }
                </GridItem>
            </Grid>
        </>

    );
};

export default PipelineAction;