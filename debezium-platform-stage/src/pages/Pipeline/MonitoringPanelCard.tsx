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
  ChartLine,
  ChartThemeColor,
  ChartVoronoiContainer,
  createContainer,
} from "@patternfly/react-charts/victory";
import {
  BanIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InProgressIcon,
  PauseCircleIcon,
} from "@patternfly/react-icons";
import { ComponentProps, FC, memo, ReactNode } from "react";
import type { PanelQueryResponse, PanelResponse } from "../../apis/types";
import {
  formatValueWithUnit,
  getCombinedLatestRate,
  getLatestValue,
  getPanelEmptyMessage,
  getChartYDomain,
  getSeriesLabel,
  formatChartTooltipValue,
  formatYAxisTick,
  getStatusValue,
  hasPanelData,
  hasPlottableMetricData,
  isStatusActive,
  panelSeriesEqual,
  transformToChartData,
} from "./monitoringUtils";

import {
  CONNECTION_STATUS_PANEL_ID,
  SNAPSHOT_STATUS_PANEL_IDS,
  SNAPSHOT_TABLE_PROGRESS_PANEL_ID,
  TALL_CHART_PANEL_IDS,
  CHART_HEIGHT_DEFAULT,
  CHART_HEIGHT_TALL,
  isStreamingStatusRowPanel,
} from "./panelConfig";

const CursorVoronoiContainer = createContainer('voronoi', 'cursor');

type MonitoringPanelCardProps = {
  panel: PanelResponse;
  data?: PanelQueryResponse;
  loading: boolean;
  error?: string;
  compact?: boolean;
  tallChart?: boolean;
  snapshotCompletedValue?: number | null;
  onRetry?: () => void;
};

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
}) => (
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
        {message && <EmptyStateBody>{message}</EmptyStateBody>}
      </EmptyState>
    </CardBody>
  </Card>
);

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

const SnapshotStatusLabel: FC<{ panelId: string; value: number | null }> = ({ panelId, value }) => {
  if (panelId === "snapshot-running") {
    return isStatusActive(value) ? (
      <Label color="blue" icon={<InProgressIcon />} isCompact>
        In Progress
      </Label>
    ) : (
      <Label color="grey" icon={<PauseCircleIcon />} isCompact>
        Idle
      </Label>
    );
  }

  if (panelId === "snapshot-completed") {
    return isStatusActive(value) ? (
      <Label color="green" icon={<CheckCircleIcon />} isCompact>
        Completed
      </Label>
    ) : (
      <Label color="grey" icon={<PauseCircleIcon />} isCompact>
        Not Completed
      </Label>
    );
  }

  if (panelId === "snapshot-aborted") {
    return isStatusActive(value) ? (
      <Label color="orange" icon={<BanIcon />} isCompact>
        Aborted
      </Label>
    ) : (
      <Label color="grey" icon={<PauseCircleIcon />} isCompact>
        Not Aborted
      </Label>
    );
  }

  return null;
};

