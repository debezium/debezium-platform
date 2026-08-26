import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Bullseye,
  Button,
  Card,
  CardBody,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  Icon,
  PageSection,
  Spinner,
} from "@patternfly/react-core";
import { PageHeader } from "@patternfly/react-component-groups";
import { ExclamationCircleIcon, PencilAltIcon, RhUiNotificationIcon, RhUiTaskIcon } from "@patternfly/react-icons";
import * as React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "react-query";
import { FeatureGate } from "@components/FeatureGate";
import { useNotification } from "../../appLayout/AppNotificationContext";
import {
  ALERT_CHANNELS_QUERY_KEY,
  ALERT_RULES_QUERY_KEY,
  fetchAlertChannels,
  fetchAlertRules,
  updateAlertRule,
} from "../../apis/alerts";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import { AlertRule, AlertRuleRequest, NotificationChannel } from "./alertsTypes";
import AlertRuleForm from "./AlertRuleForm";
import style from "../../styles/createConnector.module.css";

const EDIT_FORM_ID = "edit-alert-rule-form";

const EditAlertRule: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addNotification } = useNotification();
  const { ruleId: ruleIdParam } = useParams<{ ruleId: string }>();
  const [searchParams] = useSearchParams();
  const initialState = searchParams.get("state") as "view" | "edit" | null;
  const [viewMode, setViewMode] = React.useState(initialState !== "edit");
  const [isSaving, setIsSaving] = React.useState(false);
  const [canSubmit, setCanSubmit] = React.useState(false);

  const {
    data: rules = [],
    isLoading: rulesLoading,
    isError: rulesError,
  } = useResourceQuery<AlertRule[], Error>(ALERT_RULES_QUERY_KEY, fetchAlertRules);
  const { data: channels = [] } = useResourceQuery<NotificationChannel[], Error>(
    ALERT_CHANNELS_QUERY_KEY,
    fetchAlertChannels
  );

  const ruleId = Number(ruleIdParam);
  const rule = rules.find((item) => item.id === ruleId);

  const handleSave = async (payload: AlertRuleRequest) => {
    if (!rule) return;
    setIsSaving(true);
    const response = await updateAlertRule(rule.id, payload);
    if (response.error) {
      addNotification(
        "danger",
        "Edit failed",
        `Failed to update "${payload.name}": ${response.error}`
      );
    } else {
      addNotification(
        "success",
        "Save successful",
        `Rule "${payload.name}" updated successfully.`
      );
      await queryClient.invalidateQueries(ALERT_RULES_QUERY_KEY);
      setViewMode(true);
    }
    setIsSaving(false);
  };

  if (rulesLoading) {
    return (
      <FeatureGate flag="Alerts">
        <PageSection isFilled>
          <Bullseye>
            <Spinner size="lg" aria-label="Loading alert rule" />
          </Bullseye>
        </PageSection>
      </FeatureGate>
    );
  }

  if (rulesError || !Number.isFinite(ruleId) || !rule) {
    return (
      <FeatureGate flag="Alerts">
        <PageSection isFilled>
          <Bullseye>
            <EmptyState
              variant={EmptyStateVariant.lg}
              titleText="Alert rule not found"
              headingLevel="h4"
              icon={ExclamationCircleIcon}
            >
              <EmptyStateBody>This rule may have been deleted. Return to the rules list and try again.</EmptyStateBody>
              <EmptyStateFooter>
                <EmptyStateActions>
                  <Button variant="primary" onClick={() => navigate("/alerts/rules")}>
                    Back to alert rules
                  </Button>
                </EmptyStateActions>
              </EmptyStateFooter>
            </EmptyState>
          </Bullseye>
        </PageSection>
      </FeatureGate>
    );
  }

  return (
    <FeatureGate flag="Alerts">
      {viewMode ? (
        <PageHeader
          title={rule.name}
          subtitle={rule.description || undefined}
          icon={
            <Icon size="2xl" className="custom-header_icon">
              <RhUiTaskIcon  />
            </Icon>
          }
          actionMenu={
            <Button
              variant="secondary"
              icon={<PencilAltIcon />}
              onClick={() => setViewMode(false)}
            >
              Edit
            </Button>
          }
        />
      ) : (
        <PageHeader
          title="Edit alert rule"
          subtitle="Update the threshold, severity, or notification channels for this rule."
          icon={
            <Icon size="2xl" className="custom-header_icon">
              <RhUiNotificationIcon />
            </Icon>
          }
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
            <AlertRuleForm
              key={`${rule.id}-${viewMode ? "view" : "edit"}`}
              formId={EDIT_FORM_ID}
              rule={rule}
              existingRules={rules}
              channels={channels}
              viewMode={viewMode}
              isSaving={isSaving}
              onSave={handleSave}
              onGoToChannels={() => navigate("/alerts/channels")}
              onCanSubmitChange={setCanSubmit}
            />
          </CardBody>
        </Card>
      </PageSection>
      {!viewMode && (
        <PageSection className="pf-m-sticky-bottom" isFilled={false}>
          <ActionList>
            <ActionListGroup>
              <ActionListItem>
                <Button
                  variant="primary"
                  type="submit"
                  form={EDIT_FORM_ID}
                  isDisabled={!canSubmit || isSaving}
                  isLoading={isSaving}
                >
                  Save changes
                </Button>
              </ActionListItem>
              <ActionListItem>
                <Button
                  variant="link"
                  isDisabled={isSaving}
                  onClick={() => setViewMode(true)}
                >
                  Cancel
                </Button>
              </ActionListItem>
            </ActionListGroup>
          </ActionList>
        </PageSection>
      )}
    </FeatureGate>
  );
};

export { EditAlertRule };
