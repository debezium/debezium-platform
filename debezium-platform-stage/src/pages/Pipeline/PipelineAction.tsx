import { FormGroup, FormSelect, FormSelectOption, ActionGroup, Button, Form, FormSelectOptionGroup, TextInput, FormSection, TextArea, FormGroupLabelHelp, Popover, FormHelperText, HelperText, HelperTextItem, FormFieldGroupExpandable, FormFieldGroupHeader, FormFieldGroup } from '@patternfly/react-core';
import React from 'react';
import { useForm, SubmitHandler } from "react-hook-form"
import { useTranslation } from 'react-i18next';
import signalActions from "../../__mocks__/data/Signals.json";
import { API_URL } from '@utils/constants';
import { createPost, PipelineSignalPayload } from 'src/apis';
import { useNotification } from '@appContext/index';
import { TrashIcon } from '@patternfly/react-icons';


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
}

const PipelineAction: React.FC<PipelineActionProps> = ({
    pipelineId
}) => {
    const { t } = useTranslation();
    const { addNotification } = useNotification();
    const [pipelineAction, setPipelineAction] = React.useState('please choose');
    const [isLoading, setIsLoading] = React.useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm<Inputs>({
        defaultValues: {
            actionId: self.crypto.randomUUID(),
        },
    })

    const onSubmit: SubmitHandler<Inputs> = (data) => {
        console.log("Form data submitted:", data);
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
                        "type": "BLOCKING"
                    }),
                }
                break;
        }
        // sendPipelineSignalAction(payload);
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
            <Form isHorizontal isWidthLimited onSubmit={handleSubmit(onSubmit)}>
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
                                    </>
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
                                                    titleText={{ text: 'Additional conditions', id: 'action-filter-condition' }}
                                                    titleDescription="Additional conditions that the connector evaluates to determine the subset of records to include in a snapshot."
                                                    actions={
                                                        <>
                                                            <Button variant="link">Delete all</Button> <Button variant="secondary">Add Filter</Button>
                                                        </>
                                                    }
                                                />
                                            }

                                        >
                                            <FormFieldGroup
                                                header={
                                                    <FormFieldGroupHeader
                                                        titleText={{ text: 'Additional filter condition', id: 'nested-field-group1-titleText-id' }}
                                                        actions={<Button variant="plain" aria-label="Remove" icon={<TrashIcon />} />}
                                                    />
                                                }
                                            >
                                                <FormGroup label="Filters" fieldId="filter-filed"
                                                    labelHelp={
                                                        <Popover
                                                            bodyContent={
                                                                <div>
                                                                    Specifies the column values that must be present in a data collection record for the snapshot to include it
                                                                </div>
                                                            }
                                                        >
                                                            <FormGroupLabelHelp aria-label="More info for name field" />
                                                        </Popover>
                                                    }
                                                >
                                                    <TextInput type="text" id={`filter-condition-${0}`}
                                                        {...register(`additionalConditions.${0}.filterCondition`)} />
                                                </FormGroup>
                                                <FormGroup label="Collection name" fieldId="filter-collection-name-field"
                                                    labelHelp={
                                                        <Popover
                                                            //   triggerRef={labelHelpRef}

                                                            bodyContent={
                                                                <div>
                                                                    The fully-qualified name of the data collection for which the filter will be applied.
                                                                </div>
                                                            }
                                                        >
                                                            <FormGroupLabelHelp aria-label="More info for name field" />
                                                        </Popover>
                                                    }
                                                >
                                                    <TextInput type="text" id={`filter-collection-name-${0}`}
                                                        {...register(`additionalConditions.${0}.filterCollectionName`)} />
                                                </FormGroup>

                                            </FormFieldGroup>



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
        </>

    );
};

export default PipelineAction;