
import { ActionList, ActionListGroup, ActionListItem, Alert, Button, Card, CardBody, Content, Form, FormAlert, FormFieldGroup, FormFieldGroupHeader, FormGroup, FormGroupLabelHelp, FormHelperText, HelperText, HelperTextItem, PageSection, Popover, TextInput } from "@patternfly/react-core";
import * as React from "react";
import _, { } from "lodash";
import { Controller, useForm } from "react-hook-form";
import { useParams, useSearchParams } from "react-router-dom";
import { Connection, ConnectionAdditionalConfig, ConnectionPayload, ConnectionsSchema, ConnectionValidationResult, createPost, editPut, fetchDataTypeTwo } from "src/apis";
import style from "../../styles/createConnector.module.css"
import ConnectorImage from "@components/ComponentImage";
import { buildFlatConfigFromFormData, buildNestedConnectionYupFields, flatConnectionConfigToRhfShape } from "@utils/connectionForm";
import {
    additionalRowWithNewValueKind,
    createEmptyAdditionalPropertyRow,
    mapApiConfigToAdditionalRows,
    mergeConnectionConfig,
    validateAdditionalPropertyRows,
    type AdditionalPropertyRow,
    type AdditionalPropertyRowErrorCode,
    type AdditionalPropertyValueKind,
} from "@utils/additionalConfigProperties";
import { getConnectorTypeName } from "@utils/helpers";
import { AdditionalPropertiesRows } from "@components/AdditionalPropertiesRows";
import { ExclamationCircleIcon, PencilAltIcon, PlusIcon } from "@patternfly/react-icons";
import { useEffect, useState } from "react";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";
import * as yup from "yup";
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from "react-i18next";
import { PageHeader } from "@patternfly/react-component-groups";

export interface IEditConnectionProps {
    sampleProp?: string;
}

type ConnectionFormValues = {
    [key: string]: string | number;
};

