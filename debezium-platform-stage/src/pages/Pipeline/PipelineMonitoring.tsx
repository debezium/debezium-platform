import {
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
  Flex,
  ToolbarGroup,
  TextInput,
  Spinner,
  EmptyState,
  EmptyStateBody,
  Button,
  Label,
  LabelColor,
} from "@patternfly/react-core";
import { ExclamationCircleIcon, InProgressIcon, OutlinedClockIcon, RedoIcon, SyncAltIcon } from "@patternfly/react-icons";
import { FC, useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "./PipelineMonitoring.css";

import { fetchMonitoringPanels, fetchPanelData } from "../../apis/apis";
import type { PanelResponse, PanelQueryResponse } from "../../apis/types";
import {
  calculateTimeRange,
  parseRefreshInterval,
  datetimeLocalToISO,
  isoToDatetimeLocal,
  type TimeRangePreset,
  type RefreshInterval,
} from "../../utils/timeRangeUtils";
import { hasPanelData, panelSeriesEqual } from "./monitoringUtils";
import { MonitoringPanelCard } from "./MonitoringPanelCard";
import {
  AUXILIARY_PANEL_IDS,
  buildPanelRows,
  getPanelLayout,
  isAuxiliaryPanel,
  isTallChartPanel,
  SNAPSHOT_PANEL_ROWS,
  SNAPSHOT_TABLE_COUNT_PANEL_ID,
  STREAMING_PANEL_ROWS,
} from "./panelConfig";

type PipelineMonitoringProp = {
  pipelineName: string;
};

const getDefaultCustomRange = () => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  return {
    from: isoToDatetimeLocal(fifteenMinutesAgo.toISOString()),
    to: isoToDatetimeLocal(new Date().toISOString()),
  };
};

