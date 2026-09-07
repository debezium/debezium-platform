import { FormGroup, FormSelect, FormSelectOption, ActionGroup, Button, Form, FormSelectOptionGroup, TextInput, FormSection, TextArea, FormGroupLabelHelp, Popover, FormHelperText, HelperText, HelperTextItem, FormFieldGroupExpandable, FormFieldGroupHeader, FormFieldGroup, Grid, GridItem, Spinner } from '@patternfly/react-core';
import React, { useCallback, useEffect, useState } from 'react';
import { useForm, SubmitHandler, useFieldArray } from "react-hook-form"
import { useTranslation } from 'react-i18next';
import signalActions from "../../__mocks__/data/Signals.json";
import { API_URL } from '@utils/constants';
import { createPost, fetchDataCall, PipelineSignalPayload, Source, TableData } from 'src/apis';
import { SelectedDataListItem } from 'src/apis/types';
import { useNotification } from '@appContext/index';
import { TrashIcon } from '@patternfly/react-icons';
import { v4 as uuidv4 } from 'uuid';
import './PipelineAction.css';
import TableViewComponent from '../../components/TableViewComponent';
import ApiComponentError from '../../components/ApiComponentError';


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
    filterCondition: string;
}

// Define the Inputs interface for form fields
interface Inputs {
    actionType: string;
    actionId: string;
    logMessage?: string;
    additionalConditions?: FilterConditions[];
}

interface PipelineActionProps {
    pipelineId: string | undefined;
    sourceId: number | undefined;
    activeTabKey: string;
}

