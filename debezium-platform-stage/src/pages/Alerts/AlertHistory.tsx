import * as React from "react";
import {
  Bullseye,
  Button,
  Card,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  MenuToggle,
  MenuToggleElement,
  PageSection,
  Pagination,
  PaginationVariant,
  Select,
  SelectList,
  SelectOption,
  Toolbar,
  ToolbarContent,
  ToolbarFilter,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import {
  ExpandableRowContent,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@patternfly/react-table";
import { HistoryIcon } from "@patternfly/react-icons";
import { useNavigate } from "react-router-dom";
import PageHeader from "@components/PageHeader";
import {
  AlertEvent,
  AlertRule,
  AlertSeverity,
  DATE_RANGE_PRESETS,
  DateRangePreset,
} from "./alertsTypes";
import { formatDateTime, formatDurationSeconds, SeverityLabel } from "./severityUtils";

interface AlertHistoryProps {
  events: AlertEvent[];
  rules: AlertRule[];
}

type StatusFilter = "firing" | "resolved";

const PRESET_TO_MS: Record<DateRangePreset, number> = {
  "Last hour": 60 * 60 * 1000,
  "Last 24 hours": 24 * 60 * 60 * 1000,
  "Last 7 days": 7 * 24 * 60 * 60 * 1000,
  "Last 30 days": 30 * 24 * 60 * 60 * 1000,
};

interface MultiSelectFilterProps<T extends string> {
  label: string;
  options: T[];
  selected: T[];
  onChange: (next: T[]) => void;
  renderOption?: (value: T) => React.ReactNode;
}

function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
  renderOption,
}: MultiSelectFilterProps<T>) {
  const [isOpen, setIsOpen] = React.useState(false);

  const toggleValue = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <ToolbarFilter
      labels={selected}
      deleteLabel={(_category, chip) => toggleValue(chip as T)}
      deleteLabelGroup={() => onChange([])}
      categoryName={label}
    >
      <Select
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        selected={selected}
        onSelect={(_e, value) => toggleValue(value as T)}
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            onClick={() => setIsOpen((prev) => !prev)}
            isExpanded={isOpen}
            style={{ width: "160px" }}
            badge={selected.length > 0 ? <span>{selected.length}</span> : undefined}
          >
            {label}
          </MenuToggle>
        )}
      >
        <SelectList>
          {options.map((option) => (
            <SelectOption key={option} value={option} hasCheckbox isSelected={selected.includes(option)}>
              {renderOption ? renderOption(option) : option}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
    </ToolbarFilter>
  );
}

const AlertHistory: React.FC<AlertHistoryProps> = ({ events, rules }) => {
  const navigate = useNavigate();

  const [severityFilter, setSeverityFilter] = React.useState<AlertSeverity[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter[]>([]);
  const [pipelineFilter, setPipelineFilter] = React.useState<string[]>([]);
  const [ruleFilter, setRuleFilter] = React.useState<string[]>([]);
  const [datePreset, setDatePreset] = React.useState<DateRangePreset | "All time">("All time");
  const [isDateOpen, setIsDateOpen] = React.useState(false);

  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set());
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);

  // `now` is captured via an effect (not read directly during render) so filtering
  // by date-range preset stays a pure function of state/props.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
  }, [datePreset, events]);

  const pipelineOptions = React.useMemo(
    () => Array.from(new Set(events.map((e) => e.pipelineName))).sort(),
    [events]
  );
  const ruleOptions = React.useMemo(() => rules.map((r) => r.name), [rules]);

  const filtered = React.useMemo(() => {
    return events.filter((event) => {
      if (severityFilter.length && !severityFilter.includes(event.severity)) return false;
      if (statusFilter.length && !statusFilter.includes(event.status)) return false;
      if (pipelineFilter.length && !pipelineFilter.includes(event.pipelineName)) return false;
      if (ruleFilter.length && !ruleFilter.includes(event.ruleName)) return false;
      if (datePreset !== "All time" && now !== null) {
        const windowMs = PRESET_TO_MS[datePreset];
        if (now - new Date(event.firedAt).getTime() > windowMs) return false;
      }
      return true;
    });
  }, [events, severityFilter, statusFilter, pipelineFilter, ruleFilter, datePreset, now]);

  const sorted = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.status !== b.status) return a.status === "firing" ? -1 : 1;
      return new Date(b.firedAt).getTime() - new Date(a.firedAt).getTime();
    });
  }, [filtered]);

  const paged = React.useMemo(() => {
    const start = (page - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sorted, page, perPage]);

  const hasActiveFilters =
    severityFilter.length > 0 ||
    statusFilter.length > 0 ||
    pipelineFilter.length > 0 ||
    ruleFilter.length > 0 ||
    datePreset !== "All time";

  const clearAllFilters = () => {
    setSeverityFilter([]);
    setStatusFilter([]);
    setPipelineFilter([]);
    setRuleFilter([]);
    setDatePreset("All time");
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rowClassName = (event: AlertEvent) =>
    event.severity === "CRITICAL"
      ? "alerts-row--critical"
      : event.severity === "WARNING"
        ? "alerts-row--warning"
        : undefined;

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Alert History"
        description="Every fire/resolve cycle recorded as an incident. Firing incidents are pinned to the top."
      />
      <PageSection>
        <Card className="pipeline-card">
          {/* <Toolbar
            id="alert-history-toolbar"
            className="alerts-custom-toolbar"
            
          > */}
          <Toolbar
            id="toolbar-sticky"
            className="custom-toolbar"
            clearAllFilters={clearAllFilters}
            isSticky
          >
            <ToolbarContent>
              <ToolbarGroup variant="filter-group">
                <MultiSelectFilter
                  label="Severity"
                  options={["CRITICAL", "WARNING", "INFO"] as AlertSeverity[]}
                  selected={severityFilter}
                  onChange={setSeverityFilter}
                />
                <MultiSelectFilter
                  label="Status"
                  options={["firing", "resolved"] as StatusFilter[]}
                  selected={statusFilter}
                  onChange={setStatusFilter}
                  renderOption={(v) => (v === "firing" ? "Firing" : "Resolved")}
                />
                <MultiSelectFilter
                  label="Pipeline"
                  options={pipelineOptions}
                  selected={pipelineFilter}
                  onChange={setPipelineFilter}
                />
                <MultiSelectFilter
                  label="Rule"
                  options={ruleOptions}
                  selected={ruleFilter}
                  onChange={setRuleFilter}
                />
                <ToolbarItem>
                  <Select
                    isOpen={isDateOpen}
                    onOpenChange={setIsDateOpen}
                    selected={datePreset}
                    onSelect={(_e, value) => {
                      setDatePreset(value as DateRangePreset | "All time");
                      setIsDateOpen(false);
                    }}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setIsDateOpen((prev) => !prev)}
                        isExpanded={isDateOpen}
                        style={{ width: "160px" }}
                      >
                        {datePreset}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      <SelectOption value="All time">All time</SelectOption>
                      {DATE_RANGE_PRESETS.map((preset) => (
                        <SelectOption key={preset} value={preset}>
                          {preset}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                </ToolbarItem>
              </ToolbarGroup>
              <ToolbarItem align={{ default: "alignEnd" }}>
                <Content component={ContentVariants.small}>
                  {hasActiveFilters
                    ? `${sorted.length} of ${events.length} incidents`
                    : `${events.length} incidents`}
                </Content>
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>

          {paged.length > 0 ? (
            <>
              <Table aria-label="Alert history table">
                <Thead>
                  <Tr>
                    <Th screenReaderText="Expand" />
                    <Th>Severity</Th>
                    <Th>Rule</Th>
                    <Th>Pipeline</Th>
                    <Th>Status</Th>
                    <Th>Fired at</Th>
                    <Th>Duration</Th>
                  </Tr>
                </Thead>
                {paged.map((event, rowIndex) => {
                  const isExpanded = expandedIds.has(event.id);
                  return (
                    <Tbody key={event.id} isExpanded={isExpanded}>
                      <Tr className={rowClassName(event)}>
                        <Td
                          expand={{
                            rowIndex,
                            isExpanded,
                            onToggle: () => toggleExpanded(event.id),
                          }}
                        />
                        <Td dataLabel="Severity">
                          <SeverityLabel severity={event.severity} isCompact />
                        </Td>
                        <Td dataLabel="Rule">{event.ruleName}</Td>
                        <Td dataLabel="Pipeline">
                          <Button
                            variant="link"
                            isInline
                            onClick={() => navigate(`/pipeline/${event.pipelineId}/monitoring`)}
                          >
                            {event.pipelineName}
                          </Button>
                        </Td>
                        <Td dataLabel="Status">
                          {event.status === "firing" ? "Firing" : "Resolved"}
                        </Td>
                        <Td dataLabel="Fired at">{formatDateTime(event.firedAt)}</Td>
                        <Td dataLabel="Duration">
                          {formatDurationSeconds(event.durationSeconds, event.status === "firing")}
                        </Td>
                      </Tr>
                      {isExpanded && (
                        <Tr isExpanded={isExpanded}>
                          <Td colSpan={7} noPadding>
                            <ExpandableRowContent>
                              <dl className="alerts-detail-panel">
                                <dt>Severity</dt>
                                <dd>
                                  <SeverityLabel severity={event.severity} isCompact />
                                </dd>
                                <dt>Fired at</dt>
                                <dd>{formatDateTime(event.firedAt)}</dd>
                                <dt>Resolved at</dt>
                                <dd>{formatDateTime(event.resolvedAt)}</dd>
                                <dt>Duration</dt>
                                <dd>
                                  {formatDurationSeconds(
                                    event.durationSeconds,
                                    event.status === "firing"
                                  )}
                                </dd>
                                <dt>Value</dt>
                                <dd>
                                  {event.value} (threshold: &gt; {event.threshold})
                                </dd>
                                <dt>Message</dt>
                                <dd>{event.message}</dd>
                              </dl>
                            </ExpandableRowContent>
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  );
                })}
              </Table>
              <Pagination
                itemCount={sorted.length}
                perPage={perPage}
                page={page}
                onSetPage={(_e, newPage) => setPage(newPage)}
                onPerPageSelect={(_e, newPerPage, newPage) => {
                  setPerPage(newPerPage);
                  setPage(newPage);
                }}
                variant={PaginationVariant.bottom}
              />
            </>
          ) : (
            <Bullseye>
              <EmptyState
                variant={EmptyStateVariant.sm}
                titleText="No incidents match these filters"
                headingLevel="h2"
                icon={HistoryIcon}
              >
                <EmptyStateBody>
                  <Button variant="link" onClick={clearAllFilters}>
                    Clear all filters
                  </Button>
                </EmptyStateBody>
              </EmptyState>
            </Bullseye>
          )}
        </Card>
      </PageSection>
    </div>
  );
};

export default AlertHistory;
