import { FC, useEffect, useMemo, useState, type Ref } from "react";
import {
  Alert,
  Bullseye,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Content,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Flex,
  Icon,
  Label,
  LabelColor,
  MenuToggle,
  MenuToggleElement,
  Pagination,
  PaginationVariant,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  Tab,
  Tabs,
  TabTitleText,
  TextInput,
  Toolbar,
  ToolbarContent,
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
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  FilterIcon,
  HistoryIcon,
  InProgressIcon,
  OutlinedCircleIcon,
  OutlinedClockIcon,
  RhUiPauseCircleIcon,
  RhUiRunningIcon,
} from "@patternfly/react-icons";
import { useTranslation } from "react-i18next";
import ApiError from "@components/ApiError";
import { SingleSelectFilter } from "../Alerts/alertsFilters";
import {
  calculateTimeRange,
  datetimeLocalToISO,
  isoToDatetimeLocal,
  type TimeRangePreset,
} from "../../utils/timeRangeUtils";
import {
  getSnapshotHistory,
  getSnapshotHistoryDetail,
  type PagedSnapshotHistoryResponse,
  type SnapshotHistoryQuery,
  type SnapshotHistoryResponse,
  type SnapshotHistoryTable,
  type SnapshotOutcome,
  type SnapshotProgressResponse,
  type SnapshotTable,
  type SnapshotType,
  type TableState,
} from "../../apis/snapshots";
import SnapshotProgressBar from "./SnapshotProgressBar";
import {
  formatCount,
  formatDuration,
  formatSnapshotDate,
  formatSnapshotTime,
  isSnapshotActive,
  sortSnapshotTables,
} from "./snapshotModel";
import { useSnapshotElapsed, useOptionalSnapshotProgress } from "./useSnapshotProgress";
import "./snapshotProgress.css";

const HISTORY_PAGE_SIZE = 20;

const HISTORY_TYPES: SnapshotType[] = ["INITIAL", "INCREMENTAL", "BLOCKING"];

const HISTORY_OUTCOMES = ["COMPLETED", "ABORTED", "SKIPPED"] as const;

type HistoryOutcomeFilter = (typeof HISTORY_OUTCOMES)[number];

type HistoryFilterField = "type" | "outcome";

type HistoryDatePreset = "all" | "6h" | "12h" | "24h" | "custom";

const DATE_PRESET_RANGE: Record<Exclude<HistoryDatePreset, "all" | "custom">, TimeRangePreset> = {
  "6h": "Last 6 hours",
  "12h": "Last 12 hours",
  "24h": "Last 24 hours",
};

const datePresetLabelKey: Record<HistoryDatePreset, string> = {
  all: "pipeline:snapshots.allTime",
  "6h": "pipeline:snapshots.last6Hours",
  "12h": "pipeline:snapshots.last12Hours",
  "24h": "pipeline:snapshots.last24Hours",
  custom: "pipeline:snapshots.customRange",
};

const getDefaultCustomRange = () => {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return {
    from: isoToDatetimeLocal(dayAgo.toISOString()),
    to: isoToDatetimeLocal(new Date().toISOString()),
  };
};

type SnapshotSection = "progress" | "history";

type PipelineSnapshotsProps = {
  pipelineId: string;
  activeTabKey: string;
  progress?: SnapshotProgressResponse | null;
  isProgressLoading?: boolean;
  progressError?: string | null;
  onRetryProgress?: () => void;
};

const typeLabelKey = (type: SnapshotType | null): string => {
      if (type === "INCREMENTAL") return "pipeline:snapshots.typeIncremental";
      if (type === "INITIAL") return "pipeline:snapshots.typeInitial";
      return "pipeline:snapshots.typeBlocking";
    };

const shortTypeKey = (type: SnapshotType): string =>
  type === "INCREMENTAL"
    ? "pipeline:snapshots.typeIncrementalShort"
    : "pipeline:snapshots.typeInitialShort";

