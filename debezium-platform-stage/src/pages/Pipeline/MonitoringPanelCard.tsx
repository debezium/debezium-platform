import {
  Card,
  CardBody,
  CardTitle,
  Flex,
  FlexItem,
  Label,
  Spinner,
  EmptyState,
  EmptyStateBody,
  Button,
  Title,
} from "@patternfly/react-core";
import {
  Chart,
  ChartArea,
  ChartAxis,
  ChartDonutUtilization,
  ChartGroup,
  ChartLabel,
  ChartLegendTooltip,
  ChartLine,
  ChartThemeColor,
  createContainer,
} from "@patternfly/react-charts/victory";
import chart_donut_label_subtitle_Fill from "@patternfly/react-tokens/dist/js/chart_donut_label_subtitle_Fill";
import chart_donut_label_title_Fill from "@patternfly/react-tokens/dist/js/chart_donut_label_title_Fill";
import chart_donut_threshold_danger_Color from "@patternfly/react-tokens/dist/js/chart_donut_threshold_danger_Color";
import chart_donut_threshold_first_Color from "@patternfly/react-tokens/dist/js/chart_donut_threshold_first_Color";
import chart_donut_threshold_warning_Color from "@patternfly/react-tokens/dist/js/chart_donut_threshold_warning_Color";
import chart_theme_green_ColorScale_100 from "@patternfly/react-tokens/dist/js/chart_theme_green_ColorScale_100";
import {
  BanIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InProgressIcon,
  OutlinedClockIcon,
  PauseCircleIcon,
} from "@patternfly/react-icons";
import { ComponentProps, FC, memo, ReactNode } from "react";
import { useData } from "../../appLayout/AppContext";
import type { PanelQueryResponse, PanelResponse } from "../../apis/types";
import {
  buildChartLegendTooltipData,
  computeSnapshotTableProgress,
  formatValueWithUnit,
  getActiveSnapshotStatus,
  getLatestValue,
  getPanelEmptyMessage,
  getChartYDomain,
  getSeriesChildName,
  getSeriesLabel,
  getYAxisTickFormat,
  getChartTooltipFormat,
  getStatusValue,
  hasPanelData,
  hasPlottableMetricData,
  isStatusActive,
  panelSeriesEqual,
  transformToChartData,
  type SnapshotStatus,
} from "./monitoringUtils";

import {
  CONNECTION_STATUS_PANEL_ID,
  SNAPSHOT_STATUS_PANEL_ID,
  SNAPSHOT_TABLE_PROGRESS_PANEL_ID,
  TALL_CHART_PANEL_IDS,
  CHART_HEIGHT_DEFAULT,
  CHART_HEIGHT_TALL,
  isStreamingStatusRowPanel,
} from "./panelConfig";

const CursorVoronoiContainer = createContainer("voronoi", "cursor");

type MonitoringPanelCardProps = {
  panel: PanelResponse;
  data?: PanelQueryResponse;
  loading: boolean;
  error?: string;
  compact?: boolean;
  tallChart?: boolean;
  snapshotTableCountData?: PanelQueryResponse;
  snapshotTableCountLoading?: boolean;
  snapshotTableCountError?: string;
  onRetry?: () => void;
};

/** Matches @patternfly/react-charts default utilization thresholds (warning → danger). */
const DONUT_UTILIZATION_THRESHOLDS = [
  { value: 60, color: chart_donut_threshold_warning_Color.var },
  { value: 90, color: chart_donut_threshold_danger_Color.var },
];

/** Green at 100% complete; warning for any progress below 100%. */
const getSnapshotTableProgressThresholds = (progressPercent: number) =>
  progressPercent >= 100
    ? [{ value: 100, color: chart_theme_green_ColorScale_100.var }]
    : [{ value: 0, color: chart_donut_threshold_warning_Color.var }];

/** Compact center labels for the small snapshot-table donut. */
const SNAPSHOT_DONUT_CENTER_LABEL = (
  <ChartLabel
    style={[
      {
        fill: chart_donut_label_title_Fill.var,
        fontSize: 13,
        fontWeight: 600,
      },
      {
        fill: chart_donut_label_subtitle_Fill.var,
        fontSize: 10,
      },
    ]}
  />
);

const cardClass = (compact?: boolean, extra?: string) =>
  [
    "monitoring-panel-card",
    compact ? "monitoring-compact-card" : undefined,
    extra,
  ]
    .filter(Boolean)
    .join(" ");

