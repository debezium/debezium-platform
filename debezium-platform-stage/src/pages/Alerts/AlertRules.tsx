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
  MenuToggle,
  MenuToggleElement,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  Switch,
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
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
  ThProps,
  Tr,
} from "@patternfly/react-table";
import { ExclamationCircleIcon, FilterIcon, PlusIcon, RhUiTaskIcon, SearchIcon } from "@patternfly/react-icons";
import { useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import PageHeader from "@components/PageHeader";
import { useNotification } from "../../appLayout/AppNotificationContext";
import {
  ALERT_RULES_QUERY_KEY,
  deleteAlertRule,
  fetchAlertRules,
  setAlertRuleEnabled,
} from "../../apis/alerts";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import { AlertRule, AlertSeverity } from "./alertsTypes";
import { formatCondition, SeverityIcon } from "./severityUtils";
import EmptyStatus from "@components/EmptyStatus";
import InformationModal from "@components/modal/InformationModal";
import { fetchData, Pipeline } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { useTranslation } from "react-i18next";

interface AlertRulesProps {
  firingRuleIds: Set<number>;
}

type FilterField = "name" | "metric";

const FILTER_OPTIONS: { value: FilterField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "metric", label: "Metric" },
];

const getFilterValue = (rule: AlertRule, field: FilterField): string =>
  field === "metric" ? rule.panelTitle : rule.name;

const SEVERITY_COLUMN_INDEX = 3;

/** Lower rank = higher urgency, so the default ascending sort is Critical → Warning → Info. */
const SEVERITY_RANK: Record<AlertSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