const PipelineAction: React.FC<PipelineActionProps> = ({
    pipelineId,
    sourceId,
    activeTabKey,
}) => {
    const { t } = useTranslation();
    const { addNotification } = useNotification();
    const [pipelineAction, setPipelineAction] = React.useState('please choose');
    const [isLoading, setIsLoading] = React.useState(false);

    const [isCollectionsLoading, setIsCollectionsLoading] = useState(false);
    const [collectionsError, setCollectionsError] = useState<object | undefined>(undefined);
    const [collections, setCollections] = useState<TableData | undefined>(undefined);
    const [selectedDataListItems, setSelectedDataListItems] = useState<SelectedDataListItem | undefined>(undefined);
    const [additionalConditionsSelections, setAdditionalConditionsSelections] = useState<(SelectedDataListItem | undefined)[]>([]);

   

    const fetchConnectionCollections = useCallback(async () => {
        if (!sourceId) return;
        setIsCollectionsLoading(true);
        const sourceResponse = await fetchDataCall<Source>(
            `${API_URL}/api/sources/${sourceId}`
        );
        if (sourceResponse.error) {
            setCollectionsError(sourceResponse);
        } else {
            const connectionId = sourceResponse.data?.connection?.id;
            setCollectionsError(undefined);
            const collectionResponse = await fetchDataCall<TableData>(
                `${API_URL}/api/connections/${connectionId}/collections`
            );
            if (collectionResponse.error) {
                setCollectionsError(collectionResponse.error.body?.error || "");
                setCollectionsError(collectionResponse);
            } else {
                setCollections(collectionResponse.data as TableData);
                setCollectionsError(undefined);
            }
        }
        setIsCollectionsLoading(false);
    }, [sourceId]);

    useEffect(() => {
        if (!sourceId || activeTabKey !== "action") return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional async data fetch on dependency change
        void fetchConnectionCollections();
    }, [sourceId, activeTabKey, fetchConnectionCollections]);

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
        append({ filterCondition: '' });
        setAdditionalConditionsSelections(prev => [...prev, undefined]);
    };

    const deleteAdditionalCondition = (index: number) => {
        remove(index);
        setAdditionalConditionsSelections(prev => prev.filter((_, i) => i !== index));
    };

    const deleteAllConditions = () => {
        for (let i = fields.length - 1; i >= 0; i--) {
            remove(i);
        }
        setAdditionalConditionsSelections([]);
    };

    const getDataCollections = (selected: SelectedDataListItem | undefined): string[] => {
        if (selected?.tables && selected.tables.length > 0) return selected.tables;
        if (selected?.schemas && selected.schemas.length > 0) return selected.schemas;
        return [""];
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
                        "data-collections": getDataCollections(selectedDataListItems),
                        "type": "INCREMENTAL",
                        ...(data.additionalConditions && data.additionalConditions.length > 0 && {
                            "additional-conditions": data.additionalConditions.map((condition, i) => ({
                                "data-collection": getDataCollections(additionalConditionsSelections[i])[0] ?? "",
                                "filter": condition.filterCondition
                            }))
                        }),
                    }),
                }
                break;
            case "stopAdhocSnapshotActions":
                payload = {
                    ...payload,
                    "data": JSON.stringify({
                        "data-collections": getDataCollections(selectedDataListItems),
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
                        "data-collections": getDataCollections(selectedDataListItems),
                        "type": "BLOCKING",
                        ...(data.additionalConditions && data.additionalConditions.length > 0 && {
                            "additional-conditions": data.additionalConditions.map((condition, i) => ({
                                "data-collection": getDataCollections(additionalConditionsSelections[i])[0] ?? "",
                                "filter": condition.filterCondition
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
        setSelectedDataListItems(undefined);
    };

    const renderCollectionSelector = useCallback((
        selected: SelectedDataListItem | undefined,
        onSelect: (items: SelectedDataListItem | undefined) => void,
        className = "pipeline-action-collection-selector",
    ) => {
        if (!sourceId) return null;
        if (isCollectionsLoading) {
            return <Spinner aria-label={t("pipeline:actions.collectionField")} />;
        }
        if (collectionsError) {
            return (
                <ApiComponentError
                    error={collectionsError}
                    isCompact={true}
                    retry={() => { void fetchConnectionCollections(); }}
                />
            );
        }
        return (
            <div className={className}>
                <TableViewComponent
                    collections={collections}
                    setSelectedDataListItems={onSelect}
                    selectedDataListItems={selected}
                />
            </div>
        );
    }, [sourceId, isCollectionsLoading, collectionsError, collections, fetchConnectionCollections, t]);

    // const collectionFieldLabel = sourceName
    //     ? `${t("pipeline:actions.collectionField")} (${sourceName})`
    //     : t("pipeline:actions.collectionField");

            const collectionFieldLabel = t("pipeline:actions.collectionField");

    const collectionFieldLabelHelp = (
        <Popover bodyContent={<div>{t("pipeline:actions.collectionFieldDescription")}</div>}>
            <FormGroupLabelHelp aria-label={t("pipeline:actions.collectionFieldDescription")} />
        </Popover>
    );

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

            <Grid hasGutter className="pipeline-action-grid-container">
                <GridItem span={8}
                //  className="pipeline-action-grid"
                 >
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
                                            <FormGroup
                                                label={collectionFieldLabel}
                                                fieldId="data-collection"
                                                isRequired
                                                labelHelp={collectionFieldLabelHelp}
                                            >
                                                {renderCollectionSelector(selectedDataListItems, setSelectedDataListItems)}
                                            </FormGroup>
                                        );
                                    case "blockingSnapshotActions":
                                    case "adhocSnapshotActions":
                                        return (
                                            <>
                                                <FormGroup
                                                    label={collectionFieldLabel}
                                                    fieldId="data-collection"
                                                    isRequired
                                                    labelHelp={collectionFieldLabelHelp}
                                                >
                                                    {renderCollectionSelector(selectedDataListItems, setSelectedDataListItems)}
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
                                                            <FormGroup
                                                                label={t("pipeline:actions.filterConditionFields.collectionsField")}
                                                                fieldId={`filter-collection-name-field-${index}`}
                                                                labelHelp={
                                                                    <Popover bodyContent={<div>{t("pipeline:actions.filterConditionFields.collectionsHelperText")}</div>}>
                                                                        <FormGroupLabelHelp aria-label={t("pipeline:actions.filterConditionFields.collectionsHelperText")} />
                                                                    </Popover>
                                                                }
                                                            >
                                                                {renderCollectionSelector(
                                                                    additionalConditionsSelections[index],
                                                                    (items) => setAdditionalConditionsSelections(prev => {
                                                                        const next = [...prev];
                                                                        next[index] = items;
                                                                        return next;
                                                                    }),
                                                                    "pipeline-action-collection-selector pipeline-action-collection-selector--compact"
                                                                )}
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
            </Grid>
        </>

    );
};

export default PipelineAction;