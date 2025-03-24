import { FormGroup, FormSelect, FormSelectOption, Radio, ActionGroup, Button, Form, CardHeader, Title, TitleSizes, Card, FormSelectOptionGroup, TextInput, FormSection, FormFieldGroup, FormFieldGroupHeader, FormFieldGroupExpandable } from '@patternfly/react-core';
import React from 'react';

const PipelineAction: React.FC = () => {
    const [option, setOption] = React.useState('please choose');

    const handleOptionChange = (_event: React.FormEvent<HTMLSelectElement>, value: string) => {
        setOption(value);
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
            groupLabel: 'Incremental Snapshot',
            disabled: false,
            options: [
                { value: 'adhocIncremental', label: 'Trigger ad hoc incremental snapshots', disabled: false },
                { value: 'stopIncremental', label: 'Stop execution of an ad hoc snapshot', disabled: false },
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
                <FormSection title=" Use signaling to perform actions on the pipeline" titleElement="h2">
                    <FormGroup label="Action" fieldId="pipeline-action" isRequired>
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
                    <FormGroup label="Action type" fieldId="action-type-field" isRequired>
                        <TextInput isDisabled type="text" id="action-type" name="action-type" value="execute-snapshot" />
                    </FormGroup>
                    <FormGroup label="Collection name" fieldId="collection-name-field" isRequired>
                        <TextInput type="text" id="collection-name" name="collection-name" value='"\"public\".\"Collection1\"", "\"public\".\"Collection2\""' />
                    </FormGroup>
                    <FormGroup role="radiogroup" isStack fieldId="snapshot-type" hasNoPaddingTop label="Snapshot type" >
                        <Radio name="incremental-snapshot-type" label="Incremental" isChecked id="incremental-snapshot-type" />
                        <Radio name="blocking-snapshot-type" label="Blocking" id="blocking-snapshot-type" isDisabled />
                    </FormGroup>
                </FormSection>
                <FormFieldGroupExpandable
                    style={{ border: "none" }}
                    isExpanded
                    toggleAriaLabel="Details"
                    header={
                        <FormFieldGroupHeader
                            titleText={{ text: 'Filter conditions', id: 'action-filter-condition' }}
                            titleDescription="Additional conditions that the connector evaluates to determine the subset of records to include in a snapshot."

                        />
                    }
                >
                    <FormGroup label="Collection name" fieldId="filter-collection-name-field" isRequired>
                        <TextInput type="text" id="filter-collection-name" name="filter-collection-name" value='"\"public\".\"MyFirstTable\""' />
                    </FormGroup>
                    <FormGroup label="Filters" fieldId="filter-filed" isRequired>
                        <TextInput type="text" id="filter" name="filter" value="color='blue' AND brand='MyBrand'" />
                    </FormGroup>
                </FormFieldGroupExpandable>
                <ActionGroup>
                    <Button variant="primary">Submit</Button>
                    <Button variant="link">Clear</Button>
                </ActionGroup>
            </Form>
        </>

    );
};

export default PipelineAction;