/** Shared compact card shell for status-row panels (streaming + snapshot). */
const CompactStatusRowCard: FC<{
  panel: PanelResponse;
  compact?: boolean;
  children: ReactNode;
}> = ({ panel, compact, children }) => (
  <Card isCompact={compact} isFullHeight isPlain className={cardClass(compact, "monitoring-status-row-card")}>
    <CardTitle subtitle={panel.description}>{panel.title}</CardTitle>
    <CardBody className={compact ? "monitoring-compact-card__body monitoring-status-row-card__body" : undefined}>
      <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsSm" }}>
        {children}
      </Flex>
    </CardBody>
  </Card>
);

const PanelLoading: FC<{ title: string; description?: string; compact?: boolean }> = ({
  title,
  description,
  compact,
}) => (
  <Card isCompact={compact} isFullHeight isPlain={compact} className={cardClass(compact)}>
    <CardTitle subtitle={description}>{title}</CardTitle>
    <CardBody className={compact ? "monitoring-compact-card__body" : undefined}>
      <Flex justifyContent={{ default: "justifyContentCenter" }} alignItems={{ default: "alignItemsCenter" }}>
        <Spinner size={compact ? "md" : "lg"} />
      </Flex>
    </CardBody>
  </Card>
);

const PanelError: FC<{
  title: string;
  description?: string;
  message: string;
  compact?: boolean;
  onRetry?: () => void;
}> = ({ title, description, message, compact, onRetry }) => (
  <Card isCompact={compact} isFullHeight isPlain={compact} className={cardClass(compact)}>
    <CardTitle subtitle={description}>{title}</CardTitle>
    <CardBody className={compact ? "monitoring-compact-card__body" : undefined}>
      <EmptyState variant="sm">
        <ExclamationCircleIcon
          style={{
            fontSize: compact ? "28px" : "48px",
            color: "var(--pf-v5-global--danger-color--100)",
            marginBottom: compact ? "8px" : "16px",
          }}
        />
        <Title headingLevel="h4" size={compact ? "md" : "lg"}>
          Unable to load data
        </Title>
        <EmptyStateBody>{message}</EmptyStateBody>
        {onRetry && (
          <Button variant="link" onClick={onRetry}>
            Retry
          </Button>
        )}
      </EmptyState>
    </CardBody>
  </Card>
);

const PanelEmpty: FC<{ title: string; description?: string; message: string; compact?: boolean }> = ({
  title,
  description,
  message,
  compact,
}) => {
  console.log("PanelEmpty", message);
  return (
  <Card
    isCompact={compact}
    isFullHeight
    isPlain={compact}
    className={cardClass(compact, compact ? "monitoring-compact-empty" : undefined)}
  >
          <CardTitle subtitle={description}>{title}</CardTitle>
    <CardBody className={compact ? "monitoring-compact-card__body" : undefined}>
      <EmptyState variant="sm">
        <PauseCircleIcon
          style={{
            fontSize: compact ? "28px" : "48px",
            color: "var(--pf-v5-global--Color--200)",
          }}
        />
        <Title headingLevel="h4" size={compact ? "md" : "lg"}>
          No data
        </Title>
        {/* {message && <EmptyStateBody>{message}</EmptyStateBody>} */}
      </EmptyState>
    </CardBody>
  </Card>
)
};

const ConnectionStatusLabel: FC<{ value: number | null }> = ({ value }) =>
  isStatusActive(value) ? (
    <Label color="green" icon={<CheckCircleIcon />} isCompact>
      Connected
    </Label>
  ) : (
    <Label color="red" icon={<ExclamationCircleIcon />} isCompact>
      Disconnected
    </Label>
  );

const ConsolidatedSnapshotStatusLabel: FC<{ status: SnapshotStatus | null }> = ({ status }) => {
  if (status === "completed") {
    return (
      <Label color="green" icon={<CheckCircleIcon />} isCompact>
        Completed
      </Label>
    );
  }

  if (status === "running") {
    return (
      <Label color="blue" icon={<InProgressIcon />} isCompact>
        In Progress
      </Label>
    );
  }

  if (status === "skipped") {
    return (
      <Label color="orange" icon={<OutlinedClockIcon />} isCompact>
        Skipped
      </Label>
    );
  }

  if (status === "aborted") {
    return (
      <Label color="red" icon={<BanIcon />} isCompact>
        Aborted
      </Label>
    );
  }

  return (
    <Label color="grey" icon={<PauseCircleIcon />} isCompact>
      Idle
    </Label>
  );
};

