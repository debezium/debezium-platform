import * as React from "react";
import {
  Button,
  Form,
  FormGroup,
  FormSection,
  HelperText,
  HelperTextItem,
  MenuToggle,
  MenuToggleElement,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Radio,
  Select,
  SelectList,
  SelectOption,
  TextInput,
} from "@patternfly/react-core";
import { MinusCircleIcon, PlusIcon, TrashIcon } from "@patternfly/react-icons";
import {
  EmailChannelConfig,
  NotificationChannel,
  NotificationChannelRequest,
  NotificationChannelType,
  WebhookChannelConfig,
} from "./alertsTypes";
import { useTranslation } from "react-i18next";

interface AlertChannelFormModalProps {
  isOpen: boolean;
  channel?: NotificationChannel;
  existingChannels: NotificationChannel[];
  isSaving?: boolean;
  onClose: () => void;
  onSave: (payload: NotificationChannelRequest) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AlertChannelFormModal: React.FC<AlertChannelFormModalProps> = ({
  isOpen,
  channel,
  existingChannels,
  isSaving = false,
  onClose,
  onSave,
}) => {
  const isEdit = !!channel;
  const { t } = useTranslation();

  const [name, setName] = React.useState(channel?.name ?? "");
  const [type, setType] = React.useState<NotificationChannelType>(channel?.type ?? "EMAIL");

  const emailConfig = channel?.type === "EMAIL" ? (channel.config as EmailChannelConfig) : undefined;
  const webhookConfig =
    channel?.type === "WEBHOOK" ? (channel.config as WebhookChannelConfig) : undefined;

  const [recipients, setRecipients] = React.useState<string[]>(
    emailConfig?.recipients?.length ? emailConfig.recipients : [""]
  );
  const [subjectPrefix, setSubjectPrefix] = React.useState(emailConfig?.subjectPrefix ?? "");

  const [url, setUrl] = React.useState(webhookConfig?.url ?? "");
  const [method, setMethod] = React.useState<"POST" | "PUT">(webhookConfig?.method ?? "POST");
  const [isMethodOpen, setIsMethodOpen] = React.useState(false);
  const [headers, setHeaders] = React.useState<{ key: string; value: string }[]>(
    webhookConfig?.headers
      ? Object.entries(webhookConfig.headers).map(([key, value]) => ({ key, value }))
      : []
  );

  const isNameDuplicate = existingChannels.some(
    (c) => c.name === name.trim() && c.id !== channel?.id
  );

  const validRecipients = recipients.filter((r) => r.trim().length > 0);
  const invalidRecipient = validRecipients.some((r) => !EMAIL_PATTERN.test(r.trim()));

  const isUrlValid = url.trim().length === 0 || /^https?:\/\//.test(url.trim());

  const canSubmit =
    name.trim().length > 0 &&
    !isNameDuplicate &&
    (type === "EMAIL"
      ? validRecipients.length > 0 && !invalidRecipient
      : url.trim().length > 0 && isUrlValid);

  const updateRecipient = (index: number, value: string) => {
    setRecipients((prev) => prev.map((r, i) => (i === index ? value : r)));
  };

  const addRecipient = () => setRecipients((prev) => [...prev, ""]);
  const removeRecipient = (index: number) =>
    setRecipients((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const addHeader = () => setHeaders((prev) => [...prev, { key: "", value: "" }]);
  const removeHeader = (index: number) =>
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  const updateHeader = (index: number, field: "key" | "value", value: string) =>
    setHeaders((prev) => prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)));

  const handleSubmit = () => {
    if (!canSubmit || isSaving) return;

    const config: EmailChannelConfig | WebhookChannelConfig =
      type === "EMAIL"
        ? {
          recipients: validRecipients,
          subjectPrefix: subjectPrefix.trim() || undefined,
        }
        : {
          url: url.trim(),
          method,
          headers: headers.some((h) => h.key.trim())
            ? Object.fromEntries(
              headers.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value])
            )
            : undefined,
        };

