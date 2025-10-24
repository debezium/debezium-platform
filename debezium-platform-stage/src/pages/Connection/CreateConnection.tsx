import PageHeader from "@components/PageHeader";
import { ActionList, ActionListGroup, ActionListItem, Alert, Button, Card, CardBody, Content, Form, FormAlert, FormFieldGroup, FormFieldGroupHeader, FormGroup, FormGroupLabelHelp, FormHelperText, Grid, HelperText, HelperTextItem, PageSection, Popover, Split, SplitItem, TextInput } from "@patternfly/react-core";
import * as React from "react";
import _, { } from "lodash";
import { Controller, useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Connection, ConnectionConfig, ConnectionPayload, ConnectionsSchema, ConnectionValidationResult, createPost, fetchData } from "src/apis";
import style from "../../styles/createConnector.module.css"
import ConnectorImage from "@components/ComponentImage";
import { convertMapToObject, getConnectorTypeName } from "@utils/helpers";
import { ExclamationCircleIcon, PlusIcon, TrashIcon } from "@patternfly/react-icons";
import { useState } from "react";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";
import * as yup from "yup";
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";

export interface ICreateConnectionProps {
    selectedConnectionType?: "source" | "destination";
    selectedConnectionId?: string;
    handleConnectionModalToggle?: () => void;
    setSelectedConnection?: (connection: ConnectionConfig) => void;
}

type Properties = { key: string; value: string };

type ConnectionFormValues = {
    [key: string]: string | number;
};

