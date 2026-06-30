import { describe, expect, it } from "vitest";
import type { PanelResponse } from "../../apis/types";
import {
  buildCustomPanelRows,
  buildSectionPanelRows,
  CUSTOM_PANEL_LG,
  getCustomPanels,
  isKnownPanel,
  SNAPSHOT_PANEL_ROWS,
  STREAMING_PANEL_ROWS,
} from "./panelConfig";

const makePanel = (id: string, category: "streaming" | "snapshot" = "streaming"): PanelResponse => ({
  id,
  title: id,
  description: `${id} description`,
  category,
  unit: "",
  visualization: { type: "line", suggestedStep: "15s" },
});

describe("isKnownPanel", () => {
  it("recognizes panels from the opinionated layout", () => {
    expect(isKnownPanel("connection-status")).toBe(true);
    expect(isKnownPanel("snapshot-table-progress")).toBe(true);
  });

  it("treats panels outside the layout as custom", () => {
    expect(isKnownPanel("snapshot-running")).toBe(false);
    expect(isKnownPanel("my-custom-metric")).toBe(false);
  });
});

describe("getCustomPanels", () => {
  it("returns only non-known, non-auxiliary panels in API order", () => {
    const panels = [
      makePanel("connection-status"),
      makePanel("snapshot-running", "snapshot"),
      makePanel("my-custom-metric"),
    ];

    expect(getCustomPanels(panels).map((panel) => panel.id)).toEqual([
      "snapshot-running",
      "my-custom-metric",
    ]);
  });
});

describe("buildCustomPanelRows", () => {
  it("groups panels two per row with lg=6", () => {
    const panels = [
      makePanel("custom-a"),
      makePanel("custom-b"),
      makePanel("custom-c"),
    ];

    const rows = buildCustomPanelRows(panels);

    expect(rows).toHaveLength(2);
    expect(rows[0].layout.lg).toBe(CUSTOM_PANEL_LG);
    expect(rows[0].panels.map((panel) => panel.id)).toEqual(["custom-a", "custom-b"]);
    expect(rows[1].panels.map((panel) => panel.id)).toEqual(["custom-c"]);
  });
});

describe("buildSectionPanelRows", () => {
  it("renders opinionated rows first and appends custom panels at the end", () => {
    const sectionPanels = [
      makePanel("connection-status"),
      makePanel("queue-utilization"),
      makePanel("queue-size-utilization"),
      makePanel("custom-metric-a"),
      makePanel("custom-metric-b"),
    ];

    const rows = buildSectionPanelRows(sectionPanels, STREAMING_PANEL_ROWS);
    const rowPanelIds = rows.map((row) => row.panels.map((panel) => panel.id));

    expect(rowPanelIds[0]).toEqual([
      "connection-status",
      "queue-size-utilization",
      "queue-utilization",
    ]);
    expect(rowPanelIds.at(-1)).toEqual(["custom-metric-a", "custom-metric-b"]);
  });

  it("omits known panels missing from the API without affecting custom panels", () => {
    const sectionPanels = [makePanel("custom-only-metric")];

    const rows = buildSectionPanelRows(sectionPanels, SNAPSHOT_PANEL_ROWS);

    expect(rows).toHaveLength(1);
    expect(rows[0].panels.map((panel) => panel.id)).toEqual(["custom-only-metric"]);
    expect(rows[0].layout.lg).toBe(CUSTOM_PANEL_LG);
  });
});