    onSave({
      name: name.trim(),
      type,
      config,
      enabled: channel?.enabled ?? true,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="medium"
      aria-labelledby="alert-channel-modal-title"
    >
      <ModalHeader
        title={isEdit ? t("breadcrumb.editResource", { val: "notification channel" }) : t("breadcrumb.createResource", { val: "notification channel" })}
        labelId="alert-channel-modal-title"
      />
      <ModalBody>
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <FormGroup label={t("alert:channel.name")} isRequired fieldId="channel-name">
            <TextInput
              id="channel-name"
              value={name}
              onChange={(_e, value) => setName(value)}
              validated={isNameDuplicate ? "error" : "default"}
              placeholder="ops-email"
              isDisabled={isSaving}
            />
            {isNameDuplicate && (
              <HelperText>
                <HelperTextItem variant="error">
                  {t("statusMessage:apis.uniqueResourceNameError", { val: "channel" })}
                </HelperTextItem>
              </HelperText>
            )}
          </FormGroup>

          <FormGroup label={t("alert:channel.type")} isRequired fieldId="channel-type" isStack>
            <Radio
              id="channel-type-email"
              name="channel-type"
              label="Email"
              isChecked={type === "EMAIL"}
              isDisabled={isEdit || isSaving}
              onChange={() => setType("EMAIL")}
            />
            <Radio
              id="channel-type-webhook"
              name="channel-type"
              label="Webhook"
              isChecked={type === "WEBHOOK"}
              isDisabled={isEdit || isSaving}
              onChange={() => setType("WEBHOOK")}
            />
          </FormGroup>

          {type === "EMAIL" ? (
            <FormSection title={t("configurationHeading", { val: "Email" })}>
              <FormGroup label="Recipients" isRequired fieldId="channel-recipients">
                {recipients.map((recipient, index) => (
                  <div key={index} className="alerts-channel-row">
                    <TextInput
                      id={`channel-recipient-${index}`}
                      aria-label={`Recipient ${index + 1}`}
                      value={recipient}
                      onChange={(_e, value) => updateRecipient(index, value)}
                      placeholder="ops@example.com"
                      isDisabled={isSaving}
                      validated={
                        recipient.trim() && !EMAIL_PATTERN.test(recipient.trim())
                          ? "error"
                          : "default"
                      }
                    />
                    <Button
                      variant="plain"
                      aria-label="Remove recipient"
                      icon={<MinusCircleIcon />}
                      isDisabled={recipients.length === 1 || isSaving}
                      onClick={() => removeRecipient(index)}
                    />
                  </div>
                ))}
                <Button
                  variant="link"
                  isInline
                  icon={<PlusIcon />}
                  isDisabled={isSaving}
                  onClick={addRecipient}
                >
                  {t("alert:buttons.addResource", { val: "recipient" })}
                </Button>
              </FormGroup>

              <FormGroup label={t("alert:channel.subjectPrefix")} fieldId="channel-subject-prefix">
                <TextInput
                  id="channel-subject-prefix"
                  value={subjectPrefix}
                  onChange={(_e, value) => setSubjectPrefix(value)}
                  placeholder="[Debezium]"
                  isDisabled={isSaving}
                />
                <HelperText>
                  <HelperTextItem>
                    {t("alert:channel.subjectPrefixHelper")}
                  </HelperTextItem>
                </HelperText>
              </FormGroup>
            </FormSection>
          ) : (
            <FormSection title={t("configurationHeading", { val: "Webhook" })}>
              <FormGroup label="URL" isRequired fieldId="channel-url">
                <TextInput
                  id="channel-url"
                  value={url}
                  onChange={(_e, value) => setUrl(value)}
                  placeholder="https://hooks.slack.com/services/..."
                  validated={!isUrlValid ? "error" : "default"}
                  isDisabled={isSaving}
                />
                <HelperText>
                  <HelperTextItem variant={!isUrlValid ? "error" : "default"}>
                    {t("alert:channel.urlHelper")}
                  </HelperTextItem>
                </HelperText>
              </FormGroup>

              <FormGroup label="HTTP method" fieldId="channel-method">
                <Select
                  id="channel-method"
                  isOpen={isMethodOpen}
                  selected={method}
                  onSelect={(_e, value) => {
                    setMethod(value as "POST" | "PUT");
                    setIsMethodOpen(false);
                  }}
                  onOpenChange={setIsMethodOpen}
                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      onClick={() => setIsMethodOpen((prev) => !prev)}
                      isExpanded={isMethodOpen}
                      isDisabled={isSaving}
                      style={{ width: "160px" }}
                    >
                      {method}
                    </MenuToggle>
                  )}
                >
                  <SelectList>
                    <SelectOption value="POST">POST</SelectOption>
                    <SelectOption value="PUT">PUT</SelectOption>
                  </SelectList>
                </Select>
              </FormGroup>

              <FormGroup label="Headers" fieldId="channel-headers">
                {headers.map((header, index) => (
                  <div key={index} className="alerts-header-editor-row">
                    <TextInput
                      aria-label={`Header key ${index + 1}`}
                      value={header.key}
                      onChange={(_e, value) => updateHeader(index, "key", value)}
                      placeholder="Authorization"
                      isDisabled={isSaving}
                      style={{ width: "220px" }}
                    />
                    <TextInput
                      aria-label={`Header value ${index + 1}`}
                      value={header.value}
                      onChange={(_e, value) => updateHeader(index, "value", value)}
                      placeholder="Bearer token"
                      isDisabled={isSaving}
                    />
                    <Button
                      variant="plain"
                      aria-label="Remove header"
                      icon={<TrashIcon />}
                      isDisabled={isSaving}
                      onClick={() => removeHeader(index)}
                    />
                  </div>
                ))}
                <Button
                  variant="link"
                  isInline
                  icon={<PlusIcon />}
                  isDisabled={isSaving}
                  onClick={addHeader}
                >
                  {t("alert:buttons.addResource", { val: "header" })}
                </Button>
                <HelperText>
                  <HelperTextItem>{t("alert:channel.headerHelper")}</HelperTextItem>
                </HelperText>
              </FormGroup>
            </FormSection>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          isDisabled={!canSubmit || isSaving}
          isLoading={isSaving}
          onClick={handleSubmit}
        >
          {isEdit ? t("alert:buttons.saveResource", { val: "channel" }) : t("alert:buttons.createResource", { val: "channel" })}
        </Button>
        <Button variant="link" isDisabled={isSaving} onClick={onClose}>
          {t("cancel")}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AlertChannelFormModal;
