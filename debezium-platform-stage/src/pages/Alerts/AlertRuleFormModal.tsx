import * as React from "react";
import {
  Alert,
  Button,
  Checkbox,
  Content,
  Form,
  FormGroup,
  FormSection,
  HelperText,
  HelperTextItem,
  InputGroup,
  InputGroupItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  MenuToggle,
  MenuToggleElement,
  Radio,
  Select,
  SelectGroup,
  SelectList,
  SelectOption,
  Spinner,
  TextArea,
  TextInput,
} from "@patternfly/react-core";
import { fetchMonitoringPanels } from "../../apis/apis";
import type { PanelResponse } from "../../apis/types";
import {
  AlertOperator,
  AlertRule,
  AlertSeverity,
  EVALUATION_WINDOW_OPTIONS,
  FOR_DURATION_OPTIONS,
  NotificationChannel,
  OPERATOR_OPTIONS,
  ReduceFunction,
  REDUCE_FUNCTION_OPTIONS,
  SEVERITY_OPTIONS,
} from "./alertsTypes";
import { getSeverityMeta } from "./severityUtils";

interface AlertRuleFormModalProps {
  isOpen: boolean;
  rule?: AlertRule;
  existingRules: AlertRule[];
  channels: NotificationChannel[];
  onClose: () => void;
  onSave: (rule: AlertRule) => void;
  onGoToChannels: () => void;
}

const NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const AlertRuleFormModal: React.FC<AlertRuleFormModalProps> = ({
  isOpen,
  rule,
  existingRules,
  channels,
  onClose,
  onSave,
  onGoToChannels,
}) => {
  const isEdit = !!rule;

  const [panels, setPanels] = React.useState<PanelResponse[]>([]);
  const [panelsLoading, setPanelsLoading] = React.useState(true);
  const [panelsError, setPanelsError] = React.useState<string | null>(null);

  const [name, setName] = React.useState(rule?.name ?? "");
  const [description, setDescription] = React.useState(rule?.description ?? "");
  const [panelId, setPanelId] = React.useState<string | undefined>(rule?.panelId);
  const [isPanelSelectOpen, setIsPanelSelectOpen] = React.useState(false);
  const [reduceFunction, setReduceFunction] = React.useState<ReduceFunction>(
    rule?.reduceFunction ?? "LAST"
  );
  const [isReduceOpen, setIsReduceOpen] = React.useState(false);
  const [operator, setOperator] = React.useState<AlertOperator>(
    rule?.operator ?? "GREATER_THAN"
  );
  const [isOperatorOpen, setIsOperatorOpen] = React.useState(false);
  const [threshold, setThreshold] = React.useState(
    rule?.threshold !== undefined ? String(rule.threshold) : ""
  );
  const [forDuration, setForDuration] = React.useState(rule?.forDuration ?? "PT0S");
  const [isDurationOpen, setIsDurationOpen] = React.useState(false);
  const [evaluationWindow, setEvaluationWindow] = React.useState(
    rule?.evaluationWindow ?? "PT5M"
  );
  const [isWindowOpen, setIsWindowOpen] = React.useState(false);
  const [severity, setSeverity] = React.useState<AlertSeverity>(rule?.severity ?? "WARNING");
  const [selectedChannelIds, setSelectedChannelIds] = React.useState<Set<number>>(
    new Set(rule?.channels.map((c) => c.id) ?? [])
  );

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPanelsLoading(true);
      setPanelsError(null);
      const response = await fetchMonitoringPanels();
      if (cancelled) return;
      if (response.error || !response.data) {
        setPanelsError(
          response.error ?? "Monitoring panels API returned an invalid response"
        );
      } else {
        setPanels(response.data.panels);
      }
      setPanelsLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPanel = React.useMemo(
    () => panels.find((p) => p.id === panelId),
    [panels, panelId]
  );

  const streamingPanels = panels.filter((p) => p.category === "streaming");
  const snapshotPanels = panels.filter((p) => p.category === "snapshot");

  const isNameValid = name.length === 0 || (NAME_PATTERN.test(name) && name.length <= 253);
  const isNameDuplicate = existingRules.some(
    (r) => r.name === name.trim() && r.id !== rule?.id
  );
  const thresholdNumber = Number(threshold);
  const isThresholdValid = threshold.trim() !== "" && !Number.isNaN(thresholdNumber);

  const canSubmit =
    name.trim().length > 0 &&
    isNameValid &&
    !isNameDuplicate &&
    !!panelId &&
    isThresholdValid;

  const toggleChannel = (id: number) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!canSubmit || !selectedPanel) return;

    const nowIso = new Date().toISOString();
    const savedRule: AlertRule = {
      id: rule?.id ?? Date.now(),
      name: name.trim(),
      description: description.trim() || undefined,
      panelId: selectedPanel.id,
      panelTitle: selectedPanel.title,
      panelUnit: selectedPanel.unit,
      operator,
      threshold: thresholdNumber,
      forDuration,
      reduceFunction,
      evaluationWindow,
      severity,
      enabled: rule?.enabled ?? true,
      channels: channels.filter((c) => selectedChannelIds.has(c.id)).map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      })),
      createdAt: rule?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    onSave(savedRule);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="medium"
      aria-labelledby="alert-rule-modal-title"
    >
      <ModalHeader
        title={isEdit ? "Edit alert rule" : "Create alert rule"}
        labelId="alert-rule-modal-title"
      />
      <ModalBody>
        <Form>
          <FormGroup label="Name" isRequired fieldId="rule-name">
            <TextInput
              id="rule-name"
              value={name}
              onChange={(_e, value) => setName(value)}
              validated={!isNameValid || isNameDuplicate ? "error" : "default"}
              placeholder="high-source-lag"
            />
            <HelperText>
              <HelperTextItem
                variant={!isNameValid || isNameDuplicate ? "error" : "default"}
              >
                {isNameDuplicate
                  ? "A rule with this name already exists."
                  : !isNameValid
                    ? "Use lowercase alphanumeric characters and hyphens only."
                    : "Unique, RFC 1123 subdomain (lowercase alphanumeric + hyphens)."}
              </HelperTextItem>
            </HelperText>
          </FormGroup>

          <FormGroup label="Description" fieldId="rule-description">
            <TextArea
              id="rule-description"
              value={description}
              onChange={(_e, value) => setDescription(value)}
              rows={2}
              placeholder="Alert when source lag is too high"
            />
          </FormGroup>

          <FormSection title="Condition">
            {panelsLoading ? (
              <Spinner size="md" aria-label="Loading monitoring panels" />
            ) : panelsError ? (
              <Alert
                variant="danger"
                isInline
                title="Failed to load monitoring panels"
              >
                {panelsError}
              </Alert>
            ) : (
              <>
                <FormGroup label="When" isRequired fieldId="rule-panel">
                  <Select
                    id="rule-panel"
                    isOpen={isPanelSelectOpen}
                    selected={panelId}
                    onSelect={(_e, value) => {
                      setPanelId(value as string);
                      setIsPanelSelectOpen(false);
                    }}
                    onOpenChange={setIsPanelSelectOpen}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setIsPanelSelectOpen((prev) => !prev)}
                        isExpanded={isPanelSelectOpen}
                        style={{ width: "100%" }}
                      >
                        {selectedPanel?.title ?? "Select a monitoring panel"}
                      </MenuToggle>
                    )}
                  >
                    <SelectGroup label="Streaming">
                      <SelectList>
                        {streamingPanels.map((panel) => (
                          <SelectOption key={panel.id} value={panel.id}>
                            {panel.title}
                          </SelectOption>
                        ))}
                      </SelectList>
                    </SelectGroup>
                    <SelectGroup label="Snapshot">
                      <SelectList>
                        {snapshotPanels.map((panel) => (
                          <SelectOption key={panel.id} value={panel.id}>
                            {panel.title}
                          </SelectOption>
                        ))}
                      </SelectList>
                    </SelectGroup>
                  </Select>
                  {selectedPanel?.description && (
                    <HelperText>
                      <HelperTextItem>{selectedPanel.description}</HelperTextItem>
                    </HelperText>
                  )}
                </FormGroup>

                <FormGroup label="Reduce" fieldId="rule-reduce">
                  <Select
                    id="rule-reduce"
                    isOpen={isReduceOpen}
                    selected={reduceFunction}
                    onSelect={(_e, value) => {
                      setReduceFunction(value as ReduceFunction);
                      setIsReduceOpen(false);
                    }}
                    onOpenChange={setIsReduceOpen}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setIsReduceOpen((prev) => !prev)}
                        isExpanded={isReduceOpen}
                        style={{ width: "220px" }}
                      >
                        {REDUCE_FUNCTION_OPTIONS.find((o) => o.value === reduceFunction)?.label}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      {REDUCE_FUNCTION_OPTIONS.map((option) => (
                        <SelectOption key={option.value} value={option.value}>
                          {option.label}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                  <HelperText>
                    <HelperTextItem>
                      Monitoring panels produce time series: this determines how the series is
                      collapsed to a single value for comparison.
                    </HelperTextItem>
                  </HelperText>
                </FormGroup>

                {reduceFunction !== "LAST" && (
                  <FormGroup label="Evaluation window" fieldId="rule-window">
                    <Select
                      id="rule-window"
                      isOpen={isWindowOpen}
                      selected={evaluationWindow}
                      onSelect={(_e, value) => {
                        setEvaluationWindow(value as string);
                        setIsWindowOpen(false);
                      }}
                      onOpenChange={setIsWindowOpen}
                      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                        <MenuToggle
                          ref={toggleRef}
                          onClick={() => setIsWindowOpen((prev) => !prev)}
                          isExpanded={isWindowOpen}
                          style={{ width: "220px" }}
                        >
                          {EVALUATION_WINDOW_OPTIONS.find((o) => o.value === evaluationWindow)?.label}
                        </MenuToggle>
                      )}
                    >
                      <SelectList>
                        {EVALUATION_WINDOW_OPTIONS.map((option) => (
                          <SelectOption key={option.value} value={option.value}>
                            {option.label}
                          </SelectOption>
                        ))}
                      </SelectList>
                    </Select>
                  </FormGroup>
                )}

                <FormGroup label="Is" isRequired fieldId="rule-operator">
                  <InputGroup>
                    <InputGroupItem>
                      <Select
                        id="rule-operator"
                        isOpen={isOperatorOpen}
                        selected={operator}
                        onSelect={(_e, value) => {
                          setOperator(value as AlertOperator);
                          setIsOperatorOpen(false);
                        }}
                        onOpenChange={setIsOperatorOpen}
                        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                          <MenuToggle
                            ref={toggleRef}
                            onClick={() => setIsOperatorOpen((prev) => !prev)}
                            isExpanded={isOperatorOpen}
                            style={{ width: "230px" }}
                          >
                            {OPERATOR_OPTIONS.find((o) => o.value === operator)?.label}
                          </MenuToggle>
                        )}
                      >
                        <SelectList>
                          {OPERATOR_OPTIONS.map((option) => (
                            <SelectOption key={option.value} value={option.value}>
                              {option.label}
                            </SelectOption>
                          ))}
                        </SelectList>
                      </Select>
                    </InputGroupItem>
                    <InputGroupItem>
                      <TextInput
                        id="rule-threshold"
                        type="number"
                        value={threshold}
                        onChange={(_e, value) => setThreshold(value)}
                        validated={isThresholdValid ? "default" : "error"}
                        style={{ width: "120px" }}
                      />
                    </InputGroupItem>
                    {selectedPanel?.unit && (
                      <InputGroupItem>
                        <Content component="small" style={{ padding: "6px 8px" }}>
                          {selectedPanel.unit}
                        </Content>
                      </InputGroupItem>
                    )}
                  </InputGroup>
                </FormGroup>

                <FormGroup label="For" fieldId="rule-duration">
                  <Select
                    id="rule-duration"
                    isOpen={isDurationOpen}
                    selected={forDuration}
                    onSelect={(_e, value) => {
                      setForDuration(value as string);
                      setIsDurationOpen(false);
                    }}
                    onOpenChange={setIsDurationOpen}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setIsDurationOpen((prev) => !prev)}
                        isExpanded={isDurationOpen}
                        style={{ width: "220px" }}
                      >
                        {FOR_DURATION_OPTIONS.find((o) => o.value === forDuration)?.label}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      {FOR_DURATION_OPTIONS.map((option) => (
                        <SelectOption key={option.value} value={option.value}>
                          {option.label}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                  <HelperText>
                    <HelperTextItem>
                      The condition must hold for this long before the alert fires, preventing
                      noise from transient spikes.
                    </HelperTextItem>
                  </HelperText>
                </FormGroup>
              </>
            )}
          </FormSection>

          <FormSection title="Severity">
            <FormGroup fieldId="rule-severity" isStack>
              {SEVERITY_OPTIONS.map((option) => {
                const meta = getSeverityMeta(option.value);
                return (
                  <Radio
                    key={option.value}
                    id={`rule-severity-${option.value}`}
                    name="rule-severity"
                    label={
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {meta.icon} {option.label}
                      </span>
                    }
                    isChecked={severity === option.value}
                    onChange={() => setSeverity(option.value)}
                  />
                );
              })}
            </FormGroup>
          </FormSection>

          <FormSection title="Notify via">
            <Alert variant="info" isInline isPlain title="Alerts always appear in the platform UI (history page and alert badge)." />
            {channels.length === 0 ? (
              <Content component="p">
                No notification channels configured yet.{" "}
                <Button variant="link" isInline onClick={onGoToChannels}>
                  Create a channel
                </Button>{" "}
                to enable email or webhook delivery.
              </Content>
            ) : (
              <div style={{ marginTop: "8px" }}>
                <Content component="p">Additional channels:</Content>
                {channels.map((channel) => (
                  <div key={channel.id} className="alerts-channel-row">
                    <Checkbox
                      id={`rule-channel-${channel.id}`}
                      label={`${channel.name} (${channel.type === "EMAIL" ? "Email" : "Webhook"})`}
                      isChecked={selectedChannelIds.has(channel.id)}
                      onChange={() => toggleChannel(channel.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </FormSection>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" isDisabled={!canSubmit} onClick={handleSubmit}>
          {isEdit ? "Save changes" : "Create rule"}
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AlertRuleFormModal;