const TimeSeriesChart: FC<{
  panel: PanelResponse;
  data: PanelQueryResponse;
  chartType: "area" | "line";
  tallChart?: boolean;
}> = ({ panel, data, chartType, tallChart = false }) => {
  const series = data.series;
  const isMultiSeries = series.length > 1;
  const useAreaChartLegend = chartType === "area" && isMultiSeries;
  const legendData = isMultiSeries
    ? series.map((s) => ({ name: getSeriesLabel(s.labels) }))
    : undefined;
  // const legendRightPadding = useAreaChartLegend
  //   ? Math.min(180, 90 + series.length * 28)
  //   : 16;
  const showCombinedRate =
    panel.id === "streaming-event-count" && panel.unit === "events/s";
  const chartHeight = tallChart || TALL_CHART_PANEL_IDS.has(panel.id)
    ? CHART_HEIGHT_TALL
    : CHART_HEIGHT_DEFAULT;
  const yDomain = getChartYDomain(data);

  const legendPosition = (
    useAreaChartLegend ? "top" : isMultiSeries ? "bottom" : undefined
  ) as ComponentProps<typeof Chart>["legendPosition"];

  const ChartSeries = chartType === "area" ? ChartArea : ChartLine;

  return (
    <Card isCompact isFullHeight className="monitoring-chart-card monitoring-panel-card">
      <CardTitle subtitle={panel.description}>{panel.title}</CardTitle>
      <CardBody>
        {showCombinedRate && (
          <div className="monitoring-chart-stat">
            <div className="monitoring-chart-stat__label">Combined Event Rate</div>
            <div>
              <span className="monitoring-chart-stat__value">
                {formatValueWithUnit(getCombinedLatestRate(data), panel.unit)}
              </span>
              <span className="monitoring-chart-stat__unit">{panel.unit}</span>
            </div>
          </div>
        )}

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
            ariaDesc={panel.description}
            ariaTitle={panel.title}
            containerComponent={
              chartType === "area" ? (
                <ChartVoronoiContainer
                  labels={({ datum }: { datum: { name: string; y: number } }) =>
                    `${datum.name}: ${formatChartTooltipValue(Number(datum.y))}`
                  }
                  constrainToVisibleArea
                />
              ) : (
                <CursorVoronoiContainer
                  cursorDimension="x"
                  labels={({ datum }: { datum: { x: string; y: number; name: string } }) =>
                    `${datum.name}: ${formatChartTooltipValue(Number(datum.y))}`
                  }
                  mouseFollowTooltips
                  voronoiDimension="x"
                  voronoiPadding={30}
                />
              )
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
            <ChartAxis dependentAxis showGrid style={{ tickLabels: { fontSize: 9 } }} tickFormat={formatYAxisTick} />
            {isMultiSeries ? (
              <ChartGroup>
                {series.map((s, idx) => (
                  <ChartSeries
                    key={idx}
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
        ariaDesc={panel.description}
        ariaTitle={panel.title}
        constrainToVisibleArea
        data={{ x: panel.title, y: percentage }}
        labels={({ datum }: { datum: { x: string; y: number } }) =>
          datum.x ? `${datum.y.toFixed(1)}%` : null
        }
        subTitle={inStatusRow || compact ? undefined : "utilization"}
        title={formatValueWithUnit(value, panel.unit)}
        thresholds={[
          { value: 60, color: "#3e8635" },
          { value: 80, color: "#f0ab00" },
          { value: 100, color: "#c9190b" },
        ]}
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
  data: PanelQueryResponse;
  compact?: boolean;
  snapshotCompletedValue?: number | null;
}> = ({ panel, data, compact, snapshotCompletedValue }) => {
  const remaining = getLatestValue(data) ?? 0;
  const isComplete = remaining === 0 || isStatusActive(snapshotCompletedValue);

  return (
    <CompactStatusRowCard panel={panel} compact={compact}>
      <FlexItem>
        {isComplete ? (
          <Label color="green" icon={<CheckCircleIcon />} isCompact>
            Complete
          </Label>
        ) : (
          <Label color="blue" icon={<InProgressIcon />} isCompact>
            In Progress
          </Label>
        )}
      </FlexItem>
      {!compact && (
        <FlexItem>
          <span className="monitoring-chart-stat__label">Remaining Tables</span>
        </FlexItem>
      )}
      <FlexItem>
        <Title headingLevel="h3" size={compact ? "lg" : "2xl"}>
          {remaining.toFixed(0)}
        </Title>
        {!compact && (
          <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
            {panel.unit}
          </span>
        )}
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
      <FlexItem>
        <Title headingLevel="h3" size={compact ? "lg" : "2xl"}>
          {value.toFixed(0)}
        </Title>
      </FlexItem>
    </CompactStatusRowCard>
  );
};

const SnapshotStatusPanel: FC<{
  panel: PanelResponse;
  data: PanelQueryResponse;
  compact?: boolean;
}> = ({ panel, data, compact }) => {
  const value = getStatusValue(data) ?? 0;

  return (
    <CompactStatusRowCard panel={panel} compact={compact}>
      <FlexItem>
        <SnapshotStatusLabel panelId={panel.id} value={value} />
      </FlexItem>
      <FlexItem>
        <Title headingLevel="h3" size={compact ? "lg" : "2xl"}>
          {value.toFixed(0)}
        </Title>
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
  snapshotCompletedValue,
  onRetry,
}) => {
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

  if (panel.id === SNAPSHOT_TABLE_PROGRESS_PANEL_ID) {
    return (
      <SnapshotTableProgress
        panel={panel}
        data={data!}
        compact={compact}
        snapshotCompletedValue={snapshotCompletedValue}
      />
    );
  }

  if (panel.id === CONNECTION_STATUS_PANEL_ID) {
    return <ConnectionStatusPanel panel={panel} data={data!} compact={compact} />;
  }

  if (SNAPSHOT_STATUS_PANEL_IDS.has(panel.id)) {
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
    prev.snapshotCompletedValue === next.snapshotCompletedValue &&
    panelSeriesEqual(prev.data, next.data)
);
