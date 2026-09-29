import { FC, useEffect, useRef, useState } from "react";
import {
  Alert,
  Bullseye,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Content,
  Flex,
  Icon,
  Label,
  LabelColor,
  Pagination,
  Spinner,
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
  InProgressIcon,
  OutlinedCircleIcon,
} from "@patternfly/react-icons";
import { useTranslation } from "react-i18next";
import ApiError from "@components/ApiError";
import { getSnapshotHistory, getSnapshotHistoryDetail } from "./snapshotClient";
import SnapshotProgressBar from "./SnapshotProgressBar";
import {
  formatCount,
  formatDuration,
  formatSnapshotDate,
  formatSnapshotTime,
  isSnapshotActive,
  sortSnapshotTables,
  type PagedSnapshotHistoryResponse,
  type SnapshotHistoryResponse,
  type SnapshotHistoryTable,
  type SnapshotOutcome,
  type SnapshotProgressResponse,
  type SnapshotTable,
  type SnapshotType,
  type TableState,
} from "./snapshotModel";
import { useSnapshotElapsed, useOptionalSnapshotProgress } from "./useSnapshotProgress";
import "./snapshotProgress.css";

const HISTORY_PAGE_SIZE = 20;

type PipelineSnapshotsProps = {
  pipelineId: string;
  activeTabKey: string;
  progress?: SnapshotProgressResponse | null;
  isProgressLoading?: boolean;
  progressError?: string | null;
  onRetryProgress?: () => void;
};

const fullTypeKey = (type: SnapshotType | null): string =>
  type === "INCREMENTAL"
    ? "pipeline:snapshots.typeIncremental"
    : "pipeline:snapshots.typeInitial";

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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(HISTORY_PAGE_SIZE);
  const [historyReload, setHistoryReload] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, SnapshotHistoryResponse>>({});
  const [detailErrors, setDetailErrors] = useState<Record<number, string>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const detailsRef = useRef(details);
  detailsRef.current = details;

  useEffect(() => {
    setHistory(null);
    setHistoryError(null);
    setExpandedId(null);
    setDetails({});
    setDetailErrors({});
    setPage(1);
  }, [pipelineId]);

  useEffect(() => {
    if (activeTabKey !== "snapshots" || !pipelineId) {
      return;
    }
    if (isSnapshotActive(status)) {
      return;
    }
    if ((isProgressLoading || progressError) && !status) {
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);

    void getSnapshotHistory(pipelineId, page - 1, perPage).then((response) => {
      if (cancelled) {
        return;
      }
      setHistoryLoading(false);
      if (response.error || !response.data) {
        setHistory(null);
        setHistoryError(response.error ?? "Snapshot history is unavailable.");
        return;
      }
      setHistoryError(null);
      setHistory(response.data);
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeTabKey,
    pipelineId,
    status,
    page,
    perPage,
    historyReload,
    isProgressLoading,
    progressError,
  ]);

  useEffect(() => {
    if (expandedId == null || detailsRef.current[expandedId] || !pipelineId) {
      return;
    }

    let cancelled = false;
    setDetailLoadingId(expandedId);

    void getSnapshotHistoryDetail(pipelineId, expandedId).then((response) => {
      if (cancelled) {
        return;
      }
      setDetailLoadingId((current) => (current === expandedId ? null : current));
      if (response.error || !response.data) {
        setDetailErrors((current) => ({
          ...current,
          [expandedId]: response.error ?? "Snapshot history is unavailable.",
        }));
        return;
      }
      setDetails((current) => ({ ...current, [expandedId]: response.data as SnapshotHistoryResponse }));
    });

    return () => {
      cancelled = true;
    };
  }, [expandedId, pipelineId]);

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
    const duration = formatDuration(elapsedSeconds);
    const started = formatSnapshotTime(progress.startedAt, i18n.language);
    const globalProgress = progress.globalProgress;
    const summary = [
      t("pipeline:snapshots.statusLine", {
        status: isPaused
          ? t("pipeline:snapshots.paused")
          : t("pipeline:snapshots.running"),
      }),
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
          <CardTitle>{t("pipeline:snapshots.progressTitle")}</CardTitle>
        </CardHeader>
        <CardBody>
          <Flex
            alignItems={{ default: "alignItemsCenter" }}
            flexWrap={{ default: "nowrap" }}
            spaceItems={{ default: "spaceItemsMd" }}
          >
            <Content component="p" style={{ margin: 0, whiteSpace: "nowrap" }}>
              {t(fullTypeKey(progress.type))}
            </Content>
            <div className="snapshot-progress__bar">
              <SnapshotProgressBar
                percentage={globalProgress?.percentage ?? null}
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
          {totals.length > 0 && (
            <Content component="p" className="snapshot-progress__summary">
              {totals.join(" | ")}
            </Content>
          )}
          <Content component="h3">{t("pipeline:snapshots.tables")}</Content>
          <Table aria-label={t("pipeline:snapshots.activeTables")} variant="compact">
            <Thead>
              <Tr>
                <Th>{t("pipeline:snapshots.columnTable")}</Th>
                <Th>{t("pipeline:snapshots.columnStatus")}</Th>
                <Th>{t("pipeline:snapshots.columnProgress")}</Th>
                <Th>{t("pipeline:snapshots.columnRows")}</Th>
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
                  <Td dataLabel={t("pipeline:snapshots.columnRows")}>
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

  const items = history?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pipeline:snapshots.progressTitle")}</CardTitle>
      </CardHeader>
      <CardBody>
        <Content component="p">{t("pipeline:snapshots.noActive")}</Content>
        <Content component="h3">{t("pipeline:snapshots.history")}</Content>
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
        ) : items.length === 0 && !historyError ? (
          <Content component="p">{t("pipeline:snapshots.noHistory")}</Content>
        ) : (
          <>
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
                            {detailLoadingId === item.id && !detail ? (
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
            {history && history.totalElements > perPage && (
              <Pagination
                itemCount={history.totalElements}
                perPage={perPage}
                page={page}
                onSetPage={(_event, newPage) => {
                  setExpandedId(null);
                  setPage(newPage);
                }}
                onPerPageSelect={(_event, newPerPage) => {
                  setExpandedId(null);
                  setPerPage(newPerPage);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
};

export default PipelineSnapshots;
