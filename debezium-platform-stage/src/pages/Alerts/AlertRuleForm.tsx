import * as React from "react";
import {
  Alert,
  Button,
  Checkbox,
  Content,
  Form,
  FormFieldGroup,
  FormFieldGroupHeader,
  FormGroup,
  FormSection,
  HelperText,
  HelperTextItem,
  InputGroup,
  InputGroupItem,
  MenuToggle,
  MenuToggleElement,
  Radio,
  Select,
  SelectGroup,
  SelectList,
  SelectOption,
  Spinner,
  TextInput,
} from "@patternfly/react-core";
import { fetchMonitoringPanels } from "../../apis/apis";
import type { PanelResponse } from "../../apis/types";
import {
  AlertOperator,
  AlertRule,
  AlertRuleRequest,
  AlertSeverity,
  EVALUATION_WINDOW_OPTIONS,
  FOR_DURATION_OPTIONS,
  isoDurationToSeconds,
  NotificationChannel,
  OPERATOR_OPTIONS,
  ReduceFunction,
  REDUCE_FUNCTION_OPTIONS,
  secondsToIsoDuration,
  SEVERITY_OPTIONS,
} from "./alertsTypes";
import { SeverityIcon, SeverityLabel } from "./severityUtils";
import "./Alerts.css";

const EMPTY_DISPLAY = "—";

const ReviewValue: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const empty = children === undefined || children === null || children === "";
  return (
    <span
      className={
        empty
          ? "alerts-review-value alerts-review-value--empty"
          : "alerts-review-value alerts-review-value--set"
      }
    >
      {empty ? EMPTY_DISPLAY : children}
    </span>
  );
};

export interface AlertRuleFormProps {
  formId: string;
  rule?: AlertRule;
  existingRules: AlertRule[];
  channels: NotificationChannel[];
  viewMode?: boolean;
  isSaving?: boolean;
  onSave: (payload: AlertRuleRequest) => void | Promise<void>;
  onGoToChannels: () => void;
  onCanSubmitChange?: (canSubmit: boolean) => void;
}

const NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const AlertRuleForm: React.FC<AlertRuleFormProps> = ({
  formId,
  rule,
  existingRules,
  channels,
  viewMode = false,
  isSaving = false,
  onSave,
  onGoToChannels,
  onCanSubmitChange,
}) => {
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
  const [forDuration, setForDuration] = React.useState(
    rule ? secondsToIsoDuration(rule.forDuration) : "PT0S"
  );
  const [isDurationOpen, setIsDurationOpen] = React.useState(false);
  const [evaluationWindow, setEvaluationWindow] = React.useState(
    rule ? secondsToIsoDuration(rule.evaluationWindow) : "PT5M"
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

  React.useEffect(() => {
    onCanSubmitChange?.(canSubmit);
  }, [canSubmit, onCanSubmitChange]);

  const toggleChannel = (id: number) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !panelId || isSaving || viewMode) return;

    const payload: AlertRuleRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      panelId,
      operator,
      threshold: thresholdNumber,
      forDuration: isoDurationToSeconds(forDuration),
      reduceFunction,
      evaluationWindow: isoDurationToSeconds(evaluationWindow),
      severity,
      enabled: rule?.enabled ?? true,
      channelIds: [...selectedChannelIds],
    };

    void onSave(payload);
  };

  const selectedChannels = channels.filter((channel) => selectedChannelIds.has(channel.id));
  const panelTitle = selectedPanel?.title ?? rule?.panelTitle;
  const operatorLabel = OPERATOR_OPTIONS.find((o) => o.value === operator)?.label;
  const reduceLabel = REDUCE_FUNCTION_OPTIONS.find((o) => o.value === reduceFunction)?.label;
  const durationLabel = FOR_DURATION_OPTIONS.find((o) => o.value === forDuration)?.label;
  const windowLabel = EVALUATION_WINDOW_OPTIONS.find((o) => o.value === evaluationWindow)?.label;

  return (
    <Form id={formId} onSubmit={handleSubmit} isWidthLimited>
      <FormGroup label="Name" isRequired fieldId="rule-name">
        {viewMode ? (
          <ReviewValue>{name}</ReviewValue>
        ) : (
          <>
            <TextInput
              id="rule-name"
              value={name}
              onChange={(_e, value) => setName(value)}
              validated={!isNameValid || isNameDuplicate ? "error" : "default"}
              isDisabled={isSaving}
            />
            <HelperText>
              <HelperTextItem variant={!isNameValid || isNameDuplicate ? "error" : "default"}>
                {isNameDuplicate
                  ? "A rule with this name already exists."
                  : !isNameValid
                    ? "Use lowercase alphanumeric characters and hyphens only."
                    : "Unique, RFC 1123 subdomain (lowercase alphanumeric + hyphens)."}
              </HelperTextItem>
            </HelperText>
          </>
        )}
      </FormGroup>

      <FormGroup label="Description" fieldId="rule-description">
        {viewMode ? (
          <ReviewValue>{description}</ReviewValue>
        ) : (
          <TextInput
            id="rule-description"
            value={description}
            onChange={(_e, value) => setDescription(value)}
            isDisabled={isSaving}
          />
        )}
      </FormGroup>

            <FormGroup label="Severity" fieldId="rule-severity" isStack>
        {viewMode ? (
          <div><SeverityLabel severity={severity} /></div>
        ) : (
          SEVERITY_OPTIONS.map((option) => {
            return (
              <Radio
                key={option}
                id={`rule-severity-${option}`}
                name="rule-severity"
                label={
                  // <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  //   {meta.icon} {option.label}
                  // </span>
                  <SeverityIcon severity={option} />
                }
                isChecked={severity === option}
                isDisabled={isSaving}
                onChange={() => setSeverity(option)}
              />
            );
          })
        )}
      </FormGroup>

      {/* <FormSection title="Condition"> */}
      <FormFieldGroup
        header={
          <FormFieldGroupHeader
            titleText={{
              text: <span style={{ fontWeight: 500 }}>Rule Condition</span>,
              id: `field-group-${name}-schema-id`,
            }}
            titleDescription={"Set the rule condition to met in order to trigger a alert event."}

          />
        }
      >
        {panelsLoading && !viewMode ? (
          <Spinner size="md" aria-label="Loading monitoring panels" />
        ) : panelsError && !viewMode ? (
          <Alert variant="danger" isInline title="Failed to load monitoring panels">
            {panelsError}
          </Alert>
        ) : (
          <>
            <FormGroup label="When" isRequired fieldId="rule-panel">
              {viewMode ? (
                <ReviewValue>{panelTitle}</ReviewValue>
              ) : (
                <>
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
                        isDisabled={isSaving}
                        style={{ width: "100%" }}
                      >
                        {panelTitle ?? "Select a monitoring panel"}
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
                </>
              )}
            </FormGroup>

            <FormGroup label="Reduce" fieldId="rule-reduce">
              {viewMode ? (
                <ReviewValue>{reduceLabel}</ReviewValue>
              ) : (
                <>
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
                        isDisabled={isSaving}
                        style={{ width: "220px" }}
                      >
                        {reduceLabel}
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
                </>
              )}
            </FormGroup>

            {reduceFunction !== "LAST" && (
              <FormGroup label="Evaluation window" fieldId="rule-window">
                {viewMode ? (
                  <ReviewValue>{windowLabel}</ReviewValue>
                ) : (
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
                        isDisabled={isSaving}
                        style={{ width: "220px" }}
                      >
                        {windowLabel}
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
                )}
              </FormGroup>
            )}

            <FormGroup label="Is" isRequired fieldId="rule-operator">
              {viewMode ? (
                <ReviewValue>
                  {operatorLabel} {threshold}
                  {selectedPanel?.unit ? ` ${selectedPanel.unit}` : ""}
                </ReviewValue>
              ) : (
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
                          isDisabled={isSaving}
                          style={{ width: "230px" }}
                        >
                          {operatorLabel}
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
                      isDisabled={isSaving}
                      aria-label="Threshold"
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
              )}
            </FormGroup>

            <FormGroup label="For" fieldId="rule-duration">
              {viewMode ? (
                <ReviewValue>{durationLabel}</ReviewValue>
              ) : (
                <>
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
                        isDisabled={isSaving}
                        style={{ width: "220px" }}
                      >
                        {durationLabel}
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
                </>
              )}
            </FormGroup>
          </>
        )}
      </FormFieldGroup>

      <FormSection title="Severity">

      {/* </FormSection> */}

      {/* <FormFieldGroup
        header={
          <FormFieldGroupHeader
            titleText={{
              text: <span style={{ fontWeight: 500 }}>Notify channel</span>,
              id: "field-group-notify-channel-id",
            }}
            titleDescription="Select the channels you want to be notified in case of an alert event"
          />
        }
      > */}
        {viewMode ? (
          <FormGroup label="Additional channels" fieldId="rule-channels">
            {selectedChannels.length === 0 ? (
              <ReviewValue>Platform UI only</ReviewValue>
            ) : (
              <ReviewValue>
                {selectedChannels
                  .map(
                    (channel) =>
                      `${channel.name} (${channel.type === "EMAIL" ? "Email" : "Webhook"})`
                  )
                  .join(", ")}
              </ReviewValue>
            )}
          </FormGroup>
        ) : (
          <>
            <Alert
              variant="info"
              isInline
              isPlain
              title="Alerts always appear in the platform UI (history page and alert badge)."
            />
            {channels.length === 0 ? (
              <FormGroup label="Additional channels" fieldId="rule-channels">
                <Content component="p">
                  No notification channels configured yet.{" "}
                  <Button variant="link" isInline onClick={onGoToChannels}>
                    Create a channel
                  </Button>{" "}
                  to enable email or webhook delivery.
                </Content>
              </FormGroup>
            ) : (
              <FormGroup
                label="Additional channels"
                fieldId="rule-channels"
                role="group"
                isStack
              >
                {channels.map((channel) => (
                  <Checkbox
                    key={channel.id}
                    id={`rule-channel-${channel.id}`}
                    label={`${channel.name} (${channel.type === "EMAIL" ? "Email" : "Webhook"})`}
                    isChecked={selectedChannelIds.has(channel.id)}
                    isDisabled={isSaving}
                    onChange={() => toggleChannel(channel.id)}
                  />
                ))}
              </FormGroup>
            )}
          </>
        )}
      {/* </FormFieldGroup> */}
      </FormSection>
    </Form>
  );
};

export default AlertRuleForm;