const EditConnection: React.FunctionComponent<IEditConnectionProps> = () => {
    // const navigate = useNavigate();
    const { t } = useTranslation();
    const { addNotification } = useNotification();

    const { connectionId } = useParams<{ connectionId: string }>();
    const [isLoading, setIsLoading] = useState(false);
    const [connection, setConnection] = useState<Connection>();
    const [schemas, setSchemas] = useState<ConnectionsSchema[]>([]);
    const [connectionValidated, setConnectionValidated] = useState<boolean>(false);
    const [selectedSchema, setSelectedSchema] = useState<ConnectionsSchema>();



    const [additionalPropertyErrors, setAdditionalPropertyErrors] = useState<{
        rowIdsWithErrors: Set<string>;
        rowErrorCodes: Map<string, AdditionalPropertyRowErrorCode[]>;
    } | null>(null);
    const [properties, setProperties] = useState<Map<string, AdditionalPropertyRow>>(() => new Map([["key0", createEmptyAdditionalPropertyRow()]]));
    const [keyCount, setKeyCount] = React.useState<number>(1);

    const [searchParams] = useSearchParams();
    const initialState = searchParams.get("state") as "view" | "edit" | null;

    const [viewMode, setViewMode] = useState<boolean>(initialState === "view");

    const setConfigPropertiesFromApi = (configProp: ConnectionAdditionalConfig | Record<string, unknown>) => {
        const entries = Object.entries(configProp);
        if (entries.length === 0) {
            setProperties(new Map([["key0", createEmptyAdditionalPropertyRow()]]));
            setKeyCount(1);
            return;
        }
        const map = mapApiConfigToAdditionalRows(configProp as Record<string, unknown>);
        setProperties(map);
        setKeyCount(map.size);
    };

    const schema = yup.object({
        name: yup.string().required(),
        ...buildNestedConnectionYupFields(selectedSchema?.schema)
    }).required() as yup.ObjectSchema<ConnectionFormValues>;

    const { formState: { errors }, control, handleSubmit, reset } = useForm<ConnectionFormValues>(
        {
            defaultValues: {
                name: connection?.name || "",
                ...(connection?.config
                    ? flatConnectionConfigToRhfShape(connection.config as Record<string, unknown>)
                    : {}),
            } as ConnectionFormValues,
            resolver: yupResolver(schema)
        }
    );

    useEffect(() => {
        const fetchConnections = async () => {

            const response = await fetchDataTypeTwo<Connection>(
                `${API_URL}/api/connections/${connectionId}`
            );
            if (response.error) {
                console.log("Error fetching connection:", response.error);
            } else {
                setConnection(response.data as Connection);
                const selectedSchema = schemas.find(schema => schema.type === response.data?.type);
                setSelectedSchema(selectedSchema);

                if (selectedSchema?.schema?.properties && response.data?.config) {
                    const schemaFields = Object.keys(selectedSchema.schema.properties);
                    const config = response.data.config;
                    // Fields that are in the schema
                    const formFields: Record<string, unknown> = {};
                    // Fields that are not in the schema
                    const otherConfig: Record<string, unknown> = {};
                    Object.entries(config).forEach(([key, value]) => {
                        if (schemaFields.includes(key)) {
                            formFields[key] = value;
                        } else {
                            otherConfig[key] = value;
                        }
                    });
                    reset({
                        name: response.data?.name || "",
                        ...flatConnectionConfigToRhfShape(formFields),
                    });
                    // Assign the remaining properties to setConfigProperties
                    if (Object.keys(otherConfig).length > 0) {
                        setConfigPropertiesFromApi(otherConfig as ConnectionAdditionalConfig ?? {});
                    } else {
                        setConfigPropertiesFromApi({});
                    }
                }
                else if (schemas.length > 0 && selectedSchema === undefined) {

                    reset({
                        name: response.data?.name || "",
                    });
                    setConfigPropertiesFromApi(response.data?.config as ConnectionAdditionalConfig ?? {});
                }



            }
        };

        fetchConnections();
    }, [connectionId, schemas, reset]);

    useEffect(() => {
        const fetchSchemas = async () => {

            const response = await fetchDataTypeTwo<ConnectionsSchema[]>(
                `${API_URL}/api/connections/schemas`
            );

            if (response.error) {
                console.log("Error fetching schemas:", response.error);

            } else {
                setSchemas(response.data as ConnectionsSchema[]);
            }


        };

        fetchSchemas();
    }, []);

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

    const editSource = async (payload: ConnectionPayload) => {
        const response = await editPut(
            `${API_URL}/api/connections/${connectionId}`,
            payload
        );

        if (response.error) {
            addNotification(
                "danger",
                t('statusMessage:edit.failedTitle'),
                t("statusMessage:edit.failedDescription", { val: `${(response.data as Connection)?.name}: ${response.error}` }),
            );
        } else {
            addNotification(
                "success",
                t('statusMessage:edit.successTitle'),
                t("statusMessage:edit.successDescription", { val: `${(response.data as Connection)?.name}` })
            );
            setViewMode(true);
        }
    };

    const handleEditConnection = async (payload: ConnectionPayload) => {
        setIsLoading(true);
        // const errorWarning = [] as string[];
        // properties.forEach((value: Properties, key: string) => {
        //     if (value.key === "" || value.value === "") {
        //         errorWarning.push(key);
        //     }
        // });
        // setErrorWarning(errorWarning);
        // if (errorWarning.length > 0) {
        //     addNotification(
        //         "danger",
        //         `Source edit failed`,
        //         `Please fill both Key and Value fields for all the properties.`
        //     );
        //     setIsLoading(false);
        //     return;
        // }
        await editSource(payload as ConnectionPayload);
        setIsLoading(false);
    };

    const buildConnectionPayloadOrNull = (data: ConnectionFormValues): ConnectionPayload | null => {
        const { name } = data;
        const schemaPropertyKeys = selectedSchema?.schema?.properties
            ? Object.keys(selectedSchema.schema.properties)
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
                  type: selectedSchema?.type.toUpperCase() || connection?.type.toUpperCase() || "",
                  config: mergedConfig,
                  name: name as string,
              } as ConnectionPayload)
            : {
                  type: connection?.type.toUpperCase() || "",
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
        if (selectedSchema?.schema) {
            void validateConnection(payload);
        } else {
            void handleEditConnection(payload);
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
        if (selectedSchema?.schema && !connectionValidated) {
            return;
        }
        void handleEditConnection(payload);
    };
    return (
        <>
            {viewMode ? (

                <PageHeader
                    title={connection?.name || t("destination:edit.title")}
                    subtitle={`${getConnectorTypeName(connection?.type.toLowerCase() || "")} connection.`}
                    actionMenu={
                        <Button variant="secondary" ouiaId="Primary" icon={<PencilAltIcon />}
                            onClick={() => { setViewMode(false); }}>
                            {t("edit")}
                        </Button>
                    }
                // icon={ <ConnectorImage connectorType={source?.type || sourceId || ""} size={35} />}
                />
            ) : (
                <PageHeader
                    title={t("connection:edit.title")}
                    subtitle={t("connection:edit.description", { val: getConnectorTypeName(connection?.type.toLowerCase() || "") })}
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
                                label={`${t("connection:create.connectionType", { val: _.capitalize(connection?.type) })}`}
                                fieldId={`connection-type-field`}
                            >
                                <>
                                    <ConnectorImage connectorType={connection?.type.toLowerCase() || connectionId || ""} size={35} />
                                    <Content component="p" style={{ paddingLeft: "10px" }}>
                                        {getConnectorTypeName(connection?.type.toLowerCase() || connectionId || "")}
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
                                    render={({ field }) => <TextInput id="connection-name" {...field} validated={errors.name ? "error" : "default"} readOnlyVariant={viewMode ? "plain" : undefined} />}
                                />
                                {(!viewMode && errors.name) && (
                                    <FormHelperText>
                                        <HelperText>
                                            <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                                                {t("common:form.error.required", { val: t("name") })}
                                            </HelperTextItem>
                                        </HelperText>
                                    </FormHelperText>)}

                            </FormGroup>


                            {selectedSchema?.schema &&
                                (
                                    <FormFieldGroup
                                        header={
                                            <FormFieldGroupHeader
                                                titleText={{
                                                    text: <span style={{ fontWeight: 500 }}>{selectedSchema?.schema?.description}</span>,
                                                    id: `field-group-${connectionId}-schema-id`,
                                                }}
                                                titleDescription={!viewMode ? t("connection:create.subHeading") : undefined}

                                            />
                                        }
                                    >{
                                            Object.entries(selectedSchema?.schema?.properties).map(([propertyName, propertySchema]) => (
                                                <FormGroup
                                                    key={propertyName}
                                                    label={_.capitalize(propertySchema.title)}
                                                    fieldId={propertyName}
                                                    isRequired={selectedSchema?.schema?.required.includes(propertyName)}
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
                                                        rules={{ required: selectedSchema?.schema?.required.includes(propertyName) }}
                                                        control={control}
                                                        render={({ field }) => <TextInput id={propertyName}  {...field} validated={errors[propertyName] ? "error" : "default"} readOnlyVariant={viewMode ? "plain" : undefined} />}
                                                    />}
                                                    {propertySchema.type === "list" && <Controller
                                                        name={propertyName}
                                                        rules={{ required: selectedSchema?.schema?.required.includes(propertyName) }}
                                                        control={control}
                                                        render={({ field }) => <TextInput id={propertyName}  {...field} validated={errors[propertyName] ? "error" : "default"} readOnlyVariant={viewMode ? "plain" : undefined} />}
                                                    />}
                                                    {propertySchema.type === "integer" && <Controller
                                                        name={propertyName}
                                                        control={control}
                                                        rules={{ required: selectedSchema?.schema?.required.includes(propertyName) }}
                                                        render={({ field }) => (
                                                            <TextInput
                                                                id={propertyName}
                                                                type="number"
                                                                {...field}
                                                                validated={errors[propertyName] ? "error" : "default"}
                                                                readOnlyVariant={viewMode ? "plain" : undefined}
                                                                onChange={(_e, value) => field.onChange(value === '' ? '' : Number(value))}
                                                            />
                                                        )}
                                                    />}

                                                    {errors[propertyName] && (
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
                                            text: <span style={{ fontWeight: 500 }}>{t("form.subHeading.title")}</span>,
                                            id: `field-group-${connectionId}-id`,
                                        }}
                                        titleDescription={!viewMode ? t("form.subHeading.description") : undefined}
                                        actions={
                                            viewMode ? null :
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
                                        fieldIdPrefix={`${connection?.type ?? "connection"}-config-props`}
                                        viewMode={viewMode}
                                        properties={properties}
                                        rowIdsWithErrors={additionalPropertyErrors?.rowIdsWithErrors ?? new Set()}
                                        rowErrorCodes={additionalPropertyErrors?.rowErrorCodes ?? new Map()}
                                        onDeleteRow={handleDeleteProperty}
                                        onPatchRow={handlePatchProperty}
                                        onValueKindChange={handleValueKindChange}
                                        showAddRemove={!viewMode}
                                    />
                                </>
                            </FormFieldGroup>
                        </Form>
                    </CardBody>
                </Card>

            </PageSection>

            {!viewMode && (
                <PageSection className="pf-m-sticky-bottom" isFilled={false}>
                    <ActionList>
                        <ActionListGroup>
                            {selectedSchema && <ActionListItem>
                                <Button variant="secondary" type="button" onClick={handleSubmit(handleValidateFromForm)}>{t("connection:create.validate")}</Button>
                            </ActionListItem>}
                            <ActionListItem>
                                {selectedSchema ?
                                    <Button variant="primary" type="submit" form="create-connection-form" isDisabled={!connectionValidated} isLoading={isLoading}>{t("connection:edit.saveChanges")}</Button>
                                    : <Button variant="primary" type="submit" form="create-connection-form" >{t("connection:edit.saveChanges")}</Button>}

                            </ActionListItem>

                            <ActionListItem>
                                <Button variant="link" onClick={() => setViewMode(true)}>
                                    {t("cancel")}
                                </Button>
                            </ActionListItem>
                        </ActionListGroup>
                    </ActionList>
                </PageSection>
            )}

            {/* <EditConfirmationModel
                type="connection"
                isWarningOpen={isWarningOpen}
                setIsWarningOpen={setIsWarningOpen}
                pendingSave={pendingSave}
                setPendingSave={setPendingSave}
                handleEdit={handleEditConnection} /> */}
        </>
    );
};

export { EditConnection };