const tableStatusKey: Record<TableState, string> = {
  PENDING: "pipeline:snapshots.statusPending",
  IN_PROGRESS: "pipeline:snapshots.statusInProgress",
  COMPLETED: "pipeline:snapshots.statusCompleted",
  SKIPPED: "pipeline:snapshots.statusSkipped",
  FAILED: "pipeline:snapshots.statusFailed",
};

const outcomeKey: Record<SnapshotOutcome, string> = {
  COMPLETED: "pipeline:snapshots.outcomeCompleted",
  ABORTED: "pipeline:snapshots.outcomeAborted",
  SKIPPED: "pipeline:snapshots.outcomeSkipped",
  UNKNOWN: "pipeline:snapshots.outcomeUnknown",
};

const outcomeColor: Record<SnapshotOutcome, LabelColor> = {
  COMPLETED: LabelColor.green,
  ABORTED: LabelColor.red,
  SKIPPED: LabelColor.orange,
  UNKNOWN: LabelColor.grey,
};

const TableStatus: FC<{ status: TableState; label: string }> = ({ status, label }) => {
  const icon = {
    COMPLETED: <CheckCircleIcon />,
    IN_PROGRESS: <InProgressIcon />,
    PENDING: <OutlinedCircleIcon />,
    SKIPPED: <ExclamationTriangleIcon />,
    FAILED: <ExclamationCircleIcon />,
  }[status];
  const iconStatus = {
    COMPLETED: "success",
    IN_PROGRESS: "info",
    PENDING: "custom",
    SKIPPED: "warning",
    FAILED: "danger",
  } as const;

  return (
    <Flex
      spaceItems={{ default: "spaceItemsSm" }}
      alignItems={{ default: "alignItemsCenter" }}
      flexWrap={{ default: "nowrap" }}
    >
      <Icon status={iconStatus[status]} isInline>
        {icon}
      </Icon>
      <span>{label}</span>
    </Flex>
  );
};

const TableProgressCell: FC<{ table: SnapshotTable }> = ({ table }) => {
  const { t, i18n } = useTranslation();

  if (table.status === "SKIPPED" || table.status === "FAILED") {
    return <span>{table.skipReason || "—"}</span>;
  }

  if (table.status === "PENDING") {
    return null;
  }

  const percentage =
    table.status === "COMPLETED" && table.progress?.percentage == null
      ? 100
      : table.progress?.percentage ?? null;

  if (percentage == null) {
    const rows =
      table.rowsScanned == null
        ? null
        : formatCount(table.rowsScanned, i18n.language);
    return (
      <Flex
        spaceItems={{ default: "spaceItemsSm" }}
        alignItems={{ default: "alignItemsCenter" }}
        flexWrap={{ default: "nowrap" }}
      >
        <Spinner
          size="sm"
          isInline
          aria-label={t("pipeline:snapshots.scanning")}
        />
        <span>
          {rows
            ? t("pipeline:snapshots.rowsInline", { count: rows })
            : t("pipeline:snapshots.scanning")}
        </span>
      </Flex>
    );
  }

  return (
    <div className="snapshot-progress__table-bar">
      <SnapshotProgressBar
        percentage={percentage}
        ariaLabel={t("pipeline:snapshots.tableProgress", { table: table.name })}
      />
    </div>
  );
};

