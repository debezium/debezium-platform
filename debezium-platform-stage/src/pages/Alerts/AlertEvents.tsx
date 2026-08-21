import * as React from "react";
import {
  Badge,
  Bullseye,
  Button,
  Card,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Label,
  LabelColor,
  MenuToggle,
  MenuToggleElement,
  PageSection,
  Pagination,
  PaginationVariant,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Toolbar,
  ToolbarContent,
  ToolbarFilter,
  ToolbarGroup,
  ToolbarItem,
  ToolbarLabel,
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
import {
  ExclamationCircleIcon,
  FilterIcon,
  HistoryIcon,
  OutlinedClockIcon,
  TimesIcon,
} from "@patternfly/react-icons";
import { useNavigate } from "react-router-dom";
import PageHeader from "@components/PageHeader";
import { fetchData, Pipeline } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import {
  AlertRuleSummary,
  ALERT_RULES_QUERY_KEY,
  DEFAULT_ALERT_EVENTS_PAGE_SIZE,
  fetchAlertEvents,
  fetchAlertRules,
} from "../../apis/alerts";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import {
  AlertEvent,
  AlertEventStatus,
  AlertSeverity,
  DATE_RANGE_PRESETS,
  DateRangePreset,
  PagedAlertEventResponse,
} from "./alertsTypes";
import { formatDateTime, formatDurationSeconds, SeverityIcon, SeverityLabel } from "./severityUtils";
import {
  calculateTimeRange,
  datetimeLocalToISO,
  isoToDatetimeLocal,
} from "../../utils/timeRangeUtils";
import {
  ALERT_EVENT_COLUMNS,
  AlertEventColumnId,
  DEFAULT_ALERT_EVENT_COLUMN_IDS,
} from "./alertEventColumns";
import AlertEventsColumnModal from "./AlertEventsColumnModal";
import { SingleSelectFilter } from "./alertsFilters";
import "./AlertEvents.css"

type EntityFilterMode = "pipeline" | "rule" | "severity" | "status";

const getDefaultCustomRange = () => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  return {
    from: isoToDatetimeLocal(fifteenMinutesAgo.toISOString()),
    to: isoToDatetimeLocal(new Date().toISOString()),
  };
};

interface MultiSelectFilterProps<T extends string> {
  label: string;
  options: T[];
  selected: T[];
  onChange: (next: T[]) => void;
  getLabel?: (value: T) => string;
  showToolbarItem?: boolean;
}

