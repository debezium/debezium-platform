import { FormGroup, FormSelect, FormSelectOption, Radio, ActionGroup, Button, Form, FormSelectOptionGroup, TextInput, FormSection, FormFieldGroupHeader, FormFieldGroupExpandable, TextArea, FormGroupLabelHelp, Popover } from '@patternfly/react-core';
import { pipelineAction } from '@utils/pipelineActions';
import { find } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';

const PipelineAction: React.FC = () => {
    const { t } = useTranslation();
    const [option, setOption] = React.useState('please choose');

    const [logMessage, setLogMessage] = React.useState('');

    const handleOptionChange = (_event: React.FormEvent<HTMLSelectElement>, value: string) => {
        console.log(value);
        setOption(value);

    };

    const handleLogMessageChange = (_event: React.ChangeEvent<HTMLTextAreaElement>, experience: string) => {
        setLogMessage(experience);
    };

    const groups = [
        {
            groupLabel: '',
            disabled: false,
            options: [
                { value: '', label: 'Select an action', disabled: false, isPlaceholder: true },
            ]
        },
        {
            groupLabel: 'Log',
            disabled: false,
            options: [
                { value: 'log', label: 'Add messages to the log', disabled: false },
            ]
        },
        {
            groupLabel: 'Ad hoc Snapshot',
            disabled: false,
            options: [
                { value: 'adhocSnapshot', label: 'Trigger ad hoc snapshots', disabled: false },
                { value: 'stopAdhocSnapshot', label: 'Stop execution of an ad hoc snapshot', disabled: false },
            ]
        },
        {
            groupLabel: 'Incremental Snapshot',
            disabled: false,
            options: [
                { value: 'adhocIncremental', label: 'Trigger ad hoc incremental snapshots', disabled: false },
                { value: 'pauseIncremental', label: 'Pause incremental snapshots', disabled: false },
                { value: 'resumeIncremental', label: 'Resume incremental snapshots', disabled: false }
            ]
        },
        {
            groupLabel: 'Blocking Snapshot',
            disabled: false,
            options: [
                { value: 'adhocBlocking', label: 'Trigger ad hoc blocking snapshot', disabled: false },
            ]
        }
    ];

    return (
        <>
            <Form isHorizontal isWidthLimited>
                <FormSection title={t("pipeline:actions.description")} titleElement="h2">
                    <FormGroup label={t("pipeline:actions.actionField")} fieldId="pipeline-action" isRequired>
                        <FormSelect
                            value={option}
                            onChange={handleOptionChange}
                            id="pipeline-action-title"
                            name="pipeline-actiontitle"
                            aria-label="action"
                        >
                            {groups.map((group, index) => (
                                <FormSelectOptionGroup isDisabled={group.disabled} key={index} label={group.groupLabel}>
                                    {group.options.map((option, i) => (
                                        <FormSelectOption isDisabled={option.disabled} key={i} value={option.value} label={option.label} />
                                    ))}
                                </FormSelectOptionGroup>
                            ))}
                        </FormSelect>
                    </FormGroup>
                    <FormGroup label={t("pipeline:actions.actionTypeField")} fieldId="action-type-field" isRequired
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
                        <TextInput isDisabled type="text" id="action-type" name="action-type" value={option ? find(pipelineAction, (act) => act.action === option)?.type : ""} />
                    </FormGroup>
                    {(() => {
                        switch (find(pipelineAction, (act) => act.action === option)?.action) {
                            case "log":
                                return (
                                    <FormGroup label="Message" fieldId="log-message-field" isRequired>
                                        <TextArea
                                            value={logMessage}
                                            onChange={handleLogMessageChange}
                                            id="log-message"
                                            name="log-message"
                                            aria-label="log-message"
                                        />
                                    </FormGroup>
                                );
                            case "adhocBlocking":
                            case "adhocSnapshot":
                            case "adhocIncremental":
                            case "stopAdhocSnapshot":
                                return (
                                    <>
                                        <FormGroup label="Collection name" fieldId="collection-name-field" isRequired
                                            labelHelp={
                                                <Popover
                                                    bodyContent={
                                                        <div>

                                                            A required component of the data field of a signal that specifies an array of collection names or regular expressions to match collection names to include in the snapshot.
                                                        </div>
                                                    }
                                                >
                                                    <FormGroupLabelHelp aria-label="More info for name field" />
                                                </Popover>
                                            }
                                        >
                                            <TextInput type="text" id="collection-name" name="collection-name" value='public.Collection1, public.Collection2' />
                                        </FormGroup>
                                        <FormGroup role="radiogroup" isStack fieldId="snapshot-type" hasNoPaddingTop label="Snapshot type"
                                            labelHelp={
                                                <Popover
                                                    //   triggerRef={labelHelpRef}

                                                    bodyContent={
                                                        <div>
                                                            An optional type component of the data field of a signal that specifies the type of snapshot operation to run.
                                                            Currently supports the incremental and blocking types.
                                                        </div>
                                                    }
                                                >
                                                    <FormGroupLabelHelp aria-label="More info for name field" />
                                                </Popover>
                                            }
                                        >
                                            <Radio name="incremental-snapshot-type" label="Incremental" isChecked id="incremental-snapshot-type" />
                                            <Radio name="blocking-snapshot-type" label="Blocking" id="blocking-snapshot-type" isDisabled />
                                        </FormGroup>
                                        {find(pipelineAction, (act) => act.action === option)?.action !== "stopAdhocSnapshot" &&

                                            <FormFieldGroupExpandable
                                                style={{ border: "none" }}
                                                isExpanded
                                                toggleAriaLabel="Details"
                                                header={
                                                    <FormFieldGroupHeader
                                                        titleText={{ text: 'Additional filter conditions', id: 'action-filter-condition' }}
                                                        titleDescription="Additional conditions that the connector evaluates to determine the subset of records to include in a snapshot."
                                                    />
                                                }
                                            >
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
                                                    <TextInput type="text" id="filter-collection-name" name="filter-collection-name" value="schema1.table1" />
                                                </FormGroup>
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
                                                    <TextInput type="text" id="filter" name="filter" value="color=\'blue\'" />
                                                </FormGroup>
                                            </FormFieldGroupExpandable>
                                        }

                                    </>
                                );
                            default:
                                return null;
                        }
                    })()}
                </FormSection>

                <ActionGroup>
                    <Button variant="primary">{t("submit")}</Button>
                    <Button variant="link">{t("clear")}</Button>
                </ActionGroup>
            </Form>
        </>

    );
};

export default PipelineAction;