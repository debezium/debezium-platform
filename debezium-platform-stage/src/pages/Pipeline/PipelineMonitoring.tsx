import {
  Card,
  CardBody,
  CardTitle,
  Grid,
  GridItem,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  MenuToggleElement,
  Label,
  Flex,
  FlexItem,
  Divider,
  ToolbarGroup,
  TextInput,
} from "@patternfly/react-core";
import {
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
} from "@patternfly/react-table";
import {
  Chart,
  ChartArea,
  ChartLine,
  ChartAxis,
  ChartVoronoiContainer,
  ChartThemeColor,
  ChartDonutUtilization,
  ChartDonut,
  ChartThreshold,
  ChartGroup,
  ChartLegendTooltip,
  createContainer,
} from "@patternfly/react-charts/victory";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PauseCircleIcon,
  BanIcon,
  InProgressIcon,
  OutlinedClockIcon,
  RedoIcon,
} from "@patternfly/react-icons";
import { FC, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./PipelineOverview.css";

type PipelineMonitoringProp = {
  pipelineId: string;
};

// Static data for healthy pipeline streaming
const STATIC_DATA = {
  // Time since last event (health indicator)
  timeSinceLastEvent: {
    milliseconds: 1250,
    threshold: 5000, // Alert if > 5 seconds
  },

  // Replication lag (performance indicator)
  replicationLag: {
    currentMs: 125,
    healthyThreshold: 200, // Green < 200ms, Yellow 200-500ms, Red > 500ms
    warningThreshold: 500,
  },

  // Connection status
  connection: {
    connected: 1, // 1 = connected, 0 = disconnected
  },

  // Event throughput
  eventRate: {
    current: 42.5, // Events per second
  },

  // Total events counter
  totalEvents: {
    count: 24050,
  },

  // Event count over time (multi-line: total + skipped)
  eventCount: {
    totalEvents: [
      { x: "10:00", y: 12450 },
      { x: "10:00:15", y: 13020 },
      { x: "10:00:30", y: 13610 },
      { x: "10:00:45", y: 14180 },
      { x: "10:01", y: 14770 },
      { x: "10:01:15", y: 15340 },
      { x: "10:01:30", y: 15930 },
      { x: "10:01:45", y: 16500 },
      { x: "10:02", y: 17090 },
      { x: "10:02:15", y: 17660 },
      { x: "10:02:30", y: 18250 },
      { x: "10:02:45", y: 18820 },
      { x: "10:03", y: 19410 },
      { x: "10:03:15", y: 19980 },
      { x: "10:03:30", y: 20570 },
      { x: "10:03:45", y: 21140 },
      { x: "10:04", y: 21730 },
      { x: "10:04:15", y: 22300 },
      { x: "10:04:30", y: 22890 },
      { x: "10:04:45", y: 23460 },
      { x: "10:05", y: 24050 },
    ],
    eventsSkipped: [
      { x: "10:00", y: 12 },
      { x: "10:00:15", y: 15 },
      { x: "10:00:30", y: 18 },
      { x: "10:00:45", y: 20 },
      { x: "10:01", y: 22 },
      { x: "10:01:15", y: 25 },
      { x: "10:01:30", y: 28 },
      { x: "10:01:45", y: 30 },
      { x: "10:02", y: 33 },
      { x: "10:02:15", y: 35 },
      { x: "10:02:30", y: 38 },
      { x: "10:02:45", y: 40 },
      { x: "10:03", y: 42 },
      { x: "10:03:15", y: 45 },
      { x: "10:03:30", y: 47 },
      { x: "10:03:45", y: 50 },
      { x: "10:04", y: 52 },
      { x: "10:04:15", y: 55 },
      { x: "10:04:30", y: 57 },
      { x: "10:04:45", y: 60 },
      { x: "10:05", y: 62 },
    ],
  },

  // Events filtered per second
  eventsFiltered: {
    datapoints: [
      { x: "10:00", y: 38.5 },
      { x: "10:00:15", y: 42.3 },
      { x: "10:00:30", y: 39.7 },
      { x: "10:00:45", y: 45.2 },
      { x: "10:01", y: 41.8 },
      { x: "10:01:15", y: 37.6 },
      { x: "10:01:30", y: 43.9 },
      { x: "10:01:45", y: 40.1 },
      { x: "10:02", y: 44.7 },
      { x: "10:02:15", y: 38.9 },
      { x: "10:02:30", y: 42.5 },
      { x: "10:02:45", y: 39.3 },
      { x: "10:03", y: 46.1 },
      { x: "10:03:15", y: 41.2 },
      { x: "10:03:30", y: 37.8 },
      { x: "10:03:45", y: 44.4 },
      { x: "10:04", y: 40.6 },
      { x: "10:04:15", y: 43.2 },
      { x: "10:04:30", y: 39.1 },
      { x: "10:04:45", y: 45.8 },
      { x: "10:05", y: 42.0 },
    ],
  },

  // Replication lag detail (for bottom chart)
  replicationLagDetail: {
    datapoints: [
      { x: "10:00", y: 125 },
      { x: "10:00:15", y: 98 },
      { x: "10:00:30", y: 156 },
      { x: "10:00:45", y: 112 },
      { x: "10:01", y: 87 },
      { x: "10:01:15", y: 143 },
      { x: "10:01:30", y: 109 },
      { x: "10:01:45", y: 94 },
      { x: "10:02", y: 167 },
      { x: "10:02:15", y: 121 },
      { x: "10:02:30", y: 103 },
      { x: "10:02:45", y: 138 },
      { x: "10:03", y: 115 },
      { x: "10:03:15", y: 91 },
      { x: "10:03:30", y: 152 },
      { x: "10:03:45", y: 107 },
      { x: "10:04", y: 96 },
      { x: "10:04:15", y: 134 },
      { x: "10:04:30", y: 118 },
      { x: "10:04:45", y: 89 },
      { x: "10:05", y: 145 },
    ],
  },

  // SNAPSHOT METRICS DATA
  snapshot: {
    totalTables: 12,
    remainingTables: 0,
    snapshotRunning: 0, // 0 = not running
    snapshotCompleted: 1, // 1 = completed
    snapshotAborted: 0, // 0 = not aborted
    rowsScanned: [
      { tableName: "customers", rowsScanned: 15234 },
      { tableName: "orders", rowsScanned: 42891 },
      { tableName: "products", rowsScanned: 8456 },
      { tableName: "order_items", rowsScanned: 128765 },
      { tableName: "categories", rowsScanned: 124 },
      { tableName: "suppliers", rowsScanned: 2341 },
      { tableName: "inventory", rowsScanned: 34567 },
      { tableName: "shipments", rowsScanned: 18923 },
      { tableName: "payments", rowsScanned: 45678 },
      { tableName: "reviews", rowsScanned: 67234 },
      { tableName: "users", rowsScanned: 9876 },
      { tableName: "addresses", rowsScanned: 12345 },
    ],
  },
};

const CursorVoronoiContainer = createContainer("cursor", "voronoi");

const PipelineMonitoring: FC<PipelineMonitoringProp> = () => {
  useTranslation();

  // Time range state
  const [isTimeRangeOpen, setIsTimeRangeOpen] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState("Last 5 minutes");
  const [fromDateTime, setFromDateTime] = useState("2026-06-12T10:00");
  const [toDateTime, setToDateTime] = useState("2026-06-12T10:05");

  // Refresh frequency state
  const [isRefreshOpen, setIsRefreshOpen] = useState(false);
  const [selectedRefresh, setSelectedRefresh] = useState("15 seconds");

  // Reduce event buffer size for charts to improve performance
  useEffect(() => {
    const originalSize = window.EVENT_BUFFER_SIZE;
    window.EVENT_BUFFER_SIZE = 100;
    return () => {
      window.EVENT_BUFFER_SIZE = originalSize;
    };
  }, []);

  const timeRangeOptions = [
    "Last 5 minutes",
    "Last 15 minutes",
    "Last 30 minutes",
    "Last 1 hour",
    "Last 3 hours",
    "Last 6 hours",
    "Last 12 hours",
    "Last 24 hours",
    "Custom",
  ];

  const refreshOptions = [
    "Off",
    "5 seconds",
    "10 seconds",
    "15 seconds",
    "30 seconds",
    "1 minute",
    "5 minutes",
  ];

  const onTimeRangeToggle = () => {
    setIsTimeRangeOpen(!isTimeRangeOpen);
  };

  const onTimeRangeSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    setSelectedTimeRange(value as string);
    setIsTimeRangeOpen(false);
  };

  const onRefreshToggle = () => {
    setIsRefreshOpen(!isRefreshOpen);
  };

  const onRefreshSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    setSelectedRefresh(value as string);
    setIsRefreshOpen(false);
  };

  // Calculate health percentage for Time Since Last Event
  // Inverse: lower ms = healthier (100% healthy at 0ms, 0% healthy at threshold)
  const timeSinceEventPercentage = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ((STATIC_DATA.timeSinceLastEvent.threshold -
          STATIC_DATA.timeSinceLastEvent.milliseconds) /
          STATIC_DATA.timeSinceLastEvent.threshold) *
          100
      )
    )
  );

  // Calculate health percentage for Replication Lag
  // Green zone: < 200ms = 100-60%, Yellow: 200-500ms = 60-20%, Red: > 500ms = <20%
  const lagPercentage = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ((STATIC_DATA.replicationLag.warningThreshold -
          STATIC_DATA.replicationLag.currentMs) /
          STATIC_DATA.replicationLag.warningThreshold) *
          100
      )
    )
  );

  return (
    <Grid hasGutter>
      {/* PAGE-LEVEL HEADER with Time Range and Refresh Frequency */}
      <GridItem span={12}>
        <Toolbar style={{ paddingLeft: 0, paddingRight: 0 }}>
          <ToolbarContent>
              <ToolbarGroup align={{ default: 'alignStart' }}><ToolbarItem>
              <Title headingLevel="h1">Pipeline Monitoring</Title>
            </ToolbarItem>
            </ToolbarGroup>
      <ToolbarGroup align={{ default: "alignEnd" }}>
            <ToolbarItem>
              <Select
                id="time-range-select"
                isOpen={isTimeRangeOpen}
                selected={selectedTimeRange}
                onSelect={onTimeRangeSelect}
                onOpenChange={(isOpen) => setIsTimeRangeOpen(isOpen)}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={onTimeRangeToggle}
                    isExpanded={isTimeRangeOpen}
                    icon={<OutlinedClockIcon />}
                  >
                    {selectedTimeRange}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {timeRangeOptions.map((option, index) => (
                    <SelectOption key={index} value={option}>
                      {option}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </ToolbarItem>
            {selectedTimeRange === "Custom" && (
              <>
                <ToolbarItem>
                  <TextInput
                    id="time-range-from"
                    type="datetime-local"
                    aria-label="Monitoring from date and time"
                    value={fromDateTime}
                    onChange={(_event, value) => setFromDateTime(value)}
                  />
                </ToolbarItem>
                <ToolbarItem>
                  <TextInput
                    id="time-range-to"
                    type="datetime-local"
                    aria-label="Monitoring to date and time"
                    value={toDateTime}
                    onChange={(_event, value) => setToDateTime(value)}
                  />
                </ToolbarItem>
              </>
            )}
            <ToolbarItem>
              <Select
                id="refresh-frequency-select"
                isOpen={isRefreshOpen}
                selected={selectedRefresh}
                onSelect={onRefreshSelect}
                onOpenChange={(isOpen) => setIsRefreshOpen(isOpen)}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={onRefreshToggle}
                    isExpanded={isRefreshOpen}
                    icon={<RedoIcon/>}
                  >
                    {selectedRefresh}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {refreshOptions.map((option, index) => (
                    <SelectOption key={index} value={option}>
                      {option}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </ToolbarItem></ToolbarGroup>
            
            
          </ToolbarContent>
        </Toolbar>
      </GridItem>

      {/* STREAMING METRICS SECTION */}
      <GridItem span={12}>
        <Title headingLevel="h2" style={{ marginTop: "8px", marginBottom: "16px" }}>
          Streaming Metrics
        </Title>
      </GridItem>

      {/* TOP ROW: 3 Cards - 2 Donuts + Stats Panel */}

      {/* Card 1: Time Since Last Event - Donut */}
      <GridItem md={12} lg={4}>
        <Card ouiaId="TimeSinceLastEventCard" isFullHeight>
          <CardTitle>Time Since Last Event</CardTitle>
          <CardBody>
            <Flex
              justifyContent={{ default: "justifyContentCenter" }}
              alignItems={{ default: "alignItemsCenter" }}
            >
              <ChartDonutUtilization
                ariaDesc="Time since last event processed"
                ariaTitle="Time since last event"
                constrainToVisibleArea
                data={{
                  x: "Last Event",
                  y: timeSinceEventPercentage,
                }}
                labels={({ datum }: { datum: { x: string; y: number } }) =>
                  datum.x ? `${datum.x}: ${datum.y}%` : null
                }
                subTitle="ago"
                title={`${(STATIC_DATA.timeSinceLastEvent.milliseconds / 1000).toFixed(1)}s`}
                thresholds={[
                  { value: 60, color: "#3e8635" }, // Green: healthy
                  { value: 80, color: "#f0ab00" }, // Yellow: warning
                  { value: 100, color: "#c9190b" }, // Red: critical
                ]}
                height={230}
                width={350}
                padding={{
                  bottom: 20,
                  left: 20,
                  right: 20,
                  top: 20,
                }}
              />
            </Flex>
          </CardBody>
        </Card>
      </GridItem>

      {/* Card 2: Replication Lag - Donut */}
      <GridItem md={12} lg={4}>
        <Card ouiaId="ReplicationLagDonutCard" isFullHeight>
          <CardTitle>Replication Lag</CardTitle>
          <CardBody>
            <Flex
              justifyContent={{ default: "justifyContentCenter" }}
              alignItems={{ default: "alignItemsCenter" }}
            >
              <ChartDonutUtilization
                ariaDesc="Current replication lag"
                ariaTitle="Replication lag"
                constrainToVisibleArea
                data={{
                  x: "Lag",
                  y: lagPercentage,
                }}
                labels={({ datum }: { datum: { x: string; y: number } }) =>
                  datum.x ? `${datum.x}: ${datum.y}%` : null
                }
                subTitle="latency"
                title={`${STATIC_DATA.replicationLag.currentMs}ms`}
                thresholds={[
                  { value: 60, color: "#3e8635" }, // Green: < 200ms
                  { value: 80, color: "#f0ab00" }, // Yellow: 200-400ms
                  { value: 100, color: "#c9190b" }, // Red: > 400ms
                ]}
                height={230}
                width={350}
                padding={{
                  bottom: 20,
                  left: 20,
                  right: 20,
                  top: 20,
                }}
              />
            </Flex>
          </CardBody>
        </Card>
      </GridItem>

      {/* Card 3: Connection + Stats Panel */}
      <GridItem md={12} lg={4}>
        <Card ouiaId="ConnectionStatsCard" isFullHeight>
          <CardTitle>Status & Metrics</CardTitle>
          <CardBody>
            <Flex
              direction={{ default: "column" }}
              spaceItems={{ default: "spaceItemsMd" }}
            >
              {/* Connection Status */}
              <FlexItem>
                <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsXs" }}>
                  <FlexItem>
                    <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
                      Connection
                    </span>
                  </FlexItem>
                  <FlexItem>
                    {STATIC_DATA.connection.connected === 1 ? (
                      <Label color="green" icon={<CheckCircleIcon />} isCompact>
                        Connected
                      </Label>
                    ) : (
                      <Label color="red" icon={<ExclamationCircleIcon />} isCompact>
                        Disconnected
                      </Label>
                    )}
                  </FlexItem>
                </Flex>
              </FlexItem>

              <Divider />

              {/* Event Throughput */}
              <FlexItem>
                <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsXs" }}>
                  <FlexItem>
                    <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
                      Event Throughput
                    </span>
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h2" size="2xl">
                      {STATIC_DATA.eventRate.current}
                    </Title>
                    <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
                      events/sec
                    </span>
                  </FlexItem>
                </Flex>
              </FlexItem>

              <Divider />

              {/* Total Events */}
              <FlexItem>
                <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsXs" }}>
                  <FlexItem>
                    <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
                      Total Events
                    </span>
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h2" size="2xl">
                      {STATIC_DATA.totalEvents.count.toLocaleString()}
                    </Title>
                    <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
                      processed
                    </span>
                  </FlexItem>
                </Flex>
              </FlexItem>
            </Flex>
          </CardBody>
        </Card>
      </GridItem>

      {/* MIDDLE ROW: Event Count Over Time - Full Width Multi-Line Chart */}
      <GridItem span={12}>
        <Card ouiaId="EventCountCard" isCompact>
          <CardTitle>Event Count Over Time</CardTitle>
          <CardBody style={{ paddingTop: 0 }}>
            {/* Custom compact legend */}
            <Flex spaceItems={{ default: "spaceItemsMd" }} style={{ marginBottom: "10px" }}>
              <FlexItem>
                <Flex alignItems={{ default: "alignItemsCenter" }} spaceItems={{ default: "spaceItemsSm" }}>
                  <FlexItem>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        backgroundColor: "#0066CC",
                        borderRadius: "2px",
                      }}
                    />
                  </FlexItem>
                  <FlexItem>
                    <span style={{ fontSize: "14px" }}>Total Events</span>
                  </FlexItem>
                </Flex>
              </FlexItem>
              <FlexItem>
                <Flex alignItems={{ default: "alignItemsCenter" }} spaceItems={{ default: "spaceItemsSm" }}>
                  <FlexItem>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        backgroundColor: "#F0AB00",
                        borderRadius: "2px",
                      }}
                    />
                  </FlexItem>
                  <FlexItem>
                    <span style={{ fontSize: "14px" }}>Events Skipped</span>
                  </FlexItem>
                </Flex>
              </FlexItem>
            </Flex>

            <Chart
              ariaDesc="Total events and events skipped over time"
              ariaTitle="Event Count"
              containerComponent={
                <CursorVoronoiContainer
                  cursorDimension="x"
                  labels={({ datum }: { datum: { x: string; y: number; name: string } }) =>
                    `${datum.name}: ${datum.y.toLocaleString()}`
                  }
                  mouseFollowTooltips
                  voronoiDimension="x"
                  voronoiPadding={50}
                  labelComponent={
                    <ChartLegendTooltip
                      legendData={[
                        { name: "Total Events", symbol: { fill: "#0066CC" } },
                        { name: "Events Skipped", symbol: { fill: "#F0AB00" } },
                      ]}
                    />
                  }
                />
              }
              height={180}
              padding={{
                bottom: 40,
                left: 70,
                right: 40,
                top: 10,
              }}
              themeColor={ChartThemeColor.multiOrdered}
            >
              <ChartAxis
                style={{
                  tickLabels: { angle: -45, textAnchor: "end", fontSize: 10 },
                }}
                fixLabelOverlap
              />
              <ChartAxis dependentAxis showGrid />
              <ChartGroup>
                <ChartArea
                  data={STATIC_DATA.eventCount.totalEvents.map((d) => ({
                    ...d,
                    name: "Total Events",
                  }))}
                  style={{
                    data: {
                      fill: "#0066CC",
                      fillOpacity: 0.3,
                      stroke: "#0066CC",
                      strokeWidth: 2,
                    },
                  }}
                />
                <ChartLine
                  data={STATIC_DATA.eventCount.eventsSkipped.map((d) => ({
                    ...d,
                    name: "Events Skipped",
                  }))}
                  style={{
                    data: {
                      stroke: "#F0AB00",
                      strokeWidth: 2,
                    },
                  }}
                />
              </ChartGroup>
            </Chart>
          </CardBody>
        </Card>
      </GridItem>

      {/* BOTTOM ROW: 2 Detail Charts - Events Filtered + Replication Lag Detail */}

      {/* Events Filtered per Second - Line Chart */}
      <GridItem md={12} lg={6}>
        <Card ouiaId="EventsFilteredCard" isFullHeight>
          <CardTitle>Events Filtered per Second</CardTitle>
          <CardBody>
            <Chart
              ariaDesc="Events filtered by transformations per second"
              ariaTitle="Event Filtering Rate"
              containerComponent={
                <ChartVoronoiContainer
                  labels={({ datum }: { datum: { x: string; y: number } }) =>
                    `${datum.x}: ${datum.y} events/s`
                  }
                  constrainToVisibleArea
                />
              }
              height={250}
              padding={{
                bottom: 50,
                left: 60,
                right: 20,
                top: 20,
              }}
              themeColor={ChartThemeColor.green}
            >
              <ChartAxis
                style={{
                  tickLabels: { angle: -45, textAnchor: "end", fontSize: 10 },
                }}
                fixLabelOverlap
              />
              <ChartAxis dependentAxis showGrid label="Events/sec" />
              <ChartLine data={STATIC_DATA.eventsFiltered.datapoints} />
            </Chart>
          </CardBody>
        </Card>
      </GridItem>

      {/* Replication Lag Detail - Threshold Area Chart */}
      <GridItem md={12} lg={6}>
        <Card ouiaId="ReplicationLagDetailCard" isFullHeight>
          <CardTitle>Replication Lag Detail</CardTitle>
          <CardBody>
            <Chart
              ariaDesc="Replication lag trend in milliseconds"
              ariaTitle="Replication Lag Trend"
              containerComponent={
                <ChartVoronoiContainer
                  labels={({ datum }: { datum: { x: string; y: number } }) =>
                    `${datum.x}: ${datum.y}ms`
                  }
                  constrainToVisibleArea
                />
              }
              height={250}
              padding={{
                bottom: 50,
                left: 60,
                right: 20,
                top: 20,
              }}
              themeColor={ChartThemeColor.multiOrdered}
            >
              <ChartAxis
                style={{
                  tickLabels: { angle: -45, textAnchor: "end", fontSize: 10 },
                }}
                fixLabelOverlap
              />
              <ChartAxis dependentAxis showGrid label="Lag (ms)" />

              {/* Healthy threshold line at 200ms */}
              <ChartThreshold
                data={[
                  {
                    x: STATIC_DATA.replicationLagDetail.datapoints[0].x,
                    y: STATIC_DATA.replicationLag.healthyThreshold,
                  },
                  {
                    x: STATIC_DATA.replicationLagDetail.datapoints[
                      STATIC_DATA.replicationLagDetail.datapoints.length - 1
                    ].x,
                    y: STATIC_DATA.replicationLag.healthyThreshold,
                  },
                ]}
                style={{
                  data: {
                    stroke: "#3e8635",
                    strokeWidth: 2,
                    strokeDasharray: "4,4",
                  },
                }}
              />

              {/* Actual lag data */}
              <ChartArea data={STATIC_DATA.replicationLagDetail.datapoints} />
            </Chart>
          </CardBody>
        </Card>
      </GridItem>

      {/* SNAPSHOT METRICS SECTION */}
      <GridItem span={12}>
        <Title headingLevel="h2" style={{ marginTop: "32px", marginBottom: "16px" }}>
          Snapshot Metrics
        </Title>
      </GridItem>

      {/* Snapshot Card 1: Progress Donut */}
      <GridItem md={12} lg={4}>
        <Card ouiaId="SnapshotProgressCard" isFullHeight>
          <CardTitle>Snapshot Progress</CardTitle>
          <CardBody>
            <Flex
              justifyContent={{ default: "justifyContentCenter" }}
              alignItems={{ default: "alignItemsCenter" }}
            >
              <ChartDonut
                ariaDesc="Snapshot progress"
                ariaTitle="Tables snapshotted"
                constrainToVisibleArea
                data={[
                  {
                    x: "Completed",
                    y: STATIC_DATA.snapshot.totalTables - STATIC_DATA.snapshot.remainingTables,
                  },
                  { x: "Remaining", y: STATIC_DATA.snapshot.remainingTables },
                ]}
                labels={({ datum }: { datum: { x: string; y: number } }) =>
                  `${datum.x}: ${datum.y}`
                }
                subTitle="Tables"
                title={`${STATIC_DATA.snapshot.totalTables - STATIC_DATA.snapshot.remainingTables}/${STATIC_DATA.snapshot.totalTables}`}
                height={230}
                width={350}
                padding={{
                  bottom: 20,
                  left: 20,
                  right: 20,
                  top: 20,
                }}
                colorScale={["#3e8635", "#d2d2d2"]}
              />
            </Flex>
          </CardBody>
        </Card>
      </GridItem>

      {/* Snapshot Card 2: Status */}
      <GridItem md={12} lg={4}>
        <Card ouiaId="SnapshotStatusCard" isFullHeight>
          <CardTitle>Snapshot Status</CardTitle>
          <CardBody>
            <Flex
              direction={{ default: "column" }}
              spaceItems={{ default: "spaceItemsMd" }}
              justifyContent={{ default: "justifyContentCenter" }}
              style={{ minHeight: "200px" }}
            >
              {/* Completed Status */}
              <FlexItem>
                <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsXs" }}>
                  <FlexItem>
                    <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
                      Completion
                    </span>
                  </FlexItem>
                  <FlexItem>
                    {STATIC_DATA.snapshot.snapshotCompleted === 1 ? (
                      <Label color="green" icon={<CheckCircleIcon />} isCompact>
                        Completed
                      </Label>
                    ) : (
                      <Label color="grey" icon={<PauseCircleIcon />} isCompact>
                        Not Completed
                      </Label>
                    )}
                  </FlexItem>
                </Flex>
              </FlexItem>

              <Divider />

              {/* Running Status */}
              <FlexItem>
                <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsXs" }}>
                  <FlexItem>
                    <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
                      Current State
                    </span>
                  </FlexItem>
                  <FlexItem>
                    {STATIC_DATA.snapshot.snapshotRunning === 1 ? (
                      <Label color="blue" icon={<InProgressIcon />} isCompact>
                        In Progress
                      </Label>
                    ) : STATIC_DATA.snapshot.snapshotAborted === 1 ? (
                      <Label color="orange" icon={<BanIcon />} isCompact>
                        Aborted
                      </Label>
                    ) : (
                      <Label color="grey" icon={<PauseCircleIcon />} isCompact>
                        Idle
                      </Label>
                    )}
                  </FlexItem>
                </Flex>
              </FlexItem>
            </Flex>
          </CardBody>
        </Card>
      </GridItem>

      {/* Snapshot Card 3: Table Count */}
      <GridItem md={12} lg={4}>
        <Card ouiaId="SnapshotTableCountCard" isFullHeight>
          <CardTitle>Table Metrics</CardTitle>
          <CardBody>
            <Flex
              direction={{ default: "column" }}
              spaceItems={{ default: "spaceItemsMd" }}
              justifyContent={{ default: "justifyContentCenter" }}
              style={{ minHeight: "200px" }}
            >
              {/* Total Tables */}
              <FlexItem>
                <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsXs" }}>
                  <FlexItem>
                    <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
                      Total Tables
                    </span>
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h2" size="2xl">
                      {STATIC_DATA.snapshot.totalTables}
                    </Title>
                    <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
                      tables
                    </span>
                  </FlexItem>
                </Flex>
              </FlexItem>

              <Divider />

              {/* Remaining Tables */}
              <FlexItem>
                <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsXs" }}>
                  <FlexItem>
                    <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
                      Remaining Tables
                    </span>
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h2" size="2xl">
                      {STATIC_DATA.snapshot.remainingTables}
                    </Title>
                    <span style={{ fontSize: "14px", color: "var(--pf-v5-global--Color--200)" }}>
                      pending
                    </span>
                  </FlexItem>
                </Flex>
              </FlexItem>
            </Flex>
          </CardBody>
        </Card>
      </GridItem>

      {/* Rows Scanned Table - Full Width */}
      <GridItem span={12}>
        <Card ouiaId="RowsScannedCard">
          <CardTitle>Rows Scanned per Table</CardTitle>
          <CardBody>
            <Table aria-label="Rows scanned table" variant="compact">
              <Thead>
                <Tr>
                  <Th>Table Name</Th>
                  <Th modifier="fitContent">Rows Scanned</Th>
                </Tr>
              </Thead>
              <Tbody>
                {STATIC_DATA.snapshot.rowsScanned.map((row, index) => (
                  <Tr key={index}>
                    <Td dataLabel="Table Name">{row.tableName}</Td>
                    <Td dataLabel="Rows Scanned" modifier="fitContent">
                      {row.rowsScanned.toLocaleString()}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      </GridItem>
    </Grid>
  );
};

export default PipelineMonitoring;
