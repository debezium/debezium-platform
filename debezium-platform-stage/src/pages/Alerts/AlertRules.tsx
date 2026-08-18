import * as React from "react";
import {
  Bullseye,
  Button,
  Card,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  SearchInput,
  Switch,
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import {
  ActionsColumn,
  IAction,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@patternfly/react-table";
import { BellIcon, PlusIcon, SearchIcon } from "@patternfly/react-icons";
import PageHeader from "@components/PageHeader";
import { AlertRule, NotificationChannel } from "./alertsTypes";
import { formatCondition, SeverityLabel } from "./severityUtils";
import AlertRuleFormModal from "./AlertRuleFormModal";

interface AlertRulesProps {
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
  channels: NotificationChannel[];
  firingRuleIds: Set<number>;
  onGoToChannels: () => void;
}

const AlertRules: React.FC<AlertRulesProps> = ({
  rules,
  setRules,
  channels,
  firingRuleIds,
  onGoToChannels,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<AlertRule | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = React.useState<AlertRule | undefined>(undefined);
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("");

  const searchResult = React.useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter((rule) => rule.name.toLowerCase().includes(q));
  }, [rules, searchQuery]);

  const openCreateForm = () => {
    setEditingRule(undefined);
    setIsFormOpen(true);
  };

  const openEditForm = (rule: AlertRule) => {
    setEditingRule(rule);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingRule(undefined);
  };

  const handleSaveRule = (rule: AlertRule) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === rule.id);
      return exists ? prev.map((r) => (r.id === rule.id ? rule : r)) : [rule, ...prev];
    });
    closeForm();
  };

  const toggleEnabled = (rule: AlertRule) => {
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const requestDelete = (rule: AlertRule) => {
    setDeleteTarget(rule);
    setDeleteConfirmName("");
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(undefined);
  };

  const rowActions = (rule: AlertRule): IAction[] => [
    { title: "Edit", onClick: () => openEditForm(rule) },
    { title: rule.enabled ? "Disable" : "Enable", onClick: () => toggleEnabled(rule) },
    { title: "Delete", onClick: () => requestDelete(rule) },
  ];

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
      {rules.length > 0 ? (
        <>
          <PageHeader
            title="Alert Rules"
            description="Define threshold-based rules against existing monitoring panels. A rule fires for any pipeline that breaches its threshold."
          />
          <PageSection>
            <Card>
              <Toolbar id="alert-rules-toolbar-sticky" className="alerts-custom-toolbar" isSticky>
                <ToolbarContent>
                  <ToolbarItem>
                    <SearchInput
                      aria-label="Search rules by name"
                      placeholder="Find by name..."
                      value={searchQuery}
                      onChange={(_e, value) => setSearchQuery(value)}
                      onClear={() => setSearchQuery("")}
                    />
                  </ToolbarItem>
                  <ToolbarItem>
                    <Button variant="primary" icon={<PlusIcon />} onClick={openCreateForm}>
                      Create rule
                    </Button>
                  </ToolbarItem>
                  <ToolbarItem align={{ default: "alignEnd" }}>
                    <Content component={ContentVariants.small}>
                      {searchQuery.length > 0
                        ? `${searchResult.length} of ${rules.length} items`
                        : `${rules.length} items`}
                    </Content>
                  </ToolbarItem>
                </ToolbarContent>
              </Toolbar>

              <Table aria-label="Alert rules table">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Metric</Th>
                    <Th>Condition</Th>
                    <Th>Severity</Th>
                    <Th>Status</Th>
                    <Th screenReaderText="Actions" />
                  </Tr>
                </Thead>
                <Tbody>
                  {searchResult.length > 0 ? (
                    searchResult.map((rule) => (
                      <Tr key={rule.id}>
                        <Td dataLabel="Name">
                          {firingRuleIds.has(rule.id) && (
                            <span
                              className="alerts-firing-dot"
                              title="This rule currently has firing alerts"
                            />
                          )}
                          {rule.name}
                        </Td>
                        <Td dataLabel="Metric">{rule.panelTitle}</Td>
                        <Td dataLabel="Condition">{formatCondition(rule)}</Td>
                        <Td dataLabel="Severity">
                          <SeverityLabel severity={rule.severity} />
                        </Td>
                        <Td dataLabel="Status">
                          <Switch
                            id={`rule-enabled-${rule.id}`}
                            aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                            isChecked={rule.enabled}
                            onChange={() => toggleEnabled(rule)}
                            label={rule.enabled ? "On" : "Off"}
                          />
                        </Td>
                        <Td dataLabel="Actions" isActionCell>
                          <ActionsColumn items={rowActions(rule)} />
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={6}>
                        <Bullseye>
                          <EmptyState
                            headingLevel="h2"
                            titleText="No matching rule is present."
                            icon={SearchIcon}
                            variant={EmptyStateVariant.sm}
                          >
                            <EmptyStateBody>Clear search and try again.</EmptyStateBody>
                            <EmptyStateFooter>
                              <EmptyStateActions>
                                <Button variant="link" onClick={() => setSearchQuery("")}>
                                  Clear search
                                </Button>
                              </EmptyStateActions>
                            </EmptyStateFooter>
                          </EmptyState>
                        </Bullseye>
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Card>
          </PageSection>
        </>
      ) : (
        <PageSection style={{ position: "relative", minHeight: "100%" }} isFilled>
          <Bullseye>
            <EmptyState
              variant={EmptyStateVariant.lg}
              titleText="No alert rules yet"
              headingLevel="h4"
              icon={BellIcon}
            >
              <EmptyStateBody>
                <Content component="p">
                  Create a rule to get notified when a pipeline metric breaches a threshold.
                  No PromQL knowledge required, just pick a monitoring panel, a comparison, and
                  a value.
                </Content>
              </EmptyStateBody>
              <EmptyStateFooter>
                <Button variant="primary" icon={<PlusIcon />} onClick={openCreateForm}>
                  Create rule
                </Button>
              </EmptyStateFooter>
            </EmptyState>
          </Bullseye>
        </PageSection>
      )}

      {isFormOpen && (
        <AlertRuleFormModal
          isOpen={isFormOpen}
          rule={editingRule}
          existingRules={rules}
          channels={channels}
          onClose={closeForm}
          onSave={handleSaveRule}
          onGoToChannels={onGoToChannels}
        />
      )}

      <Modal
        variant="small"
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        aria-labelledby="delete-rule-modal-title"
      >
        <ModalHeader
          title={<p>Delete rule &quot;{deleteTarget?.name}&quot;?</p>}
          titleIconVariant="warning"
          labelId="delete-rule-modal-title"
        />
        <ModalBody>
          <Content component="p">
            This will stop evaluation and remove the rule. Type the rule name to confirm.
          </Content>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              if (deleteTarget && deleteConfirmName === deleteTarget.name) confirmDelete();
            }}
          >
            <FormGroup isRequired fieldId="delete-rule-name">
              <TextInput
                id="delete-rule-name"
                aria-label="delete rule name"
                value={deleteConfirmName}
                onChange={(_e, value) => setDeleteConfirmName(value)}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            isDisabled={deleteConfirmName !== deleteTarget?.name}
            onClick={confirmDelete}
          >
            Delete
          </Button>
          <Button variant="link" onClick={() => setDeleteTarget(undefined)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default AlertRules;
