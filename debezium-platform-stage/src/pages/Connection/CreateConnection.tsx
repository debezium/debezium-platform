import PageHeader from "@components/PageHeader";
import { ActionList, ActionListGroup, ActionListItem, Button, Card, CardBody, Content, Form, FormFieldGroup, FormFieldGroupHeader, FormGroup, FormGroupLabelHelp, Grid, PageSection, Popover, Split, SplitItem, TextInput } from "@patternfly/react-core";
import * as React from "react";
import _, { } from "lodash";
import { Controller, useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ConnectionPayload, ConnectionsSchema, ConnectionValidationResult, createPost } from "src/apis";
import style from "../../styles/createConnector.module.css"
import ConnectorImage from "@components/ComponentImage";
import { convertMapToObject, getConnectorTypeName } from "@utils/helpers";
import { PlusIcon, TrashIcon } from "@patternfly/react-icons";
import { t } from "i18next";
import { useState } from "react";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";

export interface ICreateConnectionProps {
    sampleProp?: string;
}

type Properties = { key: string; value: string };

type ConnectionFormValues = {
    name: string;
    [key: string]: string | number;
};

const CreateConnection: React.FunctionComponent<ICreateConnectionProps> = () => {
    const navigate = useNavigate();
    // const { t } = useTranslation();
    const { addNotification } = useNotification();
    const location = useLocation();

    const { connectionId } = useParams<{ connectionId: string }>();
    const [connectionValidated, setConnectionValidated] = useState<boolean>(false);


    const state = location.state as { connectionType?: string, connectionSchema?: ConnectionsSchema } | null;
    const connectionType = state?.connectionType;
    const selectedSchema = state?.connectionSchema;
    const selectedSchemaProperties = selectedSchema?.schema;

    const [errorWarning] = useState<string[]>([]);
    const [properties, setProperties] = useState<Map<string, Properties>>(
        new Map([["key0", { key: "", value: "" }]])
    );
    const [keyCount, setKeyCount] = React.useState<number>(1);

    //   const validate = ajv.compile(connectorSchema);

    const handleAddProperty = () => {
        const newKey = `key${keyCount}`;
        setProperties(
            (prevProperties) =>
                new Map(prevProperties.set(newKey, { key: "", value: "" }))
        );
        setKeyCount((prevCount) => prevCount + 1);
    };

    const handleDeleteProperty = (key: string) => {
        setProperties((prevProperties) => {
            const newProperties = new Map(prevProperties);
            newProperties.delete(key);
            return newProperties;
        });
    };

    const handlePropertyChange = (
        key: string,
        type: "key" | "value",
        newValue: string
    ) => {
        setProperties((prevProperties) => {
            const newProperties = new Map(prevProperties);
            const property = newProperties.get(key);
            if (property) {
                if (type === "key") property.key = newValue;
                else if (type === "value") property.value = newValue;
                newProperties.set(key, property);
            }
            return newProperties;
        });
    };


    const { control, handleSubmit } = useForm<ConnectionFormValues>(
        //     {
        //     defaultValues: {
        //         fullName: ''
        //     }
        // }
    );
    // const onSubmit = (data: any) => {
    //     console.log("data", data);
    //     console.log("properties", properties);
    // };

    const validateConnection = async (payload: ConnectionPayload) => {
        console.log("payload", payload);
        const response = await createPost(`${API_URL}/api/connections/validate`, payload);

        if (response.error) {
            addNotification(
                "danger",
                `Connection validation failed`,
                `Failed to validate `
            );
        }
        else if ((response.data as ConnectionValidationResult).valid === false) {
            addNotification(
                "danger",
                `Connection validation failed`,
                `${(response.data as ConnectionValidationResult).errorType}: ${(response.data as ConnectionValidationResult).message}`
            );
        }
        else {

            addNotification(
                "success",
                `Validation successful`,
                `Connection validated successfully.`
            );
            setConnectionValidated(true);
        }
    };

    const createConnection = async (payload: ConnectionPayload) => {
        console.log("payload", payload);
        const response = await createPost(`${API_URL}/api/connections`, payload);

        if (response.error) {
            addNotification(
                "danger",
                `Connection validation failed`,
                `Failed to validate `
            );
        }
        else {
            addNotification(
                "success",
                `Validation successful`,
                `Connection validated successfully.`
            );
            navigate("/connections")
        }
    };

    const validateSubmit = (data: ConnectionFormValues) => {
        console.log("data", data);
        const { name, ...dataWithoutName } = data;
        const payload = selectedSchema ? {
            type: selectedSchema?.type.toUpperCase() || connectionId?.toUpperCase() || "",
            // id: connectionId?.toUpperCase() || "",
            config: { ...dataWithoutName },
            name
        } as ConnectionPayload : {
            type: connectionId?.toUpperCase() || "",
            // id: connectionId?.toUpperCase() || "",
            config: convertMapToObject(properties),
            name
        };
        if (connectionValidated || !selectedSchemaProperties) {
            createConnection(payload);
        } else {
            validateConnection(payload);
        }

    }



    return (
        <>
            <PageHeader
                title={"Create connection"}
                description={"Create connection by filling the form below, you can create connection for both source and destination. And can be used when you are creating any source or destination in the future."}
            />
            <PageSection
                isWidthLimited
                isCenterAligned
                isFilled
                className={`customPageSection ${style.createConnector_pageSection}`}
            >

                <Card className="custom-card-body">
                    <CardBody isFilled>
                        <Form id="create-connection-form" onSubmit={handleSubmit(validateSubmit)} isWidthLimited>
                            <FormGroup
                                label={`${_.capitalize(connectionType)} connection`}
                                fieldId={`connection-type-field`}
                            >
                                <>
                                    <ConnectorImage connectorType={selectedSchema?.type.toLowerCase() || connectionId || ""} size={35} />
                                    <Content component="p" style={{ paddingLeft: "10px" }}>
                                        {getConnectorTypeName(selectedSchema?.type.toLowerCase() || connectionId || "")}
                                    </Content>
                                </>
                            </FormGroup>
                            <FormGroup

                                label={"Name"}
                                fieldId={"connection-name"}
                                isRequired
                            >
                                <Controller
                                    name={"name"}
                                    control={control}
                                    render={({ field }) => <TextInput id="connection-name" {...field} />}
                                />

                            </FormGroup>
                            <FormFieldGroup
                                header={
                                    <FormFieldGroupHeader
                                        titleText={{
                                            text: <span style={{ fontWeight: 500 }}>{selectedSchemaProperties ? selectedSchemaProperties.description : `${getConnectorTypeName(selectedSchema?.type.toLowerCase() || connectionId || "")} connection properties`}</span>,
                                            id: `field-group-${connectionId}-id`,
                                        }}
                                        titleDescription={!selectedSchemaProperties ? t("form.subHeading.description") : "Enter the connection properties"}
                                        actions={
                                            !selectedSchemaProperties ?
                                                <>
                                                    <Button
                                                        variant="secondary"
                                                        icon={<PlusIcon />}
                                                        onClick={handleAddProperty}
                                                    >
                                                        {t("form.addFieldButton")}
                                                    </Button>
                                                </>
                                                : null
                                        }
                                    />
                                }
                            >


                                {selectedSchemaProperties ?
                                    (
                                        Object.entries(selectedSchemaProperties.properties).map(([propertyName, propertySchema]) => (
                                            <FormGroup
                                                key={propertyName}
                                                label={_.capitalize(propertySchema.title)}
                                                fieldId={propertyName}
                                                isRequired={selectedSchemaProperties.required.includes(propertyName)}
                                                labelHelp={
                                                    <Popover


                                                        bodyContent={
                                                            <div>
                                                                {propertySchema.title}
                                                            </div>
                                                        }
                                                    >
                                                        <FormGroupLabelHelp aria-label={propertySchema.title} />
                                                    </Popover>
                                                }
                                            >
                                                {propertySchema.type === "string" && <Controller
                                                    name={propertyName}
                                                    control={control}
                                                    render={({ field }) => <TextInput id={propertyName}  {...field} />}
                                                />}
                                                {propertySchema.type === "integer" && <Controller
                                                    name={propertyName}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <TextInput
                                                            id={propertyName}
                                                            type="number"
                                                            {...field}
                                                            onChange={(_e, value) => field.onChange(value === '' ? '' : Number(value))}
                                                        />
                                                    )}
                                                />}



                                            </FormGroup>
                                        ))

                                    ) :
                                    (

                                        <>
                                            {Array.from(properties.keys()).map((key) => (
                                                <Split hasGutter key={key}>
                                                    <SplitItem isFilled>
                                                        <Grid hasGutter md={6}>
                                                            <FormGroup
                                                                label=""
                                                                isRequired
                                                                fieldId={`${connectionId}-config-props-key-field-${key}`}
                                                            >
                                                                <TextInput
                                                                    // readOnlyVariant={viewMode ? "default" : undefined}
                                                                    isRequired
                                                                    type="text"
                                                                    placeholder="Key"
                                                                    validated={errorWarning.includes(key) ? "error" : "default"}
                                                                    id={`${connectionId}-config-props-key-${key}`}
                                                                    name={`${connectionId}-config-props-key-${key}`}
                                                                    value={properties.get(key)?.key || ""}
                                                                    onChange={(_e, value) =>
                                                                        handlePropertyChange(key, "key", value)
                                                                    }
                                                                />
                                                            </FormGroup>
                                                            <FormGroup
                                                                label=""
                                                                isRequired
                                                                fieldId={`${connectionId}-config-props-value-field-${key}`}
                                                            >
                                                                <TextInput
                                                                    // readOnlyVariant={viewMode ? "default" : undefined}
                                                                    isRequired
                                                                    type="text"
                                                                    id={`${connectionId}-config-props-value-${key}`}
                                                                    placeholder="Value"
                                                                    validated={errorWarning.includes(key) ? "error" : "default"}
                                                                    name={`${connectionId}-config-props-value-${key}`}
                                                                    value={properties.get(key)?.value || ""}
                                                                    onChange={(_e, value) =>
                                                                        handlePropertyChange(key, "value", value)
                                                                    }
                                                                />
                                                            </FormGroup>
                                                        </Grid>
                                                    </SplitItem>
                                                    <SplitItem>
                                                        <Button
                                                            variant="plain"
                                                            // isDisabled={viewMode}
                                                            aria-label="Remove"
                                                            onClick={() => handleDeleteProperty(key)}
                                                        >
                                                            <TrashIcon />
                                                        </Button>
                                                    </SplitItem>
                                                </Split>
                                            ))}
                                        </>
                                    )}
                            </FormFieldGroup>
                        </Form>
                    </CardBody>
                </Card>

            </PageSection>

            <PageSection className="pf-m-sticky-bottom" isFilled={false}>
                <ActionList>
                    <ActionListGroup>
                        <ActionListItem>
                            {selectedSchema ?
                                <Button variant="primary" type="submit" form="create-connection-form" isDisabled={!connectionValidated}>Create connection</Button>
                                : <Button variant="primary" type="submit" form="create-connection-form" >Create connection</Button>}

                        </ActionListItem>
                        {selectedSchema && <ActionListItem>
                            <Button variant="secondary" type="submit" form="create-connection-form">Validate</Button>
                        </ActionListItem>}
                        <ActionListItem>
                            <Button variant="link" onClick={() => navigate("/connections/catalog")}>Back to catalog</Button>
                        </ActionListItem>
                    </ActionListGroup>
                </ActionList>

            </PageSection>



        </>
    );
};

export { CreateConnection };