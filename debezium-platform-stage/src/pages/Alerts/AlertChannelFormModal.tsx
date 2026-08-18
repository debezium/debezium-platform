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
  NotificationChannelType,
  WebhookChannelConfig,
} from "./alertsTypes";

interface AlertChannelFormModalProps {
  isOpen: boolean;
  channel?: NotificationChannel;
  existingChannels: NotificationChannel[];
  onClose: () => void;
  onSave: (channel: NotificationChannel) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AlertChannelFormModal: React.FC<AlertChannelFormModalProps> = ({
  isOpen,
  channel,
  existingChannels,
  onClose,
  onSave,
}) => {
  const isEdit = !!channel;

  const [name, setName] = React.useState(channel?.name ?? "");
  const [type, setType] = React.useState<NotificationChannelType>(channel?.type ?? "EMAIL");

  const emailConfig = channel?.type === "EMAIL" ? (channel.config as EmailChannelConfig) : undefined;
  const webhookConfig =
    channel?.type === "WEBHOOK" ? (channel.config as WebhookChannelConfig) : undefined;

  const [recipients, setRecipients] = React.useState<string[]>(
    emailConfig?.recipients?.length ? emailConfig.recipients : [""]
  );
  const [subjectTemplate, setSubjectTemplate] = React.useState(
    emailConfig?.subjectTemplate ?? "Debezium Alert: {{rule_name}} - {{severity}}"
  );

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
    if (!canSubmit) return;
    const nowIso = new Date().toISOString();

    const config: EmailChannelConfig | WebhookChannelConfig =
      type === "EMAIL"
        ? { recipients: validRecipients, subjectTemplate: subjectTemplate.trim() || undefined }
        : {
            url: url.trim(),
            method,
            headers: headers.some((h) => h.key.trim())
              ? Object.fromEntries(
                  headers.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value])
                )
              : undefined,
          };

    const savedChannel: NotificationChannel = {
      id: channel?.id ?? Date.now(),
      name: name.trim(),
      type,
      config,
      enabled: channel?.enabled ?? true,
      createdAt: channel?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    onSave(savedChannel);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="medium"
      aria-labelledby="alert-channel-modal-title"
    >
      <ModalHeader
        title={isEdit ? "Edit notification channel" : "Create notification channel"}
        labelId="alert-channel-modal-title"
      />
      <ModalBody>
        <Form>
          <FormGroup label="Name" isRequired fieldId="channel-name">
            <TextInput
              id="channel-name"
              value={name}
              onChange={(_e, value) => setName(value)}
              validated={isNameDuplicate ? "error" : "default"}
              placeholder="ops-email"
            />
            {isNameDuplicate && (
              <HelperText>
                <HelperTextItem variant="error">
                  A channel with this name already exists.
                </HelperTextItem>
              </HelperText>
            )}
          </FormGroup>

          <FormGroup label="Type" isRequired fieldId="channel-type" isStack>
            <Radio
              id="channel-type-email"
              name="channel-type"
              label="Email"
              isChecked={type === "EMAIL"}
              isDisabled={isEdit}
              onChange={() => setType("EMAIL")}
            />
            <Radio
              id="channel-type-webhook"
              name="channel-type"
              label="Webhook"
              isChecked={type === "WEBHOOK"}
              isDisabled={isEdit}
              onChange={() => setType("WEBHOOK")}
            />
          </FormGroup>

          {type === "EMAIL" ? (
            <FormSection title="Email configuration">
              <FormGroup label="Recipients" isRequired fieldId="channel-recipients">
                {recipients.map((recipient, index) => (
                  <div key={index} className="alerts-channel-row">
                    <TextInput
                      id={`channel-recipient-${index}`}
                      aria-label={`Recipient ${index + 1}`}
                      value={recipient}
                      onChange={(_e, value) => updateRecipient(index, value)}
                      placeholder="ops@example.com"
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
                      isDisabled={recipients.length === 1}
                      onClick={() => removeRecipient(index)}
                    />
                  </div>
                ))}
                <Button variant="link" isInline icon={<PlusIcon />} onClick={addRecipient}>
                  Add recipient
                </Button>
              </FormGroup>

              <FormGroup label="Subject template" fieldId="channel-subject">
                <TextInput
                  id="channel-subject"
                  value={subjectTemplate}
                  onChange={(_e, value) => setSubjectTemplate(value)}
                />
                <HelperText>
                  <HelperTextItem>
                    Supports <code>{"{{rule_name}}"}</code> and <code>{"{{severity}}"}</code>{" "}
                    placeholders.
                  </HelperTextItem>
                </HelperText>
              </FormGroup>
            </FormSection>
          ) : (
            <FormSection title="Webhook configuration">
              <FormGroup label="URL" isRequired fieldId="channel-url">
                <TextInput
                  id="channel-url"
                  value={url}
                  onChange={(_e, value) => setUrl(value)}
                  placeholder="https://hooks.slack.com/services/..."
                  validated={!isUrlValid ? "error" : "default"}
                />
                <HelperText>
                  <HelperTextItem variant={!isUrlValid ? "error" : "default"}>
                    HTTPS required in production. Integrates with Slack, PagerDuty, OpsGenie,
                    Teams, etc.
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
                      style={{ width: "220px" }}
                    />
                    <TextInput
                      aria-label={`Header value ${index + 1}`}
                      value={header.value}
                      onChange={(_e, value) => updateHeader(index, "value", value)}
                      placeholder="Bearer token"
                    />
                    <Button
                      variant="plain"
                      aria-label="Remove header"
                      icon={<TrashIcon />}
                      onClick={() => removeHeader(index)}
                    />
                  </div>
                ))}
                <Button variant="link" isInline icon={<PlusIcon />} onClick={addHeader}>
                  Add header
                </Button>
                <HelperText>
                  <HelperTextItem>Use headers for authentication tokens.</HelperTextItem>
                </HelperText>
              </FormGroup>
            </FormSection>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" isDisabled={!canSubmit} onClick={handleSubmit}>
          {isEdit ? "Save changes" : "Create channel"}
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AlertChannelFormModal;
