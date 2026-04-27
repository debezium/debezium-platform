import PageHeader from "@components/PageHeader";
import { ActionList, ActionListGroup, ActionListItem, Alert, Button, Card, CardBody, Content, Form, FormAlert, FormFieldGroup, FormFieldGroupHeader, FormGroup, FormGroupLabelHelp, FormHelperText, HelperText, HelperTextItem, InputGroup, InputGroupItem, PageSection, Popover, TextInput } from "@patternfly/react-core";
import * as React from "react";
import _, { } from "lodash";
import { Controller, useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Connection, ConnectionConfig, ConnectionPayload, ConnectionsSchema, ConnectionValidationResult, createPost, fetchData } from "src/apis";
import style from "../../styles/createConnector.module.css"
import ConnectorImage from "@components/ComponentImage";
import { buildFlatConfigFromFormData, buildNestedConnectionYupFields } from "@utils/connectionForm";
import {
    additionalRowWithNewValueKind,
    createEmptyAdditionalPropertyRow,
    mergeConnectionConfig,
    validateAdditionalPropertyRows,
    type AdditionalPropertyRow,
    type AdditionalPropertyRowErrorCode,
    type AdditionalPropertyValueKind,
} from "@utils/additionalConfigProperties";
import { getConnectorTypeName } from "@utils/helpers";
import { AdditionalPropertiesRows } from "@components/connection/AdditionalPropertiesRows";
import { ExclamationCircleIcon, EyeIcon, EyeSlashIcon, PlusIcon } from "@patternfly/react-icons";
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
    const [passwordVisible, setPasswordVisible] = useState<Record<string, boolean>>({});


    const state = location.state as { connectionType?: string } | null;
    const connectionType = state ? state.connectionType : selectedConnectionType;

    const [additionalPropertyErrors, setAdditionalPropertyErrors] = useState<{
        rowIdsWithErrors: Set<string>;
        rowErrorCodes: Map<string, AdditionalPropertyRowErrorCode[]>;
    } | null>(null);
    const [properties, setProperties] = useState<Map<string, AdditionalPropertyRow>>(() => new Map([["key0", createEmptyAdditionalPropertyRow()]]));
    const [keyCount, setKeyCount] = React.useState<number>(1);

    const { data: connectionsSchema = [] } = useQuery<ConnectionsSchema[], Error>("connectionsSchema", () =>
        fetchData<ConnectionsSchema[]>(`${API_URL}/api/connections/schemas`)
    );

    const selectedSchema = React.useMemo(() => {
        const normalizedId = (connectionId || "").toLowerCase().replace(/-/g, "_");
        return connectionsSchema.find((schema) => {
            const normalizedType = schema.type.toLowerCase().replace(/-/g, "_");
            return normalizedId === normalizedType || normalizedId.includes(normalizedType);
        });
    }, [connectionsSchema, connectionId]);

    const selectedSchemaProperties = selectedSchema?.schema;

    React.useEffect(() => {
        if (!selectedSchema) {
            setProperties(new Map([["key0", createEmptyAdditionalPropertyRow()]]));
        }
    }, [selectedSchema]);



    const schema = yup.object({
        name: yup.string().required(),
        ...buildNestedConnectionYupFields(selectedSchemaProperties)
    }).required() as yup.ObjectSchema<ConnectionFormValues>;

    const handleAddProperty = () => {
        const newKey = `key${keyCount}`;
        setAdditionalPropertyErrors(null);
        setProperties(
            (prevProperties) =>
                new Map(prevProperties.set(newKey, createEmptyAdditionalPropertyRow()))
        );
        setKeyCount((prevCount) => prevCount + 1);
    };

    const handleDeleteProperty = (rowId: string) => {
        setAdditionalPropertyErrors(null);
        setProperties((prevProperties) => {
            const newProperties = new Map(prevProperties);
            newProperties.delete(rowId);
            return newProperties;
        });
    };

    const handlePatchProperty = (rowId: string, patch: Partial<AdditionalPropertyRow>) => {
        setAdditionalPropertyErrors(null);
        setProperties((prevProperties) => {
            const newProperties = new Map(prevProperties);
            const cur = newProperties.get(rowId);
            if (!cur) {
                return prevProperties;
            }
            newProperties.set(rowId, { ...cur, ...patch });
            return newProperties;
        });
    };

    const handleValueKindChange = (rowId: string, kind: AdditionalPropertyValueKind) => {
        setAdditionalPropertyErrors(null);
        setProperties((prevProperties) => {
            const cur = prevProperties.get(rowId);
            if (!cur) {
                return prevProperties;
            }
            const newProperties = new Map(prevProperties);
            newProperties.set(rowId, additionalRowWithNewValueKind(cur, kind));
            return newProperties;
        });
    };


    const togglePasswordVisibility = (fieldName: string) => {
        setPasswordVisible(prev => ({ ...prev, [fieldName]: !prev[fieldName] }));
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

    const buildConnectionPayloadOrNull = (data: ConnectionFormValues): ConnectionPayload | null => {
        const { name } = data;
        const schemaPropertyKeys = selectedSchemaProperties?.properties
            ? Object.keys(selectedSchemaProperties.properties)
            : [];
        const configFromForm = buildFlatConfigFromFormData(data as Record<string, unknown>, schemaPropertyKeys) as Record<
            string,
            string | number | boolean
        >;
        const validation = validateAdditionalPropertyRows(properties, configFromForm);
        if (validation.hasErrors) {
            setAdditionalPropertyErrors({
                rowIdsWithErrors: new Set(validation.rowIdsWithErrors),
                rowErrorCodes: new Map(validation.rowErrorCodes),
            });
            return null;
        }
        setAdditionalPropertyErrors(null);
        const mergedConfig = mergeConnectionConfig(configFromForm, validation.additionalFlat);

        return selectedSchema
            ? ({
                  type: selectedSchema?.type.toUpperCase() || connectionId?.toUpperCase() || "",
                  config: mergedConfig,
                  name: name as string,
              } as ConnectionPayload)
            : {
                  type: connectionId?.toUpperCase() || "",
                  config: validation.additionalFlat,
                  name: name as string,
              };
    };

    const handleValidateFromForm = (data: ConnectionFormValues) => {
        const payload = buildConnectionPayloadOrNull(data);
        if (!payload) {
            addNotification(
                "danger",
                t("connection:additionalProperties.validationFailedTitle"),
                t("connection:additionalProperties.validationFailedDescription")
            );
            return;
        }
        if (selectedSchemaProperties) {
            void validateConnection(payload);
        } else {
            void createConnection(payload);
        }
    };

    const handleSaveFromForm = (data: ConnectionFormValues) => {
        const payload = buildConnectionPayloadOrNull(data);
        if (!payload) {
            addNotification(
                "danger",
                t("connection:additionalProperties.validationFailedTitle"),
                t("connection:additionalProperties.validationFailedDescription")
            );
            return;
        }
        if (selectedSchemaProperties && !connectionValidated) {
            return;
        }
        void createConnection(payload);
    };
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
                        <Form id="create-connection-form" onSubmit={handleSubmit(handleSaveFromForm)} isWidthLimited>
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
                                                    {propertySchema.type === "string" && propertySchema.title.toLowerCase().includes("password") && <Controller
                                                        name={propertyName}
                                                        rules={{ required: selectedSchemaProperties.required.includes(propertyName) }}
                                                        control={control}
                                                        render={({ field }) => (
                                                            <InputGroup>
                                                                <InputGroupItem isFill>
                                                                    <TextInput
                                                                        id={propertyName}
                                                                        type={passwordVisible[propertyName] ? "text" : "password"}
                                                                        {...field}
                                                                        validated={_.get(errors, propertyName) ? "error" : "default"}
                                                                    />
                                                                </InputGroupItem>
                                                                <InputGroupItem>
                                                                    <Button
                                                                        variant="control"
                                                                        onClick={() => togglePasswordVisibility(propertyName)}
                                                                        aria-label={passwordVisible[propertyName] ? "Hide password" : "Show password"}
                                                                    >
                                                                        {passwordVisible[propertyName] ? <EyeSlashIcon /> : <EyeIcon />}
                                                                    </Button>
                                                                </InputGroupItem>
                                                            </InputGroup>
                                                        )}
                                                    />}
                                                    {propertySchema.type === "string" && !propertySchema.title.toLowerCase().includes("password") && <Controller
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
                                    <AdditionalPropertiesRows
                                        fieldIdPrefix={`${connectionType ?? connectionId ?? "connection"}-config-props`}
                                        properties={properties}
                                        rowIdsWithErrors={additionalPropertyErrors?.rowIdsWithErrors ?? new Set()}
                                        rowErrorCodes={additionalPropertyErrors?.rowErrorCodes ?? new Map()}
                                        onDeleteRow={handleDeleteProperty}
                                        onPatchRow={handlePatchProperty}
                                        onValueKindChange={handleValueKindChange}
                                    />
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
                            <Button variant="secondary" type="button" onClick={handleSubmit(handleValidateFromForm)}>{t("connection:create.validate")}</Button>
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