const HistoryDetailTable: FC<{ tables: SnapshotHistoryTable[] }> = ({ tables }) => {
  const { t, i18n } = useTranslation();

  return (
    <Table aria-label={t("pipeline:snapshots.historyTables")} variant="compact">
      <Thead>
        <Tr>
          <Th>{t("pipeline:snapshots.columnTable")}</Th>
          <Th>{t("pipeline:snapshots.columnOutcome")}</Th>
          <Th>{t("pipeline:snapshots.columnRows")}</Th>
          <Th>{t("pipeline:snapshots.columnDuration")}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {tables.map((table) => (
          <Tr key={table.tableName}>
            <Td dataLabel={t("pipeline:snapshots.columnTable")}>{table.tableName}</Td>
            <Td dataLabel={t("pipeline:snapshots.columnOutcome")}>
              {outcomeKey[table.outcome as SnapshotOutcome]
                ? t(outcomeKey[table.outcome as SnapshotOutcome])
                : table.outcome}
            </Td>
            <Td dataLabel={t("pipeline:snapshots.columnRows")}>
              {formatCount(table.rowsScanned, i18n.language)}
            </Td>
            <Td dataLabel={t("pipeline:snapshots.columnDuration")}>
              {formatDuration(table.durationSeconds) ?? "—"}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

const PipelineSnapshots: FC<PipelineSnapshotsProps> = ({
  pipelineId,
  activeTabKey,
  progress: progressProp,
  isProgressLoading: isProgressLoadingProp,
  progressError: progressErrorProp,
  onRetryProgress: onRetryProgressProp,
}) => {
  const { t, i18n } = useTranslation();
  const liveSnapshot = useOptionalSnapshotProgress();
  const progress = progressProp !== undefined ? progressProp : liveSnapshot?.progress ?? null;
  const isProgressLoading = isProgressLoadingProp ?? liveSnapshot?.isLoading ?? false;
  const progressError = progressErrorProp !== undefined ? progressErrorProp : liveSnapshot?.error ?? null;
  const onRetryProgress = onRetryProgressProp ?? liveSnapshot?.refresh ?? (() => undefined);
  const elapsedSeconds = useSnapshotElapsed(progress);
  const status = progress?.status;
  const [history, setHistory] = useState<PagedSnapshotHistoryResponse | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(HISTORY_PAGE_SIZE);
  const [historyReload, setHistoryReload] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, SnapshotHistoryResponse>>({});
  const [detailErrors, setDetailErrors] = useState<Record<number, string>>({});
  const [historyPipelineId, setHistoryPipelineId] = useState(pipelineId);
  const [chosenSection, setChosenSection] = useState<SnapshotSection | null>(null);
  const snapshotSection: SnapshotSection =
    chosenSection ?? (status != null && !isSnapshotActive(status) ? "history" : "progress");
  const [typeFilter, setTypeFilter] = useState<SnapshotType | undefined>();
  const [outcomeFilter, setOutcomeFilter] = useState<HistoryOutcomeFilter | undefined>();
  const [historyFilterField, setHistoryFilterField] = useState<HistoryFilterField>("type");
  const [isFilterFieldOpen, setIsFilterFieldOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<HistoryDatePreset>("all");
  const [isDateOpen, setIsDateOpen] = useState(false);
  const defaultCustomRange = useMemo(() => getDefaultCustomRange(), []);
  const [customFromDraft, setCustomFromDraft] = useState(defaultCustomRange.from);
  const [customToDraft, setCustomToDraft] = useState(defaultCustomRange.to);
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ from: string; to: string } | null>(
    null
  );

  const historyRange = useMemo(() => {
    if (datePreset === "6h" || datePreset === "12h" || datePreset === "24h") {
      const { start, end } = calculateTimeRange(DATE_PRESET_RANGE[datePreset]);
      return { from: start, to: end };
    }
    if (datePreset === "custom" && appliedCustomRange) {
      return appliedCustomRange;
    }
    return undefined;
  }, [datePreset, appliedCustomRange]);

  const shouldLoadHistory =
    activeTabKey === "snapshots" &&
    snapshotSection === "history" &&
    Boolean(pipelineId);
  const historyQuery = useMemo<SnapshotHistoryQuery>(
    () => ({
      page: page - 1,
      size: perPage,
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(outcomeFilter ? { outcome: outcomeFilter } : {}),
      ...(historyRange ? { from: historyRange.from, to: historyRange.to } : {}),
    }),
    [page, perPage, typeFilter, outcomeFilter, historyRange]
  );
  const historyRequestKey = [
    pipelineId,
    page,
    perPage,
    historyReload,
    status ?? "",
    activeTabKey,
    isProgressLoading ? "1" : "0",
    progressError ?? "",
    typeFilter ?? "",
    outcomeFilter ?? "",
    historyRange?.from ?? "",
    historyRange?.to ?? "",
  ].join(":");

  useEffect(() => {
    if (!shouldLoadHistory || !pipelineId) {
      return;
    }

    let cancelled = false;
    const key = historyRequestKey;

    void getSnapshotHistory(pipelineId, historyQuery).then((response) => {
      if (cancelled) {
        return;
      }
      if (response.error || !response.data) {
        setHistory(null);
        setHistoryError(response.error ?? "Snapshot history is unavailable.");
        setHistoryKey(key);
        return;
      }
      setHistoryError(null);
      setHistory(response.data);
      setHistoryKey(key);
    });

    return () => {
      cancelled = true;
    };
  }, [shouldLoadHistory, pipelineId, historyQuery, historyRequestKey]);

  useEffect(() => {
    if (expandedId == null || details[expandedId] || !pipelineId) {
      return;
    }

    let cancelled = false;

    void getSnapshotHistoryDetail(pipelineId, expandedId).then((response) => {
      if (cancelled) {
        return;
      }
      if (response.error || !response.data) {
        setDetailErrors((current) => ({
          ...current,
          [expandedId]: response.error ?? "Snapshot history is unavailable.",
        }));
        return;
      }
      setDetails((current) => ({
        ...current,
        [expandedId]: response.data as SnapshotHistoryResponse,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [expandedId, pipelineId, details]);

  if (pipelineId !== historyPipelineId) {
    setHistoryPipelineId(pipelineId);
    setHistory(null);
    setHistoryError(null);
    setHistoryKey(null);
    setExpandedId(null);
    setDetails({});
    setDetailErrors({});
    setPage(1);
    setTypeFilter(undefined);
    setOutcomeFilter(undefined);
    setHistoryFilterField("type");
    setIsFilterFieldOpen(false);
    setDatePreset("all");
    setAppliedCustomRange(null);
    setCustomFromDraft(defaultCustomRange.from);
    setCustomToDraft(defaultCustomRange.to);
    setChosenSection(null);
  }

  const historyLoading = shouldLoadHistory && historyKey !== historyRequestKey;
  const progressTabTitle = useMemo(
    () => <TabTitleText>{t("pipeline:snapshots.progressTitle")}</TabTitleText>,
    [t]
  );
  const historyTabTitle = useMemo(
    () => <TabTitleText>{t("pipeline:snapshots.historyTable")}</TabTitleText>,
    [t]
  );

  const renderProgress = () => {
  if (isProgressLoading && !progress) {
    return (
      <Bullseye>
        <Spinner aria-label={t("pipeline:snapshots.progressTitle")} />
      </Bullseye>
    );
  }

  if (progressError && !progress) {
    return (
      <ApiError
        errorType="large"
        errorMsg={progressError}
        onRetry={onRetryProgress}
      />
    );
  }

  if (progress && isSnapshotActive(progress.status)) {
    const isPaused = progress.status === "PAUSED";
    const isRunning = progress.status === "RUNNING";
    const duration = formatDuration(elapsedSeconds);
    const started = formatSnapshotTime(progress.startedAt, i18n.language);
    const globalProgress = progress.globalProgress;
    const summary = [
      started ? t("pipeline:snapshots.startedLine", { time: started }) : null,
      duration ? t("pipeline:snapshots.elapsedLine", { duration }) : null,
    ].filter((part): part is string => Boolean(part));
    const totals = [
      globalProgress && globalProgress.totalTables > 0
        ? t("pipeline:snapshots.tablesLine", {
            completed: globalProgress.completedTables,
            total: globalProgress.totalTables,
          })
        : null,
      progress.totalRowsScanned != null
        ? t("pipeline:snapshots.totalRowsLine", {
            count: formatCount(progress.totalRowsScanned, i18n.language),
          })
        : null,
    ].filter((part): part is string => Boolean(part));
    const tables = sortSnapshotTables(progress.tables ?? []);

    return (
        <Card>
          <CardHeader>
            <CardTitle>
              <Flex
                spaceItems={{ default: "spaceItemsSm" }}
                alignItems={{ default: "alignItemsCenter" }}
              >
                <span>{t(typeLabelKey(progress.type))}</span>
                {isPaused && (
                  <Label color={LabelColor.orange} icon={<RhUiPauseCircleIcon />}>
                    {t("pipeline:snapshots.paused")}
                  </Label>
                )}
                {isRunning && (
                  <Label color={LabelColor.blue} icon={<RhUiRunningIcon />}>
                    {t("pipeline:snapshots.running")}
                  </Label>
                )}
              </Flex>
            </CardTitle>
          </CardHeader>
          <CardBody>
          <Flex
            alignItems={{ default: "alignItemsCenter" }}
            flexWrap={{ default: "nowrap" }}
            spaceItems={{ default: "spaceItemsMd" }}
          >
            <div className="snapshot-progress__bar">
              <SnapshotProgressBar
                percentage={globalProgress?.percentage ?? null}
                measureLocation="inside"
                isPaused={isPaused}
                ariaLabel={
                  globalProgress?.percentage == null
                    ? t("pipeline:snapshots.unknownProgress")
                    : t("pipeline:snapshots.progressTitle")
                }
              />
            </div>
          </Flex>
          {summary.length > 0 && (
            <Content component="p" className="snapshot-progress__summary">
              {summary.join(" | ")}
            </Content>
          )}
          <Content component="h3" className="snapshot-progress__section-title">
            {t("pipeline:snapshots.tables")}
          </Content>
          {totals.length > 0 && (
            <Content component="p" className="snapshot-table__progress__summary">
              {totals.join(" | ")}
            </Content>
          )}
          <Table aria-label={t("pipeline:snapshots.activeTables")} variant="compact">
            <Thead>
              <Tr>
                <Th>{t("pipeline:snapshots.columnTable")}</Th>
                <Th>{t("pipeline:snapshots.columnStatus")}</Th>
                <Th>{t("pipeline:snapshots.columnProgress")}</Th>
                <Th className="snapshot-table__rows-column">{t("pipeline:snapshots.columnRows")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {tables.map((table) => (
                <Tr key={table.name}>
                  <Td dataLabel={t("pipeline:snapshots.columnTable")}>{table.name}</Td>
                  <Td dataLabel={t("pipeline:snapshots.columnStatus")}>
                    <TableStatus status={table.status} label={t(tableStatusKey[table.status])} />
                  </Td>
                  <Td dataLabel={t("pipeline:snapshots.columnProgress")}>
                    <TableProgressCell table={table} />
                  </Td>
                  <Td className="snapshot-table__rows-column" dataLabel={t("pipeline:snapshots.columnRows")}>
                    {formatCount(table.rowsScanned, i18n.language)}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          </CardBody>
        </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <Content component="p">{t("pipeline:snapshots.noActive")}</Content>
      </CardBody>
    </Card>
  );
  };

  const items = history?.items ?? [];
  const hasActiveFilters =
    typeFilter != null || outcomeFilter != null || datePreset !== "all";
  const isCustomRangeValid =
    Boolean(customFromDraft) &&
    Boolean(customToDraft) &&
    new Date(datetimeLocalToISO(customFromDraft)).getTime() <
      new Date(datetimeLocalToISO(customToDraft)).getTime();

  const resetHistoryPage = () => {
    setExpandedId(null);
    setPage(1);
  };

  const clearHistoryFilters = () => {
    setTypeFilter(undefined);
    setOutcomeFilter(undefined);
    setHistoryFilterField("type");
    setIsFilterFieldOpen(false);
    setDatePreset("all");
    setAppliedCustomRange(null);
    setCustomFromDraft(defaultCustomRange.from);
    setCustomToDraft(defaultCustomRange.to);
    resetHistoryPage();
  };

  const onHistoryPage = (_event: unknown, newPage: number) => {
    setExpandedId(null);
    setPage(newPage);
  };

  const onHistoryPerPage = (_event: unknown, newPerPage: number, newPage: number) => {
    setExpandedId(null);
    setPerPage(newPerPage);
    setPage(newPage);
  };

  const onDatePresetSelect = (_event: unknown, value: string | number | undefined) => {
    const preset = (value as HistoryDatePreset) ?? "all";
    setDatePreset(preset);
    setIsDateOpen(false);
    if (preset === "custom") {
      if (appliedCustomRange) {
        setCustomFromDraft(isoToDatetimeLocal(appliedCustomRange.from));
        setCustomToDraft(isoToDatetimeLocal(appliedCustomRange.to));
      } else if (historyRange) {
        setAppliedCustomRange(historyRange);
        setCustomFromDraft(isoToDatetimeLocal(historyRange.from));
        setCustomToDraft(isoToDatetimeLocal(historyRange.to));
      }
    }
    resetHistoryPage();
  };

  const applyCustomRange = () => {
    if (!isCustomRangeValid) {
      return;
    }
    setAppliedCustomRange({
      from: datetimeLocalToISO(customFromDraft),
      to: datetimeLocalToISO(customToDraft),
    });
    resetHistoryPage();
  };

  const historyPagination = (placement: "top" | "bottom") => (
    <Pagination
      itemCount={history?.totalElements ?? 0}
      perPage={perPage}
      page={page}
      onSetPage={onHistoryPage}
      onPerPageSelect={onHistoryPerPage}
      isCompact={placement === "top"}
      variant={placement === "bottom" ? PaginationVariant.bottom : undefined}
      widgetId={`snapshot-history-pagination-${placement}`}
    />
  );

  const historyView = (
      <Card>
        <CardBody style={{padding: 0 }}>
        <Toolbar
          id="snapshot-history-toolbar"
          className="snapshot-progress__history-toolbar"
          // className="custom-toolbar"
          isSticky
          clearAllFilters={clearHistoryFilters}
          clearFiltersButtonText={t("clearAllFilter")}
        >
          <ToolbarContent>
            <ToolbarGroup variant="filter-group">
              <ToolbarItem>
                <Select
                  id="snapshot-history-filter-field"
                  isOpen={isFilterFieldOpen}
                  onOpenChange={setIsFilterFieldOpen}
                  selected={historyFilterField}
                  onSelect={(_event, value) => {
                    setHistoryFilterField((value as HistoryFilterField) ?? "type");
                    setIsFilterFieldOpen(false);
                  }}
                  toggle={(toggleRef: Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      icon={<FilterIcon />}
                      onClick={() => setIsFilterFieldOpen((current) => !current)}
                      isExpanded={isFilterFieldOpen}
                      className="filter_toggle"
                    >
                      {t(
                        historyFilterField === "outcome"
                          ? "pipeline:snapshots.filterOutcome"
                          : "pipeline:snapshots.filterType"
                      )}
                    </MenuToggle>
                  )}
                >
                  <SelectList>
                    <SelectOption value="type">{t("pipeline:snapshots.filterType")}</SelectOption>
                    <SelectOption value="outcome">
                      {t("pipeline:snapshots.filterOutcome")}
                    </SelectOption>
                  </SelectList>
                </Select>
              </ToolbarItem>
              <ToolbarItem>
                <SingleSelectFilter
                  label={t("pipeline:snapshots.filterByType")}
                  options={HISTORY_TYPES}
                  selected={typeFilter}
                  onChange={(value) => {
                    setTypeFilter(value);
                    resetHistoryPage();
                  }}
                  getLabel={(value) => t(typeLabelKey(value))}
                  allOption={t("pipeline:snapshots.allTypes")}
                  showToolbarItem={historyFilterField === "type"}
                />
                <SingleSelectFilter
                  label={t("pipeline:snapshots.filterByOutcome")}
                  options={[...HISTORY_OUTCOMES]}
                  selected={outcomeFilter}
                  onChange={(value) => {
                    setOutcomeFilter(value);
                    resetHistoryPage();
                  }}
                  getLabel={(value) => t(outcomeKey[value])}
                  allOption={t("pipeline:snapshots.allOutcomes")}
                  showToolbarItem={historyFilterField === "outcome"}
                />
              </ToolbarItem>
            </ToolbarGroup>
            <ToolbarGroup variant="filter-group">
              <ToolbarItem>
                <Select
                  id="snapshot-history-time-range"
                  isOpen={isDateOpen}
                  onOpenChange={setIsDateOpen}
                  selected={datePreset}
                  onSelect={onDatePresetSelect}
                  toggle={(toggleRef: Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      onClick={() => setIsDateOpen((current) => !current)}
                      isExpanded={isDateOpen}
                      icon={<OutlinedClockIcon />}
                    >
                      {t(datePresetLabelKey[datePreset])}
                    </MenuToggle>
                  )}
                >
                  <SelectList>
                    {(Object.keys(datePresetLabelKey) as HistoryDatePreset[]).map((preset) => (
                      <SelectOption key={preset} value={preset}>
                        {t(datePresetLabelKey[preset])}
                      </SelectOption>
                    ))}
                  </SelectList>
                </Select>
              </ToolbarItem>
              {datePreset === "custom" && (
                <>
                  <ToolbarItem>
                    <TextInput
                      id="snapshot-history-from"
                      type="datetime-local"
                      aria-label={t("pipeline:snapshots.filterFrom")}
                      value={customFromDraft}
                      onChange={(_event, value) => setCustomFromDraft(value)}
                    />
                  </ToolbarItem>
                  <ToolbarItem>
                    <TextInput
                      id="snapshot-history-to"
                      type="datetime-local"
                      aria-label={t("pipeline:snapshots.filterTo")}
                      value={customToDraft}
                      onChange={(_event, value) => setCustomToDraft(value)}
                    />
                  </ToolbarItem>
                  <ToolbarItem>
                    <Button
                      variant="primary"
                      onClick={applyCustomRange}
                      isDisabled={!isCustomRangeValid}
                    >
                      {t("apply")}
                    </Button>
                  </ToolbarItem>
                </>
              )}
            </ToolbarGroup>
            <ToolbarItem align={{ default: "alignEnd" }}>
              {historyPagination("top")}
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
        {historyError && (
          <Alert
            variant="danger"
            isInline
            title={t("pipeline:snapshots.historyError")}
            actionLinks={
              <Button
                variant="link"
                isInline
                onClick={() => setHistoryReload((value) => value + 1)}
              >
                {t("tryAgain")}
              </Button>
            }
          />
        )}
        {historyLoading && !history ? (
          <Bullseye>
            <Spinner aria-label={t("pipeline:snapshots.history")} />
          </Bullseye>
        ) : historyError ? null : items.length === 0 ? (
          <Bullseye className="snapshot-history__empty">
            <EmptyState
              variant={EmptyStateVariant.sm}
              titleText={
                hasActiveFilters
                  ? t("pipeline:snapshots.noHistoryFiltered")
                  : t("pipeline:snapshots.noHistory")
              }
              headingLevel="h2"
              icon={HistoryIcon}
            >
              <EmptyStateBody>
                {hasActiveFilters ? (
                  <Button variant="link" onClick={clearHistoryFilters}>
                    {t("clearAllFilter")}
                  </Button>
                ) : (
                  t("pipeline:snapshots.noHistoryDescription")
                )}
              </EmptyStateBody>
            </EmptyState>
          </Bullseye>
        ) : (
          <div className="snapshot-history__card-body">
            <Table aria-label={t("pipeline:snapshots.historyTable")} variant="compact">
              <Thead>
                <Tr>
                  <Th screenReaderText={t("pipeline:snapshots.expandRow")} />
                  <Th>{t("pipeline:snapshots.columnType")}</Th>
                  <Th>{t("pipeline:snapshots.columnOutcome")}</Th>
                  <Th>{t("pipeline:snapshots.columnTables")}</Th>
                  <Th>{t("pipeline:snapshots.columnRows")}</Th>
                  <Th>{t("pipeline:snapshots.columnDuration")}</Th>
                  <Th>{t("pipeline:snapshots.columnDate")}</Th>
                </Tr>
              </Thead>
              {items.map((item, rowIndex) => {
                const isExpanded = expandedId === item.id;
                const detail = details[item.id];
                return (
                  <Tbody key={item.id} isExpanded={isExpanded}>
                    <Tr>
                      <Td
                        expand={{
                          rowIndex,
                          isExpanded,
                          onToggle: () =>
                            setExpandedId((current) =>
                              current === item.id ? null : item.id
                            ),
                        }}
                      />
                      <Td dataLabel={t("pipeline:snapshots.columnType")}>
                        {t(shortTypeKey(item.type))}
                      </Td>
                      <Td dataLabel={t("pipeline:snapshots.columnOutcome")}>
                        <Label isCompact color={outcomeColor[item.outcome] ?? LabelColor.grey}>
                          {outcomeKey[item.outcome]
                            ? t(outcomeKey[item.outcome])
                            : item.outcome}
                        </Label>
                      </Td>
                      <Td dataLabel={t("pipeline:snapshots.columnTables")}>
                        {item.completedTables}/{item.totalTables}
                      </Td>
                      <Td dataLabel={t("pipeline:snapshots.columnRows")}>
                        {formatCount(item.totalRowsScanned, i18n.language)}
                      </Td>
                      <Td dataLabel={t("pipeline:snapshots.columnDuration")}>
                        {formatDuration(item.durationSeconds) ?? "—"}
                      </Td>
                      <Td dataLabel={t("pipeline:snapshots.columnDate")}>
                        {formatSnapshotDate(item.completedAt, i18n.language)}
                      </Td>
                    </Tr>
                    {isExpanded && (
                      <Tr isExpanded>
                        <Td />
                        <Td colSpan={6}>
                          <ExpandableRowContent>
                            {!detail && !detailErrors[item.id] ? (
                              <Spinner size="sm" aria-label={t("pipeline:snapshots.historyTables")} />
                            ) : detailErrors[item.id] && !detail ? (
                              <Content component="p">{detailErrors[item.id]}</Content>
                            ) : (
                              <HistoryDetailTable tables={detail?.tables ?? []} />
                            )}
                          </ExpandableRowContent>
                        </Td>
                      </Tr>
                    )}
                  </Tbody>
                );
              })}
            </Table>
            {/* {historyPagination("bottom")} */}
          </div>
        )}
        </CardBody>
      </Card>
  );

  return (
    <>
      <Tabs
        activeKey={snapshotSection}
        onSelect={(_event, eventKey) => setChosenSection(eventKey as SnapshotSection)}
        className="snapshot-progress__sections"
        aria-label={t("pipeline:tabs.snapshots")}
        id="snapshot-sections"
      >
        <Tab eventKey="progress" title={progressTabTitle} />
        <Tab eventKey="history" title={historyTabTitle} />
      </Tabs>
      {snapshotSection === "history" ? historyView : renderProgress()}
    </>
  );
};

export default PipelineSnapshots;