function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
  getLabel = (value) => value,
  showToolbarItem = true,
}: MultiSelectFilterProps<T>) {
  const [isOpen, setIsOpen] = React.useState(false);

  const onToggleClick = () => {
    setIsOpen(!isOpen);
  };

  const onSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    const typed = value as T;
    if (selected.includes(typed)) {
      onChange(selected.filter((id) => id !== typed));
    } else {
      onChange([...selected, typed]);
    }
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      onClick={onToggleClick}
      isExpanded={isOpen}
      className="filter_select"
    >
      {label}
      {selected.length > 0 && <Badge className="filter_toggle_badge" isRead>{selected.length}</Badge>}
    </MenuToggle>
  );

  return (
    <ToolbarFilter
      labels={selected.map((value) => ({ key: value, node: getLabel(value) }))}
      deleteLabel={(_category, chip: ToolbarLabel | string) => {
        const key = (typeof chip === "string" ? chip : chip.key) as T;
        onChange(selected.filter((id) => id !== key));
      }}
      deleteLabelGroup={() => onChange([])}
      categoryName={label}
      showToolbarItem={showToolbarItem}
    >
      <Select
        role="menu"
        id={`${label.toLowerCase()}-checkbox-select`}
        isOpen={isOpen}
        selected={selected}
        onSelect={onSelect}
        onOpenChange={(nextOpen: boolean) => setIsOpen(nextOpen)}
        toggle={toggle}
      >
        <SelectList>
          {options.map((option) => (
            <SelectOption
              key={option}
              hasCheckbox
              value={option}
              isSelected={selected.includes(option)}
            >
              {getLabel(option)}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
    </ToolbarFilter>
  );
}

interface TypeaheadOption<T extends string | number> {
  value: T;
  label: string;
}

interface TypeaheadMultiSelectFilterProps<T extends string | number> {
  label: string;
  options: TypeaheadOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  isLoading?: boolean;
  /** Keep chips in the toolbar while hiding this filter's typeahead (the other entity is in view). */
  showToolbarItem?: boolean;
}

const NO_RESULTS_VALUE = "__no-results__";
const LOADING_VALUE = "__loading__";


function TypeaheadMultiSelectFilter<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  isLoading = false,
  showToolbarItem = true,
}: TypeaheadMultiSelectFilterProps<T>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [filterText, setFilterText] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const toggleValue = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const labelByValue = React.useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options]
  );

  const filteredOptions = React.useMemo(
    () =>
      filterText
        ? options.filter((option) => option.label.toLowerCase().includes(filterText.toLowerCase()))
        : options,
    [options, filterText]
  );

  return (
    <ToolbarFilter
      labels={selected.map((value) => ({
        key: String(value),
        node: labelByValue.get(value) ?? String(value),
      }))}
      deleteLabel={(_category, chip: ToolbarLabel | string) => {
        const key = typeof chip === "string" ? chip : chip.key;
        const match = options.find((option) => String(option.value) === key);
        toggleValue((match?.value ?? key) as T);
      }}
      deleteLabelGroup={() => onChange([])}
      categoryName={label}
      showToolbarItem={showToolbarItem}
    >
      <Select
        isOpen={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setFilterText("");
        }}
        selected={selected}
        onSelect={(_e, value) => {
          if (value === undefined || value === NO_RESULTS_VALUE || value === LOADING_VALUE) return;
          toggleValue(value as T);
        }}
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            variant="typeahead"
            onClick={() => {
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            isExpanded={isOpen}
            className="alert-events-filter-toggle"
          // badge={selected.length > 0 ? <Badge isRead>{selected.length}</Badge> : undefined}
          >
            <TextInputGroup isPlain>
              <TextInputGroupMain
                innerRef={inputRef}
                value={filterText}
                onClick={() => !isOpen && setIsOpen(true)}
                onChange={(_e, value) => {
                  setFilterText(value);
                  if (!isOpen) setIsOpen(true);
                }}
                autoComplete="off"
                placeholder={`Filter by ${label.toLowerCase()}`}
                role="combobox"
                isExpanded={isOpen}
              />
              {selected.length > 0 && <Badge className="alert-events-badge" isRead>{selected.length}</Badge>}
              {filterText && (
                <TextInputGroupUtilities>
                  <Button
                    variant="plain"
                    aria-label="Clear filter text"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilterText("");
                      inputRef.current?.focus();
                    }}
                    icon={<TimesIcon />}
                  />
                </TextInputGroupUtilities>
              )}
            </TextInputGroup>
          </MenuToggle>
        )}
      >
        <SelectList>
          {isLoading ? (
            <SelectOption key={LOADING_VALUE} value={LOADING_VALUE} isAriaDisabled>
              Loading {label.toLowerCase()}s…
            </SelectOption>
          ) : filteredOptions.length === 0 ? (
            <SelectOption key={NO_RESULTS_VALUE} value={NO_RESULTS_VALUE} isAriaDisabled>
              {filterText ? `No results found for "${filterText}"` : `No ${label.toLowerCase()}s found`}
            </SelectOption>
          ) : (
            filteredOptions.map((option) => (
              <SelectOption
                key={option.value}
                value={option.value}
                hasCheckbox
                isSelected={selected.includes(option.value)}
              >
                {option.label}
              </SelectOption>
            ))
          )}
        </SelectList>
      </Select>
    </ToolbarFilter>
  );
}