const AlertRules: React.FC<AlertRulesProps> = ({ firingRuleIds }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { addNotification } = useNotification();

  const {
    data: rules = [],
    isLoading,
    isError,
  } = useResourceQuery<AlertRule[], Error>(ALERT_RULES_QUERY_KEY, fetchAlertRules);

  const {
    data: pipelinesList = [],
    isLoading: pipelinesLoading,
    isError: pipelinesError,
  } = useResourceQuery<Pipeline[], Error>(
    "pipelines",
    () => fetchData<Pipeline[]>(`${API_URL}/api/pipelines`)
  );

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isNoPipelineModalOpen, setIsNoPipelineModalOpen] = React.useState(false);
  const [filterField, setFilterField] = React.useState<FilterField>("name");
  const [isFilterSelectOpen, setIsFilterSelectOpen] = React.useState(false);
  const [activeSortIndex, setActiveSortIndex] = React.useState<number | null>(null);
  const [activeSortDirection, setActiveSortDirection] = React.useState<"asc" | "desc" | undefined>(
    undefined
  );
  const [deleteTarget, setDeleteTarget] = React.useState<AlertRule | undefined>(undefined);
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [togglingRuleId, setTogglingRuleId] = React.useState<number | undefined>(undefined);

  const searchResult = React.useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter((rule) => getFilterValue(rule, filterField).toLowerCase().includes(q));
  }, [rules, searchQuery, filterField]);

  const displayedRules = React.useMemo(() => {
    if (activeSortIndex !== SEVERITY_COLUMN_INDEX || !activeSortDirection) {
      return searchResult;
    }
    return [...searchResult].sort((a, b) => {
      const diff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      return activeSortDirection === "asc" ? diff : -diff;
    });
  }, [searchResult, activeSortIndex, activeSortDirection]);

  const getSortParams = (columnIndex: number): ThProps["sort"] => ({
    sortBy: {
      index: activeSortIndex ?? undefined,
      direction: activeSortDirection,
      defaultDirection: "asc",
    },
    onSort: (_event, index, direction) => {
      setActiveSortIndex(index);
      setActiveSortDirection(direction);
    },
    columnIndex,
  });

  const onClearSearch = () => setSearchQuery("");

  const onFilterFieldSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    setFilterField((value as FilterField) ?? "name");
    setIsFilterSelectOpen(false);
    onClearSearch();
  };

  const refreshRules = () => queryClient.invalidateQueries(ALERT_RULES_QUERY_KEY);

  const openCreatePage = () => {
    if (!pipelinesError && pipelinesList.length === 0) {
      setIsNoPipelineModalOpen(true);
      return;
    }
    navigate("/alerts/rules/create_rule");
  };

  const openViewPage = (rule: AlertRule) => navigate(`/alerts/rules/${rule.id}?state=view`);

  const openEditPage = (rule: AlertRule) => navigate(`/alerts/rules/${rule.id}?state=edit`);

  const toggleEnabled = async (rule: AlertRule) => {
    if (togglingRuleId !== undefined) return;
    const nextEnabled = !rule.enabled;
    setTogglingRuleId(rule.id);
    const response = await setAlertRuleEnabled(rule.id, nextEnabled);
    if (response.error) {
      addNotification(
        "danger",
        nextEnabled ? "Enable failed" : "Disable failed",
        `Failed to ${nextEnabled ? "enable" : "disable"} "${rule.name}": ${response.error}`
      );
    } else {
      await refreshRules();
    }
    setTogglingRuleId(undefined);
  };

  const requestDelete = (rule: AlertRule) => {
    setDeleteTarget(rule);
    setDeleteConfirmName("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAlertRule(deleteTarget.id);
      addNotification(
        "success",
        "Delete successful",
        `Rule "${deleteTarget.name}" deleted successfully.`
      );
      await refreshRules();
      setDeleteTarget(undefined);
    } catch (error) {
      addNotification(
        "danger",
        "Delete failed",
        error instanceof Error ? error.message : `Failed to delete "${deleteTarget.name}".`
      );
    }
    setIsDeleting(false);
  };

  const rowActions = (rule: AlertRule): IAction[] => [

    {
      title: rule.enabled ? "Disable" : "Enable",
      onClick: () => {
        void toggleEnabled(rule);
      },
    },
    { isSeparator: true },
    { title: "Edit", onClick: () => openEditPage(rule) },
    { title: "Delete", onClick: () => requestDelete(rule) },
  ];

  if (isLoading || pipelinesLoading) {
    return (
      <PageSection isFilled>
        <Bullseye>
          <Spinner size="lg" aria-label="Loading alert rules" />
        </Bullseye>
      </PageSection>
    );
  }

  if (isError) {
    return (
      <PageSection isFilled>
        <Bullseye>
          <EmptyState
            variant={EmptyStateVariant.lg}
            titleText="Failed to load alert rules"
            headingLevel="h4"
            icon={ExclamationCircleIcon}
          >
            <EmptyStateBody>Check your connection and try again.</EmptyStateBody>
          </EmptyState>
        </Bullseye>
      </PageSection>
    );
  }

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
      {rules.length > 0 ? (
        <>
          <PageHeader
            title="Alert rules"
            description="Define threshold-based rules against existing monitoring panels. A rule fires for any pipeline that breaches its threshold."
          />
          <PageSection>
            <Card className="source-card">
              <Toolbar
                id="toolbar-sticky"
                className="custom-toolbar"
                isSticky
              // id="alert-rules-toolbar-sticky" className="alerts-custom-toolbar" isSticky
              >
                <ToolbarContent>
                  <ToolbarGroup variant="filter-group">
                    <ToolbarItem>
                      <Select
                        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                          <MenuToggle
                            ref={toggleRef}
                            icon={<FilterIcon />}
                            onClick={() => setIsFilterSelectOpen((prev) => !prev)}
                            isExpanded={isFilterSelectOpen}
                            style={{ width: "120px" } as React.CSSProperties}
                          >
                            {FILTER_OPTIONS.find((o) => o.value === filterField)?.label ?? "Name"}
                          </MenuToggle>
                        )}
                        onSelect={onFilterFieldSelect}
                        onOpenChange={setIsFilterSelectOpen}
                        selected={filterField}
                        isOpen={isFilterSelectOpen}
                      >
                        <SelectList>
                          {FILTER_OPTIONS.map((option) => (
                            <SelectOption key={option.value} value={option.value}>
                              {option.label}
                            </SelectOption>
                          ))}
                        </SelectList>
                      </Select>
                    </ToolbarItem>
                    <ToolbarItem>
                      <SearchInput
                        aria-label={`Search rules by ${filterField}`}
                        placeholder={`Find by ${filterField}...`}
                        value={searchQuery}
                        onChange={(_e, value) => setSearchQuery(value)}
                        onClear={onClearSearch}
                      />
                    </ToolbarItem>
                  </ToolbarGroup>
                  <ToolbarItem>
                    <Button variant="primary" icon={<PlusIcon />} onClick={openCreatePage}>
                      Add rule
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
                    <Th sort={getSortParams(SEVERITY_COLUMN_INDEX)}>Severity</Th>
                    <Th>Metric</Th>
                    <Th>Condition</Th>

                    <Th>Status</Th>
                    <Th screenReaderText="Actions" />
                  </Tr>
                </Thead>
                <Tbody>
                  {displayedRules.length > 0 ? (
                    displayedRules.map((rule) => (
                      <Tr key={rule.id}>
                        <Td dataLabel="Name">
                          {firingRuleIds.has(rule.id) && (
                            <span
                              className="alerts-firing-dot"
                              title="This rule currently has firing alerts"
                            />
                          )}
                          <Button variant="link" isInline onClick={() => openViewPage(rule)}>
                            {rule.name}
                          </Button>
                        </Td>
                        <Td dataLabel="Severity">
                          <SeverityIcon severity={rule.severity} />
                        </Td>
                        <Td dataLabel="Metric">{rule.panelTitle}</Td>
                        <Td dataLabel="Condition">{formatCondition(rule)}</Td>

                        <Td dataLabel="Status">
                          <Switch
                            id={`rule-enabled-${rule.id}`}
                            aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                            isChecked={rule.enabled}
                            isDisabled={togglingRuleId === rule.id}
                            onChange={() => {
                              void toggleEnabled(rule);
                            }}
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
                                <Button variant="link" onClick={onClearSearch}>
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

        <EmptyStatus
          heading={t("alert:rule.emptyHeading")}
          primaryMessage={t("alert:rule.emptyDescription")}
          secondaryMessage=""
          icon={RhUiTaskIcon as React.ComponentType<unknown>}
          primaryAction={
            <Button
              variant="primary"
              icon={<PlusIcon />}
              data-tour="add-source"
              onClick={openCreatePage}
            >
              {t('addButton', { val: "rule" })}
            </Button>
          }
        />
      )}

      <InformationModal
        isOpen={isNoPipelineModalOpen}
        onClose={() => setIsNoPipelineModalOpen(false)}
        title={t("alert:rule.noPipelineModal.title")}
        primaryAction={{
          label: t("pipeline:createPipeline"),
          onClick: () => {
            setIsNoPipelineModalOpen(false);
            navigate("/pipeline/pipeline_designer");
          },
        }}
        secondaryAction={{
          label: t("cancel"),
          onClick: () => setIsNoPipelineModalOpen(false),
        }}
      >
        {t("alert:rule.noPipelineModal.description")}
      </InformationModal>

      <Modal
        variant="small"
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(undefined)}
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
              if (deleteTarget && deleteConfirmName === deleteTarget.name) void confirmDelete();
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
            isDisabled={deleteConfirmName !== deleteTarget?.name || isDeleting}
            isLoading={isDeleting}
            onClick={() => {
              void confirmDelete();
            }}
          >
            Delete
          </Button>
          <Button
            variant="link"
            isDisabled={isDeleting}
            onClick={() => setDeleteTarget(undefined)}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default AlertRules;
