import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Button,
  Card,
  CardBody,
  PageSection,
  Skeleton,
} from "@patternfly/react-core";
import { PageHeader } from "@patternfly/react-component-groups";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "react-query";
import { FeatureGate } from "@components/FeatureGate";
import { useNotification } from "../../appLayout/AppNotificationContext";
import {
  ALERT_CHANNELS_QUERY_KEY,
  ALERT_RULES_QUERY_KEY,
  createAlertRule,
  fetchAlertChannels,
  fetchAlertRules,
} from "../../apis/alerts";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import { AlertRule, AlertRuleRequest, NotificationChannel } from "./alertsTypes";
import AlertRuleForm from "./AlertRuleForm";
import style from "../../styles/createConnector.module.css";

const CREATE_FORM_ID = "create-alert-rule-form";

const CreateAlertRule: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addNotification } = useNotification();
  const [isSaving, setIsSaving] = React.useState(false);
  const [canSubmit, setCanSubmit] = React.useState(false);

  const { data: rules = [], isLoading: rulesLoading } = useResourceQuery<AlertRule[], Error>(
    ALERT_RULES_QUERY_KEY,
    fetchAlertRules
  );
  const { data: channels = [], isLoading: channelsLoading } = useResourceQuery<
    NotificationChannel[],
    Error
  >(ALERT_CHANNELS_QUERY_KEY, fetchAlertChannels);

  const isLoading = rulesLoading || channelsLoading;

  const handleSave = async (payload: AlertRuleRequest) => {
    setIsSaving(true);
    const response = await createAlertRule(payload);
    if (response.error) {
      addNotification(
        "danger",
        "Create failed",
        `Failed to create "${payload.name}": ${response.error}`
      );
    } else {
      addNotification(
        "success",
        "Create successful",
        `Rule "${payload.name}" created successfully.`
      );
      await queryClient.invalidateQueries(ALERT_RULES_QUERY_KEY);
      navigate("/alerts/rules");
    }
    setIsSaving(false);
  };

  return (
    <FeatureGate flag="Alerts">
      <PageHeader
        title="Create alert rule"
        subtitle="Define a threshold-based rule against an existing monitoring panel. A rule fires for any pipeline that breaches its threshold."
      />
      <PageSection
        isWidthLimited
        isCenterAligned
        isFilled
        className={`customPageSection ${style.createConnector_pageSection}`}
      >
        <Card className="custom-card-body">
          <CardBody isFilled>
            {isLoading ? (
              <div>
                <Skeleton fontSize="2xl" width="40%" />
                <br />
                <Skeleton fontSize="md" width="60%" />
                <br />
                <Skeleton fontSize="md" width="80%" />
                <br />
                <Skeleton fontSize="md" width="50%" />
              </div>
            ) : (
              <AlertRuleForm
                formId={CREATE_FORM_ID}
                existingRules={rules}
                channels={channels}
                isSaving={isSaving}
                onSave={handleSave}
                onGoToChannels={() => navigate("/alerts/channels")}
                onCanSubmitChange={setCanSubmit}
              />
            )}
          </CardBody>
        </Card>
      </PageSection>
      <PageSection className="pf-m-sticky-bottom" isFilled={false}>
        <ActionList>
          <ActionListGroup>
            <ActionListItem>
              <Button
                variant="primary"
                type="submit"
                form={CREATE_FORM_ID}
                isDisabled={!canSubmit || isSaving || isLoading}
                isLoading={isSaving}
              >
                Create rule
              </Button>
            </ActionListItem>
            <ActionListItem>
              <Button
                variant="link"
                isDisabled={isSaving}
                onClick={() => navigate("/alerts/rules")}
              >
                Cancel
              </Button>
            </ActionListItem>
          </ActionListGroup>
        </ActionList>
      </PageSection>
    </FeatureGate>
  );
};

export { CreateAlertRule };
