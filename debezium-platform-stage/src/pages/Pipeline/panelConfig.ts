/**
 * Panel Configuration for Pipeline Monitoring
 */

export const STREAMING_PANELS = {
  timeSinceLastEvent: 'time-since-last-event',
  sourceLag: 'source-lag',
  connectionStatus: 'connection-status',
  streamingEventCount: 'streaming-event-count',
  eventsFiltered: 'events-filtered',
  committedTransactions: 'committed-transactions',
  erroneousEvents: 'erroneous-events',
  queueUtilization: 'queue-utilization',
  queueSizeUtilization: 'queue-size-utilization',
} as const;

export const SNAPSHOT_PANELS = {
  snapshotTableProgress: 'snapshot-table-progress',
  snapshotStatus: 'snapshot-status',
  snapshotEventCount: 'snapshot-event-count',
  snapshotDuration: 'snapshot-duration',
} as const;

/**
 * Panel categories for grouping
 */
export const PANEL_CATEGORIES = {
  STREAMING: 'streaming',
  SNAPSHOT: 'snapshot',
} as const;

export const getStreamingPanelIds = (): string[] => {
  return Object.values(STREAMING_PANELS);
};

export const getSnapshotPanelIds = (): string[] => {
  return Object.values(SNAPSHOT_PANELS);
};

export const getAllPanelIds = (): string[] => {
  return [...getStreamingPanelIds(), ...getSnapshotPanelIds()];
};

export const isStreamingPanel = (panelId: string): boolean => {
  return getStreamingPanelIds().includes(panelId);
};

export const isSnapshotPanel = (panelId: string): boolean => {
  return getSnapshotPanelIds().includes(panelId);
};

/**
 * Preferred display order within each monitoring section.
 */
export const STREAMING_PANEL_ORDER = [
  "connection-status",
  "queue-size-utilization",
  "queue-utilization",
  "time-since-last-event",
  "source-lag",
  "streaming-event-count",
  "events-filtered",
  "committed-transactions",
  "erroneous-events",
];

export const SNAPSHOT_PANEL_ORDER = [
  
  "snapshot-status",
  "snapshot-table-progress",
  "snapshot-event-count",
  "snapshot-duration",
];

export const TALL_CHART_PANEL_IDS = new Set<string>([
]);

export const CHART_HEIGHT_DEFAULT = 175;
export const CHART_HEIGHT_TALL = 230;

export type PanelRowLayout = {
  panelIds: string[];
  lg: number;
  lgByPanel?: Partial<Record<string, number>>;
  compact?: boolean;
  divided?: boolean;
};

export const STREAMING_STATUS_ROW: PanelRowLayout = {
  panelIds: ["connection-status", "queue-size-utilization", "queue-utilization"],
  lg: 4,
  compact: true,
  divided: true,
};

export const SNAPSHOT_STATUS_ROW: PanelRowLayout = {
  panelIds: ["snapshot-status","snapshot-table-progress" ],
  lg: 4,
  lgByPanel: {
    "snapshot-table-progress": 8,
    "snapshot-status": 4,
  },
  compact: true,
  divided: true,
};

export const CONNECTION_STATUS_PANEL_ID = "connection-status";
export const SNAPSHOT_TABLE_PROGRESS_PANEL_ID = "snapshot-table-progress";
export const SNAPSHOT_TABLE_COUNT_PANEL_ID = "snapshot-table-count";

/** Fetched for composite panels but not rendered as their own card. */
export const AUXILIARY_PANEL_IDS = new Set<string>([SNAPSHOT_TABLE_COUNT_PANEL_ID]);

export const isAuxiliaryPanel = (panelId: string): boolean => AUXILIARY_PANEL_IDS.has(panelId);

export const SNAPSHOT_STATUS_PANEL_ID = "snapshot-status";

const COMPACT_STATUS_ROWS: PanelRowLayout[] = [STREAMING_STATUS_ROW, SNAPSHOT_STATUS_ROW];

export const isStreamingStatusRowPanel = (panelId: string): boolean =>
  STREAMING_STATUS_ROW.panelIds.includes(panelId);

export const isSnapshotStatusRowPanel = (panelId: string): boolean =>
  SNAPSHOT_STATUS_ROW.panelIds.includes(panelId);

export const isCompactStatusRowPanel = (panelId: string): boolean =>
  COMPACT_STATUS_ROWS.some((row) => row.panelIds.includes(panelId));

