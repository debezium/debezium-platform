import {
  Card,
  CardBody,
  FormGroup,
  Content,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
  FormFieldGroup,
  FormFieldGroupHeader,
  Button,
  Split,
  SplitItem,
  Grid,
  Form,
  ClipboardCopy,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Alert,
} from "@patternfly/react-core";
import { AddCircleOIcon, CheckCircleIcon, PlusIcon, TrashIcon } from "@patternfly/react-icons";
import { getConnectorTypeName, getDatabaseType } from "@utils/helpers";
import ConnectorImage from "./ComponentImage";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { verifySignals } from "src/apis";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/index";

interface SourceSinkFormProps {
  ConnectorId: string;
  dataType?: string;
  errorWarning: string[];
  connectorType: "source" | "destination";
  properties: Map<string, { key: string; value: string }>;
  setValue: (key: string, value: string) => void;
  getValue: (key: string) => string;
  setError: (key: string, error: string | undefined) => void;
  errors: Record<string, string | undefined>;
  handleAddProperty: () => void;
  handleDeleteProperty: (key: string) => void;
  handlePropertyChange: (
    key: string,
    type: "key" | "value",
    value: string
  ) => void;
  editFlow?: boolean;
  viewMode?: boolean;
  updateSignalCollectionName?: (name: string) => void;
}
const SourceSinkForm = ({
  ConnectorId,
  dataType,
  connectorType,
  properties,
  setValue,
  getValue,
  setError,
  errorWarning,
  errors,
  handleAddProperty,
  handleDeleteProperty,
  handlePropertyChange,
  editFlow,
  viewMode,
  updateSignalCollectionName
}: SourceSinkFormProps) => {
  const { t } = useTranslation();
  const { addNotification } = useNotification();

  const connectorLabel = connectorType === "source" ? "Source" : "Destination";

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const [signalCollectionName, setSignalCollectionName] = useState("");
  const [signalVerified, setSignalVerified] = useState(false);
  const [signalMissingPayloads, setSignalMissingPayload] = useState<string[]>([]);

  const [setDone, setSetDone] = useState(false);

  const handleModalToggle = () => {
    setIsModalOpen(!isModalOpen);
    setSignalMissingPayload([]);
  };

  const verifySignalsHandler = async () => {
    setIsLoading(true);
    const fromValues = properties.values();
    const formValuesCopy = new Map();
    Array.from(fromValues).map((property) => {
      const { key, value } = property;
      formValuesCopy.set(key, value);
    });


    const payload = {
      databaseType: getDatabaseType(ConnectorId),
      hostname: formValuesCopy.get("database.hostname"),
      port: formValuesCopy.get("database.port"),
      username: formValuesCopy.get("database.user"),
      password: formValuesCopy.get("database.password"),
      dbName: formValuesCopy.get("database.dbname"),
      fullyQualifiedTableName: signalCollectionName
    }

    const requiredFields = ["hostname", "port", "username", "password", "dbName"];
    const missingFields = requiredFields.filter((field) => !payload[field as keyof typeof payload]);

    if (missingFields.length > 0) {
      setSignalMissingPayload(missingFields);
      setIsLoading(false);
      return;

    }
    const response = await verifySignals(`${API_URL}/api/sources/signals/verify`, payload);

    if (response.error) {

      addNotification(
        "danger",
        `Signal verification failed`,
        `Coudn't verify the signal data collection: ${response.error}`
      );
      setIsLoading(false);
    } else {
      setSignalVerified(true);
      addNotification(
        "success",
        `Signal verification succesfully`,
        `Signal data collection verified succesfully: ${signalCollectionName}`
      );
      setIsLoading(false);
    }
  }

  const configureSignalCollection = async () => {
    setIsLoading(true);
    if (updateSignalCollectionName) {
      updateSignalCollectionName(signalCollectionName);
    }
    setSetDone(true);
    setIsLoading(false);
    setIsModalOpen(false);
  }

  return (
    <>
      <Card className="custom-card-body">
        <CardBody isFilled>
          <Form isWidthLimited>
            <FormGroup
              label={t("form.field.type", { val: connectorLabel })}
              isRequired
              fieldId={`${connectorType}-type-field`}
            >
              <>
                <ConnectorImage connectorType={dataType || ConnectorId || ""} size={35} />
                <Content component="p" style={{ paddingLeft: "10px" }}>
                  {getConnectorTypeName(dataType || ConnectorId || "")}
                </Content>
              </>
            </FormGroup>
            <FormGroup
              label={t("form.field.name", { val: connectorLabel })}
              isRequired
              fieldId={`${connectorType}-name-field`}
            >
              <TextInput
                readOnlyVariant={viewMode ? "plain" : undefined}
                id={`${connectorType}-name`}
                aria-label={`${connectorLabel} name`}
                onChange={(_event, value) => {
                  setValue(`${connectorType}-name`, value);
                  setError(`${connectorType}-name`, undefined);
                }}
                value={getValue(`${connectorType}-name`)}
                validated={errors[`${connectorType}-name`] ? "error" : "default"}
              />
            </FormGroup>
            <FormGroup
              label={t("form.field.description.label")}
              fieldId={`${connectorType}-description-field`}
            >
              <TextInput
                readOnlyVariant={viewMode ? "plain" : undefined}
                id={`${connectorType}-description`}
                aria-label={`${connectorLabel} description`}
                onChange={(_event, value) => setValue("description", value)}
                value={getValue(`description`)}
              />
              {!viewMode && (<FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {t("form.field.description.helper", { val: connectorType })}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>)}
            </FormGroup>

            <FormFieldGroup
              header={
                <FormFieldGroupHeader
                  titleText={{
                    text: <span style={{ fontWeight: 500 }}>{t("form.subHeading.title")}</span>,
                    id: `field-group-${connectorType}-id`,
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
              {Array.from(properties.keys()).map((key) => (
                <Split hasGutter key={key}>
                  <SplitItem isFilled>
                    <Grid hasGutter md={6}>
                      <FormGroup
                        label=""
                        isRequired
                        fieldId={`${connectorType}-config-props-key-field-${key}`}
                      >
                        <TextInput
                          readOnlyVariant={viewMode ? "default" : undefined}
                          isRequired
                          type="text"
                          placeholder="Key"
                          validated={errorWarning.includes(key) ? "error" : "default"}
                          id={`${connectorType}-config-props-key-${key}`}
                          name={`${connectorType}-config-props-key-${key}`}
                          value={properties.get(key)?.key || ""}
                          onChange={(_e, value) =>
                            handlePropertyChange(key, "key", value)
                          }
                        />
                      </FormGroup>
                      <FormGroup
                        label=""
                        isRequired
                        fieldId={`${connectorType}-config-props-value-field-${key}`}
                      >
                        <TextInput
                          readOnlyVariant={viewMode ? "default" : undefined}
                          isRequired
                          type="text"
                          id={`${connectorType}-config-props-value-${key}`}
                          placeholder="Value"
                          validated={errorWarning.includes(key) ? "error" : "default"}
                          name={`${connectorType}-config-props-value-${key}`}
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
                      isDisabled={viewMode}
                      aria-label="Remove"
                      onClick={() => handleDeleteProperty(key)}
                    >
                      <TrashIcon />
                    </Button>
                  </SplitItem>
                </Split>
              ))}
            </FormFieldGroup>
            {
              connectorType === "source" && !editFlow &&
              <FormFieldGroup
                header={
                  <FormFieldGroupHeader
                    titleText={{
                      text: t("source:signal.title"),
                      id: `field-group-signal-id`,
                    }}
                    titleDescription={t("source:signal.description")}
                  />
                }
              >
                <Button variant="link" size="lg" icon={setDone ? <CheckCircleIcon style={{ color: "#3D7318" }} /> : <AddCircleOIcon />} iconPosition="left" onClick={handleModalToggle}>
                  {t("source:signal.setupSignaling")}
                </Button>

              </FormFieldGroup>
            }

          </Form>
        </CardBody>
      </Card>
      <Modal
        variant={ModalVariant.medium}
        isOpen={isModalOpen}
        onClose={handleModalToggle}
        aria-labelledby="modal-with-description-title"
        aria-describedby="modal-box-body-with-description"
      >
        <ModalHeader
          title={t("source:signal.title")}
          labelId="modal-with-description-title"
          description={t("source:signal.modelDescription")}
        />
        <ModalBody tabIndex={0} id="modal-box-body-with-description">
          {signalMissingPayloads.length > 0 && (<Alert variant="danger" isInline isPlain title={t('source:signal.errorMsg', { val: signalMissingPayloads.join(", ") })} style={{ paddingBottom: "15px" }} />)}

          {/* <Alert variant="danger" title="Danger alert title" ouiaId="DangerAlert" style={{paddingBottom: "15px"}} />  */}

          <Form isWidthLimited>
            <FormGroup
              label={t("source:signal.signalingCollectionField.label")}
              isRequired
              fieldId={`signaling-collection-name`}
            >
              <TextInput
                id={`signaling-collection-name`}
                aria-label={t("source:signal.signalingCollectionField.label")}
                type="text"
                onChange={(_event, value) => {
                  setSignalCollectionName(value);
                }}
                value={signalCollectionName}
              />
            </FormGroup>
            <FormGroup
              label={t("source:signal.ddlQuery")}
              fieldId={`ddl-query-name`}
            >
              <ClipboardCopy isReadOnly hoverTip={t('copy')} clickTip={t('copied')}>
                {`CREATE TABLE ${signalCollectionName} (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);`}
              </ClipboardCopy>
            </FormGroup>

            {/* <Checkbox
              isLabelWrapped
              label="DDL has been executed by the DBA"
              id="checkbox-label-wraps-input"
              name="checkbox-label-wraps-input"
            /> */}
          </Form>
          {/* <Alert variant="danger" title="Danger alert title" ouiaId="DangerAlert" /> */}
        </ModalBody>

        <ModalFooter>
          {signalVerified ?
            <Button key="done" variant="primary" isLoading={isLoading} onClick={configureSignalCollection} >
              {t("done")}
            </Button>
            :
            <Button key="confirm" variant="primary" isLoading={isLoading} onClick={verifySignalsHandler} >
              {t('verify')}
            </Button>}
          <Button key="cancel" variant="link" onClick={handleModalToggle}>
            {t("cancel")}
          </Button>
        </ModalFooter>
      </Modal>

    </>
  );
};

export default SourceSinkForm;