const TimeSeriesChart: FC<{
  panel: PanelResponse;
  data: PanelQueryResponse;
  chartType: "area" | "line";
  tallChart?: boolean;
}> = ({ panel, data, chartType, tallChart = false }) => {
  const { darkMode } = useData();
  const series = data.series;
  const isMultiSeries = series.length > 1;
  const useAreaChartLegend = chartType === "area" && isMultiSeries;
  const legendData = isMultiSeries
    ? series.map((s) => ({ name: getSeriesLabel(s.labels) }))
    : undefined;
  // const legendRightPadding = useAreaChartLegend
  //   ? Math.min(180, 90 + series.length * 28)
  //   : 16;
  // const showCombinedRate =
  //   panel.id === "streaming-event-count" && panel.unit === "events/s";
  const chartHeight = tallChart || TALL_CHART_PANEL_IDS.has(panel.id)
    ? CHART_HEIGHT_TALL
    : CHART_HEIGHT_DEFAULT;
  const yDomain = getChartYDomain(data);
  const yAxisTickFormat = getYAxisTickFormat(panel.id);
  const chartTooltipFormat = getChartTooltipFormat(panel.id);
  const tooltipLegendData = buildChartLegendTooltipData(series);

  const legendPosition = (
    useAreaChartLegend ? "top" : isMultiSeries ? "bottom" : undefined
  ) as ComponentProps<typeof Chart>["legendPosition"];

  const ChartSeries = chartType === "area" ? ChartArea : ChartLine;

  return (
    <Card isCompact isFullHeight className="monitoring-chart-card monitoring-panel-card">
      <CardTitle subtitle={panel.description}>{panel.title}</CardTitle>
      <CardBody>
        {/* {showCombinedRate && (
          <div className="monitoring-chart-stat">
            <div className="monitoring-chart-stat__label">Combined Event Rate</div>
            <div>
              <span className="monitoring-chart-stat__value">
                {formatValueWithUnit(getCombinedLatestRate(data), panel.unit)}
              </span>
              <span className="monitoring-chart-stat__unit">{panel.unit}</span>
            </div>
          </div>
        )} */}

        <div
          className={[
            "monitoring-chart-container",
            chartHeight > CHART_HEIGHT_DEFAULT ? "monitoring-chart-container--tall" : undefined,
            useAreaChartLegend ? "monitoring-chart-container--legend-right" : undefined,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <Chart
            key={darkMode ? "dark" : "light"}
            ariaDesc={panel.description}
            ariaTitle={panel.title}
            containerComponent={
              <CursorVoronoiContainer
                constrainToVisibleArea
                cursorDimension="x"
                labels={({ datum }: { datum: { y: number } }) => {
                  const value = Number(datum.y);
                  return Number.isFinite(value) ? chartTooltipFormat(value) : null;
                }}
                labelComponent={
                  <ChartLegendTooltip
                    legendData={tooltipLegendData}
                    title={(datum) => String(datum.x ?? "")}
                  />
                }
                mouseFollowTooltips
                voronoiDimension="x"
                voronoiPadding={30}
              />
            }
            height={chartHeight}
            legendData={legendData}
            legendOrientation={useAreaChartLegend ? "horizontal" : isMultiSeries ? "horizontal" : undefined}
            legendPosition={legendPosition}
            maxDomain={{ y: yDomain.max }}
            minDomain={{ y: yDomain.min }}
            padding={
              useAreaChartLegend
                ? { bottom: 30, left: 50, right: 20, top: 40 }
                : {
                    bottom: isMultiSeries ? 75 : 40,
                    left: 50,
                    right: 16,
                    top: 4,
                  }
            }
            themeColor={ChartThemeColor.multiOrdered}
          >
            <ChartAxis
              style={{
                tickLabels: { angle: -35, textAnchor: "end", fontSize: 9 },
              }}
              fixLabelOverlap
            />
            <ChartAxis dependentAxis showGrid style={{ tickLabels: { fontSize: 9 } }} tickFormat={yAxisTickFormat} />
            {isMultiSeries ? (
              <ChartGroup>
                {series.map((s, idx) => (
                  <ChartSeries
                    key={idx}
                    name={getSeriesChildName(idx)}
                    data={transformToChartData([s])}
                    interpolation={chartType === "area" ? "monotoneX" : undefined}
                    style={
                      chartType === "area"
                        ? { data: { fillOpacity: 0.25, strokeWidth: 1.5 } }
                        : { data: { strokeWidth: 1.5 } }
                    }
                  />
                ))}
              </ChartGroup>
            ) : (
              series.map((s, idx) => (
                <ChartSeries
                  key={idx}
                  name={getSeriesChildName(idx)}
                  data={transformToChartData([s])}
                  interpolation={chartType === "area" ? "monotoneX" : undefined}
                />
              ))
            )}
          </Chart>
        </div>
      </CardBody>
    </Card>
  );
};

const DonutGauge: FC<{ panel: PanelResponse; data: PanelQueryResponse; compact?: boolean }> = ({
  panel,
  data,
  compact,
}) => {
  const { darkMode } = useData();
  const value = getLatestValue(data) ?? 0;
  const percentage = Math.max(0, Math.min(100, value));
  const inStatusRow = compact && isStreamingStatusRowPanel(panel.id);
  const size = inStatusRow
    ? { height: 100, width: 120 }
    : compact
      ? { height: 110, width: 150 }
      : { height: 180, width: 240 };

  const donut = (
    <div className="monitoring-donut-compact">
      <ChartDonutUtilization
        key={darkMode ? "dark" : "light"}
        ariaDesc={panel.description}
        ariaTitle={panel.title}
        constrainToVisibleArea
        data={{ x: panel.title, y: percentage }}
        labels={({ datum }: { datum: { x: string; y: number } }) =>
          datum.x ? `${datum.y.toFixed(1)}%` : null
        }
        subTitle={inStatusRow || compact ? undefined : "utilization"}
        title={formatValueWithUnit(value, panel.unit)}
        thresholds={DONUT_UTILIZATION_THRESHOLDS}
        {...size}
        padding={{ bottom: 12, left: 12, right: 12, top: 12 }}
      />
    </div>
  );

  if (inStatusRow) {
    return (
      <CompactStatusRowCard panel={panel} compact={compact}>
        <FlexItem>{donut}</FlexItem>
      </CompactStatusRowCard>
    );
  }

  return (
    <Card isCompact={compact} isFullHeight className={cardClass(compact)}>
      <CardTitle subtitle={panel.description}>{panel.title}</CardTitle>
      <CardBody className={compact ? "monitoring-compact-card__body" : undefined}>
        {donut}
      </CardBody>
    </Card>
  );
};

const SnapshotTableProgress: FC<{
  panel: PanelResponse;
  progressData: PanelQueryResponse;
  countData: PanelQueryResponse;
  compact?: boolean;
}> = ({ panel, progressData, countData, compact }) => {
  const { darkMode } = useData();
  const { total, remaining, completed, progressPercent } = computeSnapshotTableProgress(
    getLatestValue(countData),
    getLatestValue(progressData)
  );
  const progressLabel = `${Math.round(progressPercent)}%`;
  const progressSliceColor =
    progressPercent >= 100
      ? chart_theme_green_ColorScale_100.var
      : chart_donut_threshold_warning_Color.var;

  return (
    <CompactStatusRowCard panel={panel} compact={compact}>
      <FlexItem className="monitoring-snapshot-table-donut">
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          justifyContent={{ default: "justifyContentCenter" }}
          spaceItems={{ default: "spaceItemsMd" }}
        >
          <ChartDonutUtilization
            key={darkMode ? "dark" : "light"}
            ariaDesc={panel.description}
            ariaTitle={panel.title}
            constrainToVisibleArea
            data={{ x: "Tables captured", y: progressPercent }}
            labels={({ datum }: { datum: { x: string; y: number } }) =>
              datum.x ? `${Math.round(datum.y)}%` : null
            }
            subTitle={`of ${total}`}
            subTitlePosition="center"
            title={progressLabel}
            titleComponent={SNAPSHOT_DONUT_CENTER_LABEL}
            thresholds={getSnapshotTableProgressThresholds(progressPercent)}
            height={96}
            width={96}
            padding={{ bottom: 2, left: 2, right: 2, top: 2 }}
          />
          <Flex
            direction={{ default: "column" }}
            spaceItems={{ default: "spaceItemsSm" }}
            className="monitoring-snapshot-table-legend"
          >
         
            <Flex alignItems={{ default: "alignItemsCenter" }} spaceItems={{ default: "spaceItemsSm" }}>
              <span
                className="monitoring-snapshot-table-legend__swatch"
                style={{ backgroundColor: chart_donut_threshold_first_Color.var }}
              />
              <span>{`In progress: ${remaining}`}</span>
            </Flex>
            <Flex alignItems={{ default: "alignItemsCenter" }} spaceItems={{ default: "spaceItemsSm" }}>
              <span
                className="monitoring-snapshot-table-legend__swatch"
                style={{ backgroundColor: progressSliceColor }}
              />
              <span>{`Completed: ${completed}`}</span>
            </Flex>
          </Flex>
        </Flex>
      </FlexItem>
    </CompactStatusRowCard>
  );
};

const ConnectionStatusPanel: FC<{
  panel: PanelResponse;
  data: PanelQueryResponse;
  compact?: boolean;
}> = ({ panel, data, compact }) => {
  const value = getStatusValue(data) ?? 0;

  return (
    <CompactStatusRowCard panel={panel} compact={compact}>
      <FlexItem>
        <ConnectionStatusLabel value={value} />
      </FlexItem>
      {/* <FlexItem>
        <Title headingLevel="h3" size={compact ? "lg" : "2xl"}>
          {value.toFixed(0)}
        </Title>
      </FlexItem> */}
    </CompactStatusRowCard>
  );
};

const SnapshotStatusPanel: FC<{
  panel: PanelResponse;
  data: PanelQueryResponse;
  compact?: boolean;
}> = ({ panel, data, compact }) => {
  const status = getActiveSnapshotStatus(data);

  return (
    <CompactStatusRowCard panel={panel} compact={compact}>
      <FlexItem>
        <ConsolidatedSnapshotStatusLabel status={status} />
      </FlexItem>
    </CompactStatusRowCard>
  );
};

const MonitoringPanelCardComponent: FC<MonitoringPanelCardProps> = ({
  panel,
  data,
  loading,
  error,
  compact = false,
  tallChart = false,
  snapshotTableCountData,
  snapshotTableCountLoading = false,
  snapshotTableCountError,
  onRetry,
}) => {
  if (panel.id === SNAPSHOT_TABLE_PROGRESS_PANEL_ID) {
    if ((loading && !data) || snapshotTableCountLoading) {
      return (
        <PanelLoading title={panel.title} description={panel.description} compact={compact} />
      );
    }

    if (error) {
      return (
        <PanelError
          title={panel.title}
          description={panel.description}
          message={error}
          compact={compact}
          onRetry={onRetry}
        />
      );
    }

    if (snapshotTableCountError) {
      return (
        <PanelError
          title={panel.title}
          description={panel.description}
          message={snapshotTableCountError}
          compact={compact}
          onRetry={onRetry}
        />
      );
    }

    if (!hasPanelData(data) || !hasPlottableMetricData(data)) {
      return (
        <PanelEmpty
          title={panel.title}
          description={panel.description}
          message={getPanelEmptyMessage(panel.id)}
          compact={compact}
        />
      );
    }

    if (!hasPanelData(snapshotTableCountData) || !hasPlottableMetricData(snapshotTableCountData)) {
      return (
        <PanelEmpty
          title={panel.title}
          description={panel.description}
          message={getPanelEmptyMessage(panel.id)}
          compact={compact}
        />
      );
    }

    return (
      <SnapshotTableProgress
        panel={panel}
        progressData={data!}
        countData={snapshotTableCountData!}
        compact={compact}
      />
    );
  }

  if (loading && !data) {
    return (
      <PanelLoading title={panel.title} description={panel.description} compact={compact} />
    );
  }

  if (error) {
    return (
      <PanelError
        title={panel.title}
        description={panel.description}
        message={error}
        compact={compact}
        onRetry={onRetry}
      />
    );
  }

  if (!hasPanelData(data) || !hasPlottableMetricData(data)) {
    return (
      <PanelEmpty
        title={panel.title}
        description={panel.description}
        message={getPanelEmptyMessage(panel.id)}
        compact={compact}
      />
    );
  }

  if (panel.id === CONNECTION_STATUS_PANEL_ID) {
    return <ConnectionStatusPanel panel={panel} data={data!} compact={compact} />;
  }

  if (panel.id === SNAPSHOT_STATUS_PANEL_ID) {
    return <SnapshotStatusPanel panel={panel} data={data!} compact={compact} />;
  }

  if (panel.visualization.type === "donut-utilization") {
    return <DonutGauge panel={panel} data={data!} compact={compact} />;
  }

  if (panel.visualization.type === "area" || panel.visualization.type === "line") {
    return (
      <TimeSeriesChart
        panel={panel}
        data={data!}
        chartType={panel.visualization.type}
        tallChart={tallChart}
      />
    );
  }

  return (
    <PanelEmpty
      title={panel.title}
      description={panel.description}
      message="Unsupported visualization type"
      compact={compact}
    />
  );
};

export const MonitoringPanelCard = memo(
  MonitoringPanelCardComponent,
  (prev, next) =>
    prev.panel.id === next.panel.id &&
    prev.compact === next.compact &&
    prev.tallChart === next.tallChart &&
    prev.loading === next.loading &&
    prev.error === next.error &&
    prev.snapshotTableCountLoading === next.snapshotTableCountLoading &&
    prev.snapshotTableCountError === next.snapshotTableCountError &&
    panelSeriesEqual(prev.data, next.data) &&
    panelSeriesEqual(prev.snapshotTableCountData, next.snapshotTableCountData)
);
