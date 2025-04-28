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
  Checkbox,
  ClipboardCopy,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from "@patternfly/react-core";
import { AddCircleOIcon, CheckCircleIcon, PlusIcon, TrashIcon } from "@patternfly/react-icons";
import { getConnectorTypeName } from "@utils/helpers";
import ConnectorImage from "./ComponentImage";
import { useTranslation } from "react-i18next";
import { useState } from "react";

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
}: SourceSinkFormProps) => {
  const { t } = useTranslation();
  const connectorLabel = connectorType === "source" ? "Source" : "Destination";

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [signalColectionName, setSignalColectionName] = useState("");

  const [setDone, setSetDone] = useState(false);

  const signalCollectionConfigured = (_event: KeyboardEvent | React.MouseEvent) => {
    setSetDone(true);

    setIsModalOpen(false);
  }

  const handleModalToggle = (_event: KeyboardEvent | React.MouseEvent) => {
    setIsModalOpen(!isModalOpen);
  };

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
                id={`${connectorType}-description`}
                aria-label={`${connectorLabel} description`}
                onChange={(_event, value) => setValue("description", value)}
                value={getValue(`description`)}
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {t("form.field.description.helper", { val: connectorType })}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>

            <FormFieldGroup
              header={
                <FormFieldGroupHeader
                  titleText={{
                    text: t("form.subHeading.title"),
                    id: `field-group-${connectorType}-id`,
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
                      aria-label="Remove"
                      onClick={() => handleDeleteProperty(key)}
                    >
                      <TrashIcon />
                    </Button>
                  </SplitItem>
                </Split>
              ))}
            </FormFieldGroup>
            <FormFieldGroup
              header={
                <FormFieldGroupHeader
                  titleText={{
                    text: "Enable signal",
                    id: `field-group-signal-id`,
                  }}
                  titleDescription={
                    "To enable the signaling capability, set the Signaling collection name and confirm that databse DDL has ben execulted."
                  }
                />
              }
            >
              <Button variant="link" size="lg" icon={setDone ? <CheckCircleIcon style={{ color: "#3D7318" }} /> : <AddCircleOIcon />} iconPosition="left" onClick={handleModalToggle}>
                Setup signaling
              </Button>

            </FormFieldGroup>
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
          title="Enable Signalling"
          labelId="modal-with-description-title"
          description="A description is used when you want to provide more info about the modal than the title is able to describe. The content in the description is static and will not scroll with the rest of the modal body."
        />

        <ModalBody tabIndex={0} id="modal-box-body-with-description">

          <Form isWidthLimited>
            <FormGroup
              label="Signaling collection name"
              isRequired
              fieldId={`signaling-collection-name`}
            >
              <TextInput
                id={`signaling-collection-name`}
                aria-label={`signaling-collection-name`}
                onBlur={(_event) => {
                  setSignalColectionName((prevValue) =>
                    prevValue.endsWith("_debezium_signal")
                      ? prevValue
                      : `${prevValue}_debezium_signal`
                  );
                }}
                onChange={(_event, value) => {
                  setSignalColectionName(value);
                }}
                value={signalColectionName}
              />
            </FormGroup>
            <FormGroup
              label="DDL query"
              isRequired
              fieldId={`ddl-query-name`}
            >
              <ClipboardCopy isReadOnly hoverTip="Copy" clickTip="Copied">
                {`CREATE TABLE ${signalColectionName} (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);`}
              </ClipboardCopy>
            </FormGroup>

            <Checkbox
              isLabelWrapped
              label="DDL has been executed by the DBA"
              id="checkbox-label-wraps-input"
              name="checkbox-label-wraps-input"
            />
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button key="confirm" variant="primary" onClick={signalCollectionConfigured}>
            Confirm
          </Button>
          <Button key="cancel" variant="link" onClick={handleModalToggle}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

    </>
  );
};

export default SourceSinkForm;