const CreateConnection: React.FunctionComponent<ICreateConnectionProps> = ({ selectedConnectionType, selectedConnectionId, handleConnectionModalToggle, setSelectedConnection }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { addNotification } = useNotification();
    const location = useLocation();

    const { connectionId: connectionIdParam } = useParams<{ connectionId: string }>();
    const connectionId = selectedConnectionId ? selectedConnectionId : connectionIdParam || "";
    const [connectionValidated, setConnectionValidated] = useState<boolean>(false);


    const state = location.state as { connectionType?: string } | null;
    const connectionType = state ? state.connectionType : selectedConnectionType;

    const [errorWarning, setErrorWarning] = useState<string[]>([]);
    const [properties, setProperties] = useState<Map<string, Properties>>(
        new Map([["key0", { key: "", value: "" }]])
    );
    const [keyCount, setKeyCount] = React.useState<number>(1);

    const { data: connectionsSchema = [] } = useQuery<ConnectionsSchema[], Error>("connectionsSchema", () =>
        fetchData<ConnectionsSchema[]>(`${API_URL}/api/connections/schemas`)
    );

    const selectedSchema = React.useMemo(() => {
        return connectionsSchema.find((schema) => schema.type.toLowerCase() === (connectionId || "").toLowerCase());
    }, [connectionsSchema, connectionId]);

    const selectedSchemaProperties = selectedSchema?.schema;



    const buildNestedSchema = () => {
        if (!selectedSchemaProperties?.properties) return {};
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schemaObj: any = {};
        
        Object.entries(selectedSchemaProperties.properties).forEach(([field, propSchema]) => {
            const isRequired = selectedSchemaProperties['required']?.includes(field);
            const isNumeric = propSchema.type === "integer";
            const validator = isNumeric
                ? yup
                    .number()
                    .transform((currentValue, originalValue) => (originalValue === '' ? undefined : currentValue))
                    .typeError("Must be a integer")
                : yup.string();
            
            const finalValidator = isRequired ? validator.required() : validator.notRequired();
            
            if (field.includes('.')) {
                const parts = field.split('.');
                let current = schemaObj;
                
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    if (!current[part]) {
                        current[part] = {};
                    }
                    current = current[part];
                }
                
                current[parts[parts.length - 1]] = finalValidator;
            } else {
                schemaObj[field] = finalValidator;
            }
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const convertToYupObjects = (obj: any): any => {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result: any = {};
            for (const key in obj) {
                if (obj[key] && typeof obj[key] === 'object' && !obj[key]._type) {
                    result[key] = yup.object(convertToYupObjects(obj[key]));
                } else {
                    result[key] = obj[key];
                }
            }
            return result;
        };
        
        return convertToYupObjects(schemaObj);
    };

    const schema = yup.object({
        name: yup.string().required(),
        ...buildNestedSchema()
    }).required();

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


    const { formState: { errors }, control, handleSubmit } = useForm<ConnectionFormValues>(
        {
            resolver: yupResolver(schema)
        }
    );


    const validateConnection = async (payload: ConnectionPayload) => {
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
        const response = await createPost(`${API_URL}/api/connections`, payload);

        if (response.error) {
            addNotification(
                "danger",
                `Connection creation failed`,
                `Failed to create connection ${payload.name}: ${response.error}`
            );
        }
        else {
            addNotification(
                "success",
                `Creation successful`,
                `Connection ${payload.name} created successfully.`
            );
            if (selectedConnectionType) {
                setSelectedConnection && setSelectedConnection({ id: (response.data as Connection)?.id, name: (response.data as Connection)?.name } as ConnectionConfig);
                handleConnectionModalToggle && handleConnectionModalToggle();
            }
            else {
                navigate("/connections")
            }
        }
    };

    const validateSubmit = (data: ConnectionFormValues) => {
        const { name } = data;
        const schemaPropertyKeys = selectedSchemaProperties?.properties
            ? Object.keys(selectedSchemaProperties.properties)
            : [];
        const configFromForm = schemaPropertyKeys.reduce((acc: Record<string, string | number>, key) => {
            const value = _.get(data, key) as string | number | undefined;
            if (value !== undefined) {
                acc[key] = value;
            }
            return acc;
        }, {} as Record<string, string | number>);

        const payload = selectedSchema ? ({
            type: selectedSchema?.type.toUpperCase() || connectionId?.toUpperCase() || "",
            config: { ...configFromForm, ...convertMapToObject(properties, errorWarning, setErrorWarning) },
            name: name as string
        } as ConnectionPayload) : {
            type: connectionId?.toUpperCase() || "",
            config: convertMapToObject(properties, errorWarning, setErrorWarning),
            name: name as string
        };
        if (connectionValidated || !selectedSchemaProperties) {
            createConnection(payload);
        } else {
            validateConnection(payload);
        }

    }
    return (
        <>
            {!selectedConnectionId && (
                <PageHeader
                    title={t("connection:create.title")}
                    description={t("connection:create.description")}
                />
            )}

            <PageSection
                isWidthLimited
                isCenterAligned
                isFilled
                className={`customPageSection ${style.createConnector_pageSection}`}
            >

                <Card className="custom-card-body">
                    <CardBody isFilled>
                        <Form id="create-connection-form" onSubmit={handleSubmit(validateSubmit)} isWidthLimited>
                            {!_.isEmpty(errors) && (
                                <FormAlert>
                                    <Alert variant="danger" title={t("common:form.error.title")} aria-live="polite" isInline />
                                </FormAlert>
                            )}
                            <FormGroup
                                label={`${t("connection:create.connectionType", { val: _.capitalize(connectionType) })}`}
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

                                label={t("name")}
                                fieldId={"connection-name"}
                                isRequired
                            >
                                <Controller
                                    name={"name"}
                                    control={control}
                                    rules={{ required: true }}
                                    render={({ field }) => <TextInput id="connection-name" {...field} validated={errors.name ? "error" : "default"} />}
                                />
                                {errors.name && (
                                    <FormHelperText>
                                        <HelperText>
                                            <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                                                {t("common:form.error.required", { val: t("name") })}
                                            </HelperTextItem>
                                        </HelperText>
                                    </FormHelperText>)}

                            </FormGroup>


                            {selectedSchemaProperties &&
                                (
                                    <FormFieldGroup
                                        header={
                                            <FormFieldGroupHeader
                                                titleText={{
                                                    text: <span style={{ fontWeight: 500 }}>{selectedSchemaProperties.description}</span>,
                                                    id: `field-group-${connectionId}-schema-id`,
                                                }}
                                                titleDescription={t("connection:create.subHeading")}

                                            />
                                        }
                                    >{
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
                                                        rules={{ required: selectedSchemaProperties.required.includes(propertyName) }}
                                                        control={control}
                                                        render={({ field }) => <TextInput id={propertyName}  {...field} validated={_.get(errors, propertyName) ? "error" : "default"} />}
                                                    />}
                                                    {propertySchema.type === "list" && <Controller
                                                        name={propertyName}
                                                        rules={{ required: selectedSchemaProperties.required.includes(propertyName) }}
                                                        control={control}
                                                        render={({ field }) => <TextInput id={propertyName}  {...field} validated={_.get(errors, propertyName) ? "error" : "default"} />}
                                                    />}
                                                    {propertySchema.type === "integer" && <Controller
                                                        name={propertyName}
                                                        control={control}
                                                        rules={{
                                                            required: selectedSchemaProperties.required.includes(propertyName)
                                                        }}
                                                        render={({ field }) => (
                                                            <TextInput
                                                                id={propertyName}
                                                                type="number"
                                                                {...field}
                                                                validated={_.get(errors, propertyName) ? "error" : "default"}
                                                                onChange={(_e, value) => field.onChange(value === '' ? '' : Number(value))}
                                                            />
                                                        )}
                                                    />}

                                                    {_.get(errors, propertyName) && (
                                                        <FormHelperText>
                                                            <HelperText>
                                                                <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                                                                    {t("common:form.error.required", { val: _.capitalize(propertyName) })}
                                                                </HelperTextItem>
                                                            </HelperText>
                                                        </FormHelperText>)}

                                                    {propertySchema.type === "integer" && (<FormHelperText>
                                                        <HelperText>
                                                            <HelperTextItem variant="default">
                                                                {t("common:form.error.numerical", { val: _.capitalize(propertyName) })}
                                                            </HelperTextItem>
                                                        </HelperText>
                                                    </FormHelperText>)}

                                                </FormGroup>
                                            ))}
                                    </FormFieldGroup>
                                )}


                            <FormFieldGroup
                                header={
                                    <FormFieldGroupHeader
                                        titleText={{
                                            text: <span style={{ fontWeight: 500 }}>{`Additional properties`}</span>,
                                            id: `field-group-${connectionId}-properties-id`,
                                        }}
                                        titleDescription={t("form.subHeading.description")}
                                        actions={

                                            <>
                                                <Button
                                                    variant="secondary"
                                                    icon={<PlusIcon />}
                                                    onClick={handleAddProperty}
                                                >
                                                    {t("form.addFieldButton")}
                                                </Button>
                                            </>

                                        }
                                    />
                                }
                            >
                                <>
                                    {Array.from(properties.keys()).map((key) => (
                                        <Split hasGutter key={key}>
                                            <SplitItem isFilled>
                                                <Grid hasGutter md={6}>
                                                    <FormGroup
                                                        label=""
                                                        isRequired
                                                        fieldId={`${connectionType}-config-props-key-field-${key}`}
                                                    >
                                                        <TextInput
                                                            //   readOnlyVariant={viewMode ? "default" : undefined}
                                                            isRequired
                                                            type="text"
                                                            placeholder="Key"
                                                            validated={errorWarning.includes(key) ? "error" : "default"}
                                                            id={`${connectionType}-config-props-key-${key}`}
                                                            name={`${connectionType}-config-props-key-${key}`}
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
                            </FormFieldGroup>
                        </Form>
                    </CardBody>
                </Card>

            </PageSection>

            <PageSection className="pf-m-sticky-bottom" isFilled={false} style={selectedConnectionId ? { marginTop: "20px" } : {}}>
                <ActionList>
                    <ActionListGroup>
                        {selectedSchema && <ActionListItem>
                            <Button variant="secondary" type="submit" form="create-connection-form">{t("connection:create.validate")}</Button>
                        </ActionListItem>}
                        <ActionListItem>
                            {selectedSchema ?
                                <Button variant="primary" type="submit" form="create-connection-form" isDisabled={!connectionValidated}>{t("connection:create.createConnection")}</Button>
                                : <Button variant="primary" type="submit" form="create-connection-form" >{t("connection:create.createConnection")}</Button>}

                        </ActionListItem>

                        <ActionListItem>
                            {selectedConnectionType ? <Button variant="link" onClick={handleConnectionModalToggle}>{t("cancel")}</Button> : <Button variant="link" onClick={() => navigate("/connections/catalog")}>{t("backToCatalog")}</Button>}
                        </ActionListItem>
                    </ActionListGroup>
                </ActionList>
            </PageSection>
        </>
    );
};

export { CreateConnection };