const AlertEvents: React.FC = () => {
  const navigate = useNavigate();

  const [severityFilter, setSeverityFilter] = React.useState<AlertSeverity[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<AlertEventStatus | undefined>(undefined);
  const [datePreset, setDatePreset] = React.useState<DateRangePreset | "All time">("All time");
  const [isDateOpen, setIsDateOpen] = React.useState(false);
  const defaultCustomRange = React.useMemo(() => getDefaultCustomRange(), []);
  const [customFromDraft, setCustomFromDraft] = React.useState(defaultCustomRange.from);
  const [customToDraft, setCustomToDraft] = React.useState(defaultCustomRange.to);
  const [appliedCustomFrom, setAppliedCustomFrom] = React.useState(defaultCustomRange.from);
  const [appliedCustomTo, setAppliedCustomTo] = React.useState(defaultCustomRange.to);

  const [entityFilterMode, setEntityFilterMode] = React.useState<EntityFilterMode>("severity");
  const [pipelineFilter, setPipelineFilter] = React.useState<string[]>([]);
  const [ruleFilter, setRuleFilter] = React.useState<number[]>([]);
  const [isFilterFieldSelectOpen, setIsFilterFieldSelectOpen] = React.useState(false);

  const FILTER_FIELD_OPTIONS: { value: EntityFilterMode; label: string }[] = [
      { value: "severity", label: "Severity" },
      { value: "status", label: "Status" },
    { value: "pipeline", label: "Pipeline" },
    { value: "rule", label: "Rule" },
  ];

  const onFilterFieldSelect = React.useCallback(
    (_event: React.MouseEvent<Element, MouseEvent> | undefined, value: string | number | undefined) => {
      setEntityFilterMode((value as EntityFilterMode) ?? "pipeline");
      setIsFilterFieldSelectOpen(false);
    },
    []
  );

  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set());
  const [isColumnModalOpen, setIsColumnModalOpen] = React.useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = React.useState<Set<AlertEventColumnId>>(
    () => new Set(DEFAULT_ALERT_EVENT_COLUMN_IDS)
  );
  const visibleColumns = React.useMemo(
    () => ALERT_EVENT_COLUMNS.filter((column) => visibleColumnIds.has(column.id)),
    [visibleColumnIds]
  );
  // `page` is 1-indexed (PatternFly's Pagination convention); converted to the API's
  // 0-indexed convention (default 0) when building queryParams below.
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(DEFAULT_ALERT_EVENTS_PAGE_SIZE);

  const onSetPage = (_event: React.MouseEvent | React.KeyboardEvent | MouseEvent, newPage: number) => {
    setPage(newPage);
  };

  const onPerPageSelect = (
    _event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    newPerPage: number,
    newPage: number
  ) => {
    setPerPage(newPerPage);
    setPage(newPage);
  };

  const { data: pipelinesList, isLoading: pipelinesLoading } = useResourceQuery<Pipeline[], Error>(
    "pipelines",
    () => fetchData<Pipeline[]>(`${API_URL}/api/pipelines`),
    { enabled: entityFilterMode === "pipeline" || pipelineFilter.length > 0 }
  );
  const pipelineOptions = React.useMemo<TypeaheadOption<string>[]>(
    () =>
      (pipelinesList ?? [])
        .map((pipeline) => ({ value: pipeline.name, label: pipeline.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [pipelinesList]
  );

  const { data: ruleSummaries, isLoading: rulesLoading } = useResourceQuery<AlertRuleSummary[], Error>(
    ALERT_RULES_QUERY_KEY,
    fetchAlertRules,
    { enabled: entityFilterMode === "rule" || ruleFilter.length > 0 }
  );
  const ruleOptions = React.useMemo<TypeaheadOption<number>[]>(
    () =>
      (ruleSummaries ?? [])
        .map((rule) => ({ value: rule.id, label: rule.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [ruleSummaries]
  );

  React.useEffect(() => {
    setPage(1);
  }, [severityFilter, statusFilter, pipelineFilter, ruleFilter, datePreset]);

  const [dateRange, setDateRange] = React.useState<{ from: string; to: string } | undefined>(
    undefined
  );

  React.useEffect(() => {
    if (datePreset === "All time") {
      setDateRange(undefined);
      return;
    }
    if (datePreset === "Custom") {
      return;
    }
    const { start, end } = calculateTimeRange(datePreset);
    setDateRange({ from: start, to: end });
  }, [datePreset]);

  const isCustomRangeValid =
    Boolean(customFromDraft) &&
    Boolean(customToDraft) &&
    new Date(datetimeLocalToISO(customFromDraft)).getTime() <
    new Date(datetimeLocalToISO(customToDraft)).getTime();

  const handleApplyCustomRange = () => {
    if (!isCustomRangeValid) {
      return;
    }
    setAppliedCustomFrom(customFromDraft);
    setAppliedCustomTo(customToDraft);
    setDateRange({
      from: datetimeLocalToISO(customFromDraft),
      to: datetimeLocalToISO(customToDraft),
    });
    setPage(1);
  };

  const onDatePresetSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    const preset = value as DateRangePreset | "All time";
    setDatePreset(preset);
    setIsDateOpen(false);
    if (preset === "Custom") {
      setCustomFromDraft(appliedCustomFrom);
      setCustomToDraft(appliedCustomTo);
    }
  };

  const queryParams = {
    page: page - 1,
    size: perPage,
    severity: severityFilter.length ? severityFilter : undefined,
    status: statusFilter ? [statusFilter] : undefined,
    pipelineId: pipelineFilter.length ? pipelineFilter : undefined,
    ruleId: ruleFilter.length ? ruleFilter : undefined,
    from: dateRange?.from,
    to: dateRange?.to,
  };

  const { data, isLoading, isError } = useResourceQuery<PagedAlertEventResponse, Error>(
    ["alertEvents", queryParams],
    () => fetchAlertEvents(queryParams),
    { profile: "slow" }
  );

  const events = React.useMemo(() => data?.events ?? [], [data]);
  const totalElements = data?.totalElements ?? 0;

  const hasActiveFilters =
    severityFilter.length > 0 ||
    statusFilter !== undefined ||
    pipelineFilter.length > 0 ||
    ruleFilter.length > 0 ||
    datePreset !== "All time";

  const clearAllFilters = () => {
    setSeverityFilter([]);
    setStatusFilter(undefined);
    setPipelineFilter([]);
    setRuleFilter([]);
    setDatePreset("All time");
    setCustomFromDraft(defaultCustomRange.from);
    setCustomToDraft(defaultCustomRange.to);
    setAppliedCustomFrom(defaultCustomRange.from);
    setAppliedCustomTo(defaultCustomRange.to);
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

  const renderEventCell = (columnId: AlertEventColumnId, event: AlertEvent) => {
    switch (columnId) {
      case "severity":
        return <SeverityIcon severity={event.severity} />;
      case "rule":
        return (
          <Button
            variant="link"
            isInline
            onClick={() => navigate(`/alerts/rules/${event.ruleId}?state=view`)}
          >
            {event.ruleName}
          </Button>
        );
      case "pipeline":
        return (
          <Button
            variant="link"
            isInline
            onClick={() => navigate(`/pipeline/${event.pipelineId}/monitoring`)}
          >
            {event.pipelineName}
          </Button>
        );
      case "status":
        return event.status === "FIRING" ? (
          <Label color={LabelColor.red}>Firing</Label>
        ) : (
          <Label color={LabelColor.green}>Resolved</Label>
        );
      case "value":
        return event.value;
      case "threshold":
        return event.threshold;
      case "firedAt":
        return formatDateTime(event.firedAt);
      case "resolvedAt":
        return formatDateTime(event.resolvedAt);
      case "createdAt":
        return formatDateTime(event.createdAt);
      case "duration":
        return formatDurationSeconds(event.durationSeconds, event.status === "FIRING");
    }
  };

  return (
    <div className="alert-events-wrapper">
      <PageHeader
        title="Alert events"
        description="Every fire/resolve cycle recorded as an incident, newest first."
      />
      <PageSection>
        <Card className="pipeline-card">
          <Toolbar
            id="toolbar-sticky"
            className="custom-toolbar"
            clearAllFilters={clearAllFilters}
            isSticky
          >
            <ToolbarContent>
              <ToolbarGroup variant="filter-group">
                <ToolbarItem>
                  <Select
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        icon={<FilterIcon />}
                        onClick={() => setIsFilterFieldSelectOpen((prev) => !prev)}
                        isExpanded={isFilterFieldSelectOpen}
                              className="filter_toggle"
                      >
                        {FILTER_FIELD_OPTIONS.find((o) => o.value === entityFilterMode)?.label ?? "Pipeline"}
                      </MenuToggle>
                    )}
                    onSelect={onFilterFieldSelect}
                    onOpenChange={setIsFilterFieldSelectOpen}
                    selected={entityFilterMode}
                    isOpen={isFilterFieldSelectOpen}
                  >
                    <SelectList>
                      {FILTER_FIELD_OPTIONS.map((option) => (
                        <SelectOption key={option.value} value={option.value}>
                          {option.label}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                </ToolbarItem>
                <ToolbarItem>
                  <MultiSelectFilter
                    label="Filter by severity"
                    options={["CRITICAL", "WARNING", "INFO"] as AlertSeverity[]}
                    selected={severityFilter}
                    onChange={setSeverityFilter}
                     showToolbarItem={entityFilterMode === "severity"}
                  />
                  <SingleSelectFilter
                    label="Filter by status"
                    options={["FIRING", "RESOLVED"] as AlertEventStatus[]}
                    selected={statusFilter}
                    onChange={setStatusFilter}
                    getLabel={(v) => (v === "FIRING" ? "Firing" : "Resolved")}
                        showToolbarItem={entityFilterMode === "status"}
                  />
                  <TypeaheadMultiSelectFilter
                    label="Pipeline"
                    options={pipelineOptions}
                    selected={pipelineFilter}
                    onChange={setPipelineFilter}
                    isLoading={pipelinesLoading}
                    showToolbarItem={entityFilterMode === "pipeline"}
                  />
                  <TypeaheadMultiSelectFilter
                    label="Rule"
                    options={ruleOptions}
                    selected={ruleFilter}
                    onChange={setRuleFilter}
                    isLoading={rulesLoading}
                    showToolbarItem={entityFilterMode === "rule"}
                  />
                </ToolbarItem>
              </ToolbarGroup>

              {/* <ToolbarGroup variant="filter-group">
                <ToolbarItem>
                  <MultiSelectFilter
                    label="Severity"
                    options={["CRITICAL", "WARNING", "INFO"] as AlertSeverity[]}
                    selected={severityFilter}
                    onChange={setSeverityFilter}
                  />
                </ToolbarItem>
                <ToolbarItem>
                  <SingleSelectFilter
                    label="Status"
                    options={["FIRING", "RESOLVED"] as AlertEventStatus[]}
                    selected={statusFilter}
                    onChange={setStatusFilter}
                    getLabel={(v) => (v === "FIRING" ? "Firing" : "Resolved")}
                  />
                </ToolbarItem>
              </ToolbarGroup> */}
              <ToolbarGroup variant="filter-group">
                <ToolbarItem>
                  <Select
                    id="time-range-select"
                    isOpen={isDateOpen}
                    onOpenChange={setIsDateOpen}
                    selected={datePreset}
                    onSelect={onDatePresetSelect}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setIsDateOpen((prev) => !prev)}
                        isExpanded={isDateOpen}
                        icon={<OutlinedClockIcon />}
                        className="filter_toggle"
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
                  </Select></ToolbarItem>

                {datePreset === "Custom" && (
                  <>
                    <ToolbarItem>
                      <TextInput
                        id="alert-history-from"
                        type="datetime-local"
                        aria-label="Alert history from date and time"
                        value={customFromDraft}
                        onChange={(_event, value) => setCustomFromDraft(value)}
                      />
                    </ToolbarItem>
                    <ToolbarItem>
                      <TextInput
                        id="alert-history-to"
                        type="datetime-local"
                        aria-label="Alert history to date and time"
                        value={customToDraft}
                        onChange={(_event, value) => setCustomToDraft(value)}
                      />
                    </ToolbarItem>
                    <ToolbarItem>
                      <Button
                        variant="primary"
                        onClick={handleApplyCustomRange}
                        isDisabled={!isCustomRangeValid}
                      >
                        Apply
                      </Button>
                    </ToolbarItem>

                  </>
                )}
              </ToolbarGroup>


              <ToolbarItem>
                <Button variant="link" onClick={() => setIsColumnModalOpen(true)}>
                  Manage columns
                </Button>
              </ToolbarItem>
              <ToolbarItem align={{ default: "alignEnd" }}>
                <Pagination
                  itemCount={totalElements}
                  perPage={perPage}
                  page={page}
                  onSetPage={onSetPage}
                  widgetId="compact-example"
                  onPerPageSelect={onPerPageSelect}
                  isCompact
                />
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>

          {isLoading ? (
            <Bullseye>
              <Spinner size="lg" aria-label="Loading alert history" />
            </Bullseye>
          ) : isError ? (
            <Bullseye>
              <EmptyState
                variant={EmptyStateVariant.sm}
                titleText="Failed to load alert history"
                headingLevel="h2"
                icon={ExclamationCircleIcon}
              >
                <EmptyStateBody>Check your connection and try again.</EmptyStateBody>
              </EmptyState>
            </Bullseye>
          ) : events.length > 0 ? (
            <>
              <Table aria-label="Alert history table">
                <Thead>
                  <Tr>
                    <Th screenReaderText="Expand" />
                    {visibleColumns.map((column) => (
                      <Th key={column.id}>{column.label}</Th>
                    ))}
                  </Tr>
                </Thead>
                {events.map((event, rowIndex) => {
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
                        {visibleColumns.map((column) => (
                          <Td key={column.id} dataLabel={column.label}>
                            {renderEventCell(column.id, event)}
                          </Td>
                        ))}
                      </Tr>
                      {isExpanded && (
                        <Tr isExpanded={isExpanded}>
                          <Td></Td>
                          <Td colSpan={visibleColumns.length}>
                            <ExpandableRowContent>
                              <dl className="alerts-detail-panel">
                                <dt>Severity</dt>
                                <dd>
                                  <SeverityLabel severity={event.severity} />
                                </dd>
                                <dt>Fired at</dt>
                                <dd>{formatDateTime(event.firedAt)}</dd>
                                <dt>Resolved at</dt>
                                <dd>{formatDateTime(event.resolvedAt)}</dd>
                                <dt>Duration</dt>
                                <dd>
                                  {formatDurationSeconds(
                                    event.durationSeconds,
                                    event.status === "FIRING"
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
                itemCount={totalElements}
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
                  {hasActiveFilters ? (
                    <Button variant="link" onClick={clearAllFilters}>
                      Clear all filters
                    </Button>
                  ) : (
                    "No incidents have been recorded yet."
                  )}
                </EmptyStateBody>
              </EmptyState>
            </Bullseye>
          )}
        </Card>
      </PageSection>
      {isColumnModalOpen && (
        <AlertEventsColumnModal
          isOpen={isColumnModalOpen}
          visibleColumnIds={visibleColumnIds}
          onClose={() => setIsColumnModalOpen(false)}
          onSave={(columnIds) => {
            setVisibleColumnIds(new Set(columnIds));
            setIsColumnModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default AlertEvents;