/** Explicit row layout for the streaming section (12-column grid). */
export const STREAMING_PANEL_ROWS: PanelRowLayout[] = [
  STREAMING_STATUS_ROW,
  {
    panelIds: ["time-since-last-event", "source-lag"],
    lg: 6,
  },
  {
    panelIds: ["streaming-event-count", "events-filtered"],
    lg: 6,
  },
  {
    panelIds: ["erroneous-events", "committed-transactions"],
    lg: 6,
  },
];

/** Explicit row layout for the snapshot section (12-column grid). */
export const SNAPSHOT_PANEL_ROWS: PanelRowLayout[] = [
  SNAPSHOT_STATUS_ROW,
  {
    panelIds: ["snapshot-event-count", "snapshot-duration"],
    lg: 6,
  },
];

export type PanelLayout = "compact" | "chart";

export const sortPanelsByOrder = (
  panels: import("../../apis/types").PanelResponse[],
  order: string[]
): import("../../apis/types").PanelResponse[] => {
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return [...panels].sort(
    (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999)
  );
};

export const getPanelLayout = (
  panel: import("../../apis/types").PanelResponse,
  hasData: boolean
): PanelLayout => {
  if (!isCompactStatusRowPanel(panel.id)) {
    return "chart";
  }

  if (
    (panel.visualization.type === "line" || panel.visualization.type === "area") &&
    hasData
  ) {
    return "chart";
  }

  return "compact";
};

export const buildPanelRows = (
  panels: import("../../apis/types").PanelResponse[],
  rows: PanelRowLayout[]
): { layout: PanelRowLayout; panels: import("../../apis/types").PanelResponse[] }[] => {
  const panelMap = new Map(panels.map((panel) => [panel.id, panel]));

  return rows
    .map((layout) => ({
      layout,
      panels: layout.panelIds
        .map((id) => panelMap.get(id))
        .filter((panel): panel is import("../../apis/types").PanelResponse => !!panel),
    }))
    .filter((row) => row.panels.length > 0);
};

/** Default lg column span for user-defined panels not in the opinionated layout. */
export const CUSTOM_PANEL_LG = 6;

/** Panel IDs referenced by the built-in row layouts (streaming + snapshot). */
export const getKnownPanelIds = (
  rows: PanelRowLayout[] = [...STREAMING_PANEL_ROWS, ...SNAPSHOT_PANEL_ROWS]
): Set<string> => {
  const ids = new Set<string>();
  rows.forEach((row) => row.panelIds.forEach((id) => ids.add(id)));
  return ids;
};

export const isKnownPanel = (panelId: string): boolean => getKnownPanelIds().has(panelId);

/** User-defined panels from the API that are not part of the opinionated layout. */
export const getCustomPanels = (
  sectionPanels: import("../../apis/types").PanelResponse[]
): import("../../apis/types").PanelResponse[] =>
  sectionPanels.filter((panel) => !isKnownPanel(panel.id) && !isAuxiliaryPanel(panel.id));

/**
 * Groups custom panels into rows of up to two cards (lg=6 each).
 * Preserves the order returned by the panels API.
 */
export const buildCustomPanelRows = (
  panels: import("../../apis/types").PanelResponse[]
): { layout: PanelRowLayout; panels: import("../../apis/types").PanelResponse[] }[] => {
  const rows: {
    layout: PanelRowLayout;
    panels: import("../../apis/types").PanelResponse[];
  }[] = [];

  for (let i = 0; i < panels.length; i += 2) {
    const rowPanels = panels.slice(i, i + 2);
    rows.push({
      layout: {
        panelIds: rowPanels.map((panel) => panel.id),
        lg: CUSTOM_PANEL_LG,
      },
      panels: rowPanels,
    });
  }

  return rows;
};

/** Opinionated rows first, then user-defined panels appended at the end of the section. */
export const buildSectionPanelRows = (
  sectionPanels: import("../../apis/types").PanelResponse[],
  opinionatedRows: PanelRowLayout[]
): { layout: PanelRowLayout; panels: import("../../apis/types").PanelResponse[] }[] => [
  ...buildPanelRows(sectionPanels, opinionatedRows),
  ...buildCustomPanelRows(getCustomPanels(sectionPanels)),
];

export const isTallChartPanel = (panelId: string): boolean =>
  TALL_CHART_PANEL_IDS.has(panelId);

/**
 * Panel display configuration
 * Defines which panels are shown in the UI and their layout
 */
export interface PanelDisplayConfig {
  id: string;
  required: boolean; // If true, show error if panel data fails to load
  fallbackValue?: number; // Default value to show if panel data is unavailable
}