const PipelineMonitoring: FC<PipelineMonitoringProp> = ({ pipelineName }) => {
  useTranslation();

  const [panels, setPanels] = useState<PanelResponse[]>([]);
  const [panelsLoading, setPanelsLoading] = useState<boolean>(true);
  const [panelsError, setPanelsError] = useState<string | null>(null);

  const [panelData, setPanelData] = useState<Record<string, PanelQueryResponse>>({});
  const [panelDataLoading, setPanelDataLoading] = useState<Record<string, boolean>>({});
  const [panelDataErrors, setPanelDataErrors] = useState<Record<string, string>>({});

  const [isTimeRangeOpen, setIsTimeRangeOpen] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangePreset>("Last 15 minutes");
  const defaultCustomRange = useMemo(() => getDefaultCustomRange(), []);
  const [customFromDraft, setCustomFromDraft] = useState(defaultCustomRange.from);
  const [customToDraft, setCustomToDraft] = useState(defaultCustomRange.to);
  const [appliedCustomFrom, setAppliedCustomFrom] = useState(defaultCustomRange.from);
  const [appliedCustomTo, setAppliedCustomTo] = useState(defaultCustomRange.to);

  const [isRefreshOpen, setIsRefreshOpen] = useState(false);
  const [selectedRefresh, setSelectedRefresh] = useState<RefreshInterval>("15 seconds");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [panelsEverLoaded, setPanelsEverLoaded] = useState<Record<string, boolean>>({});

  const [prevPipelineName, setPrevPipelineName] = useState(pipelineName);

  if (pipelineName !== prevPipelineName) {
    setPrevPipelineName(pipelineName);
    setPanelData({});
    setPanelDataErrors({});
    setPanelDataLoading({});
    setPanelsEverLoaded({});
  }

  useEffect(() => {
    const originalSize = (window as Window & { EVENT_BUFFER_SIZE?: number }).EVENT_BUFFER_SIZE;
    (window as Window & { EVENT_BUFFER_SIZE?: number }).EVENT_BUFFER_SIZE = 100;
    return () => {
      (window as Window & { EVENT_BUFFER_SIZE?: number }).EVENT_BUFFER_SIZE = originalSize;
    };
  }, []);

  const timeRangeOptions: TimeRangePreset[] = [
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

  const refreshOptions: RefreshInterval[] = [
    "Off",
    "5 seconds",
    "10 seconds",
    "15 seconds",
    "30 seconds",
    "1 minute",
    "5 minutes",
  ];

  useEffect(() => {
    const loadPanels = async () => {
      setPanelsLoading(true);
      setPanelsError(null);

      const response = await fetchMonitoringPanels();

      if (response.error) {
        setPanelsError(response.error);
      } else if (response.data) {
        setPanels(response.data.panels);
      }

      setPanelsLoading(false);
    };

    loadPanels();
  }, []);

  const fetchPanelIds = useMemo(() => {
    const ids = new Set(panels.map((panel) => panel.id));
    AUXILIARY_PANEL_IDS.forEach((id) => ids.add(id));
    return [...ids];
  }, [panels]);

  const fetchAllPanelData = useCallback(async (customOverride?: { from: string; to: string }) => {
    if (!fetchPanelIds.length || !pipelineName.trim()) {
      return;
    }

    let start: string;
    let end: string;
    let step: string;

    if (selectedTimeRange === "Custom") {
      const from = customOverride?.from ?? appliedCustomFrom;
      const to = customOverride?.to ?? appliedCustomTo;
      start = datetimeLocalToISO(from);
      end = datetimeLocalToISO(to);
      const durationMinutes =
        (new Date(end).getTime() - new Date(start).getTime()) / (60 * 1000);
      step = durationMinutes <= 15 ? "15s" : durationMinutes <= 60 ? "1m" : "5m";
    } else {
      const timeRange = calculateTimeRange(selectedTimeRange);
      start = timeRange.start;
      end = timeRange.end;
      step = timeRange.step;
    }

    const panelIdsNeedingInitialLoad = fetchPanelIds.filter((panelId) => !panelsEverLoaded[panelId]);

    if (panelIdsNeedingInitialLoad.length > 0) {
      setPanelDataLoading((prev) => {
        const next = { ...prev };
        panelIdsNeedingInitialLoad.forEach((panelId) => {
          next[panelId] = true;
        });
        return next;
      });
    }

    const results = await Promise.all(
      fetchPanelIds.map(async (panelId) => {
        const response = await fetchPanelData(panelId, pipelineName, start, end, step);
        return { panelId, response };
      })
    );

    setPanelData((prev) => {
      const next = { ...prev };
      let changed = false;

      results.forEach(({ panelId, response }) => {
        if (!response.data) {
          return;
        }
        if (!panelSeriesEqual(prev[panelId], response.data)) {
          next[panelId] = response.data;
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    setPanelsEverLoaded((prev) => {
      const next = { ...prev };
      let changed = false;

      results.forEach(({ panelId, response }) => {
        if (response.data && !next[panelId]) {
          next[panelId] = true;
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    setPanelDataErrors((prev) => {
      const next = { ...prev };
      let changed = false;

      results.forEach(({ panelId, response }) => {
        if (response.error) {
          if (next[panelId] !== response.error) {
            next[panelId] = response.error;
            changed = true;
          }
        } else if (panelId in next) {
          delete next[panelId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    if (panelIdsNeedingInitialLoad.length > 0) {
      setPanelDataLoading((prev) => {
        const next = { ...prev };
        panelIdsNeedingInitialLoad.forEach((panelId) => {
          next[panelId] = false;
        });
        return next;
      });
    }

    setLastRefreshTime(new Date());
  }, [fetchPanelIds, selectedTimeRange, appliedCustomFrom, appliedCustomTo, pipelineName, panelsEverLoaded]);

  useEffect(() => {
    if (!panelsLoading && fetchPanelIds.length > 0 && pipelineName.trim() && selectedTimeRange !== "Custom") {
      void fetchAllPanelData();
    }
    // fetchAllPanelData excluded: only re-fetch when query inputs change, not when load tracking updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPanelIds, panelsLoading, pipelineName, selectedTimeRange]);

  useEffect(() => {
    const intervalMs = parseRefreshInterval(selectedRefresh);
    if (intervalMs === null) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchAllPanelData();
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [selectedRefresh, fetchAllPanelData]);

  const onTimeRangeSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    const preset = value as TimeRangePreset;
    setSelectedTimeRange(preset);
    setIsTimeRangeOpen(false);
    if (preset === "Custom") {
      setCustomFromDraft(appliedCustomFrom);
      setCustomToDraft(appliedCustomTo);
    }
  };

  const isCustomRangeValid =
    Boolean(customFromDraft) &&
    Boolean(customToDraft) &&
    new Date(datetimeLocalToISO(customFromDraft)).getTime() <
      new Date(datetimeLocalToISO(customToDraft)).getTime();

  const handleApplyCustomRange = async () => {
    if (!isCustomRangeValid) {
      return;
    }

    setAppliedCustomFrom(customFromDraft);
    setAppliedCustomTo(customToDraft);
    await fetchAllPanelData({ from: customFromDraft, to: customToDraft });
  };

  const onRefreshSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    setSelectedRefresh(value as RefreshInterval);
    setIsRefreshOpen(false);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllPanelData();
    setIsRefreshing(false);
  };

  const streamingPanels = useMemo(
    () => panels.filter((panel) => panel.category === "streaming" && !isAuxiliaryPanel(panel.id)),
    [panels]
  );

  const snapshotPanels = useMemo(
    () => panels.filter((panel) => panel.category === "snapshot" && !isAuxiliaryPanel(panel.id)),
    [panels]
  );

  const hasDataForPanel = useCallback(
    (panelId: string) => hasPanelData(panelData[panelId]),
    [panelData]
  );

  const renderPanelCard = (
    panel: PanelResponse,
    compact: boolean,
    tallChart = false
  ) => (
    <MonitoringPanelCard
      panel={panel}
      data={panelData[panel.id]}
      loading={!!panelDataLoading[panel.id] && !panelData[panel.id]}
      error={panelDataErrors[panel.id]}
      compact={compact}
      tallChart={tallChart}
      snapshotTableCountData={panelData[SNAPSHOT_TABLE_COUNT_PANEL_ID]}
      snapshotTableCountLoading={
        !!panelDataLoading[SNAPSHOT_TABLE_COUNT_PANEL_ID] &&
        !panelData[SNAPSHOT_TABLE_COUNT_PANEL_ID]
      }
      snapshotTableCountError={panelDataErrors[SNAPSHOT_TABLE_COUNT_PANEL_ID]}
      onRetry={fetchAllPanelData}
    />
  );

  const renderPanelSection = (
    sectionPanels: PanelResponse[],
    heading: string,
    rowLayouts: typeof STREAMING_PANEL_ROWS
  ) => {
    const rows = buildPanelRows(sectionPanels, rowLayouts);

    return (
      <>
        <GridItem span={12}>
          <Title
            headingLevel="h2"
            style={{
              marginTop: heading === "Snapshot Metrics" ? "32px" : "8px",
              marginBottom: "16px",
            }}
          >
            {heading}
          </Title>
        </GridItem>

        {rows.map(({ layout, panels: rowPanels }) => (
          <GridItem key={layout.panelIds.join("-")} span={12}>
            <Grid hasGutter>
              {rowPanels.map((panel, panelIndex) => {
                const useCompact =
                  !!layout.compact &&
                  getPanelLayout(panel, hasDataForPanel(panel.id)) === "compact";

                const showDivider =
                  layout.divided && panelIndex < rowPanels.length - 1;

                const lgSpan = layout.lgByPanel?.[panel.id] ?? layout.lg;

                return (
                  <GridItem
                    key={panel.id}
                    md={12}
                    lg={lgSpan as 2 | 3 | 4 | 5 | 6}
                    className={[
                      "monitoring-grid-item",
                      showDivider ? "monitoring-grid-item--divided" : undefined,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {renderPanelCard(
                      panel,
                      useCompact,
                      isTallChartPanel(panel.id)
                    )}
                  </GridItem>
                );
              })}
            </Grid>
          </GridItem>
        ))}
      </>
    );
  };

  if (panelsLoading) {
    return (
      <Flex
        justifyContent={{ default: "justifyContentCenter" }}
        alignItems={{ default: "alignItemsCenter" }}
        style={{ minHeight: "400px" }}
      >
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (panelsError) {
    return (
      <EmptyState>
        <ExclamationCircleIcon
          style={{
            fontSize: "64px",
            color: "var(--pf-v5-global--danger-color--100)",
            marginBottom: "16px",
          }}
        />
        <Title headingLevel="h1" size="lg">
          Failed to load monitoring panels
        </Title>
        <EmptyStateBody>{panelsError}</EmptyStateBody>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </EmptyState>
    );
  }

  return (
    <Grid hasGutter>
      <GridItem span={12}>
        <Toolbar style={{ paddingLeft: 0, paddingRight: 0 }}>
          <ToolbarContent>
            <ToolbarGroup align={{ default: "alignStart" }}>
              <ToolbarItem>
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
                      onClick={() => setIsTimeRangeOpen(!isTimeRangeOpen)}
                      isExpanded={isTimeRangeOpen}
                      icon={<OutlinedClockIcon />}
                    >
                      {selectedTimeRange}
                    </MenuToggle>
                  )}
                >
                  <SelectList>
                    {timeRangeOptions.map((option) => (
                      <SelectOption key={option} value={option}>
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
                      value={customFromDraft}
                      onChange={(_event, value) => setCustomFromDraft(value)}
                    />
                  </ToolbarItem>
                  <ToolbarItem>
                    <TextInput
                      id="time-range-to"
                      type="datetime-local"
                      aria-label="Monitoring to date and time"
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
                      onClick={() => setIsRefreshOpen(!isRefreshOpen)}
                      isExpanded={isRefreshOpen}
                      icon={<SyncAltIcon />}
                    >
                      {selectedRefresh}
                    </MenuToggle>
                  )}
                >
                  <SelectList>
                    {refreshOptions.map((option) => (
                      <SelectOption key={option} value={option}>
                        {option}
                      </SelectOption>
                    ))}
                  </SelectList>
                </Select>
              </ToolbarItem>
            {lastRefreshTime && (
                <ToolbarItem>
                         <Button
                           variant="tertiary"
                           icon={isRefreshing ? <Spinner size="sm" /> : <RedoIcon />}
                           aria-label="Refresh monitoring data"
                           onClick={handleManualRefresh}
                         />
                  <Label 
                   color={LabelColor.purple}
                   icon={<InProgressIcon/>}>

            Last updated: {lastRefreshTime.toLocaleTimeString()}
      </Label>
          
                </ToolbarItem>
              )}
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </GridItem>

      {renderPanelSection(streamingPanels, "Streaming Metrics", STREAMING_PANEL_ROWS)}
      {renderPanelSection(snapshotPanels, "Snapshot Metrics", SNAPSHOT_PANEL_ROWS)}
    </Grid>
  );
};

export default PipelineMonitoring;
