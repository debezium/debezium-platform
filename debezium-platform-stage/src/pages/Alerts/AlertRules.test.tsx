import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../__test__/unit/test-utils";
import AlertRules from "./AlertRules";
import { AlertRule, isoDurationToSeconds, secondsToIsoDuration } from "./alertsTypes";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../apis/alerts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apis/alerts")>();
  return {
    ...actual,
    fetchAlertRules: vi.fn(),
    deleteAlertRule: vi.fn(),
    setAlertRuleEnabled: vi.fn(),
  };
});

import { deleteAlertRule, fetchAlertRules, setAlertRuleEnabled } from "../../apis/alerts";

const sampleRule = (overrides: Partial<AlertRule> = {}): AlertRule => ({
  id: 14,
  name: "high-error-rate",
  description: "Any erroneous events over 1m",
  panelId: "erroneous-events",
  panelTitle: "Erroneous Events Rate",
  operator: "GREATER_THAN",
  threshold: 0,
  forDuration: 60,
  reduceFunction: "AVG",
  evaluationWindow: 300,
  severity: "CRITICAL",
  enabled: true,
  channels: [{ id: 3, name: "Platform Ops Email", type: "EMAIL" }],
  createdAt: "2026-08-18T07:47:03.921895Z",
  updatedAt: "2026-08-18T07:47:03.921895Z",
  ...overrides,
});

describe("AlertRules", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(fetchAlertRules).mockReset();
    vi.mocked(deleteAlertRule).mockReset();
    vi.mocked(setAlertRuleEnabled).mockReset();
    vi.mocked(fetchAlertRules).mockResolvedValue([sampleRule()]);
  });

  it("shows a loading state, then renders the fetched rules", async () => {
    render(<AlertRules firingRuleIds={new Set()}  />);

    expect(screen.getByLabelText("Loading alert rules")).toBeInTheDocument();

    expect(await screen.findByText("high-error-rate")).toBeInTheDocument();
    expect(screen.getByText("Erroneous Events Rate")).toBeInTheDocument();
    expect(screen.getByText("avg > 0 for 1m")).toBeInTheDocument();
    expect(screen.getByText("1 items")).toBeInTheDocument();
  });

  it("shows the empty state when the API returns no rules", async () => {
    vi.mocked(fetchAlertRules).mockResolvedValue([]);

    render(<AlertRules firingRuleIds={new Set()}  />);

    expect(await screen.findByText("No alert rules yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create rule" })).toBeInTheDocument();
  });

  it("shows an error state when the rules request fails", async () => {
    vi.mocked(fetchAlertRules).mockRejectedValue(new Error("network down"));

    render(<AlertRules firingRuleIds={new Set()}  />);

    expect(await screen.findByText("Failed to load alert rules")).toBeInTheDocument();
  });

  it("formats an immediate for-duration with no 'for' suffix", async () => {
    vi.mocked(fetchAlertRules).mockResolvedValue([
      sampleRule({
        id: 28,
        name: "connection-down",
        panelTitle: "Connection Status",
        operator: "LESS_THAN",
        threshold: 1,
        forDuration: 0,
        reduceFunction: "LAST",
      }),
    ]);

    render(<AlertRules firingRuleIds={new Set()}  />);

    expect(await screen.findByText("connection-down")).toBeInTheDocument();
    expect(screen.getByText("last < 1")).toBeInTheDocument();
  });

  it("navigates to the create page when Add rule is clicked", async () => {
    render(<AlertRules firingRuleIds={new Set()} />);
    await screen.findByRole("button", { name: "high-error-rate" });

    await userEvent.click(screen.getByRole("button", { name: "Add rule" }));

    expect(mockNavigate).toHaveBeenCalledWith("/alerts/rules/create_rule");
  });

  it("navigates to view when the rule name is clicked", async () => {
    render(<AlertRules firingRuleIds={new Set()} />);
    await userEvent.click(await screen.findByRole("button", { name: "high-error-rate" }));

    expect(mockNavigate).toHaveBeenCalledWith("/alerts/rules/14?state=view");
  });

  it("navigates to edit from row actions", async () => {
    render(<AlertRules firingRuleIds={new Set()} />);
    const row = (await screen.findByRole("button", { name: "high-error-rate" })).closest("tr");
    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: /kebab toggle/i })
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: /edit/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/alerts/rules/14?state=edit");
  });

  it("calls the enable/disable endpoint when the status switch is toggled", async () => {
    vi.mocked(setAlertRuleEnabled).mockResolvedValue({ data: sampleRule({ enabled: false }) });

    render(<AlertRules firingRuleIds={new Set()}  />);
    await screen.findByText("high-error-rate");

    await userEvent.click(screen.getByRole("switch", { name: "Disable high-error-rate" }));

    await waitFor(() => {
      expect(setAlertRuleEnabled).toHaveBeenCalledWith(14, false);
    });
  });

  it("deletes a rule after name confirmation", async () => {
    vi.mocked(deleteAlertRule).mockResolvedValue(undefined);

    render(<AlertRules firingRuleIds={new Set()}  />);
    await screen.findByText("high-error-rate");

    const row = screen.getByText("high-error-rate").closest("tr");
    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: /kebab toggle/i })
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: /delete/i }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("delete rule name"), "high-error-rate");
    await userEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteAlertRule).toHaveBeenCalledWith(14);
    });
  });

  describe("name/metric filter", () => {
    const rules = [
      sampleRule(),
      sampleRule({
        id: 15,
        name: "source-lag-warning",
        panelId: "source-lag",
        panelTitle: "Source Lag",
      }),
    ];

    beforeEach(() => {
      vi.mocked(fetchAlertRules).mockResolvedValue(rules);
    });

    it("defaults to Name and filters by rule name", async () => {
      render(<AlertRules firingRuleIds={new Set()}  />);
      await screen.findByText("high-error-rate");

      expect(screen.getByRole("button", { name: "Name" })).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Find by name...")).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText("Search rules by name"), "source-lag");

      expect(screen.queryByText("high-error-rate")).not.toBeInTheDocument();
      expect(screen.getByText("source-lag-warning")).toBeInTheDocument();
    });

    it("filters by metric after switching the filter field", async () => {
      render(<AlertRules firingRuleIds={new Set()}  />);
      await screen.findByText("high-error-rate");

      await userEvent.click(screen.getByRole("button", { name: "Name" }));
      const listbox = await screen.findByRole("listbox");
      await userEvent.click(within(listbox).getByText("Metric"));

      expect(screen.getByPlaceholderText("Find by metric...")).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText("Search rules by metric"), "erroneous");

      expect(screen.getByText("high-error-rate")).toBeInTheDocument();
      expect(screen.queryByText("source-lag-warning")).not.toBeInTheDocument();
    });

    it("clears the search when switching between Name and Metric", async () => {
      render(<AlertRules firingRuleIds={new Set()}  />);
      await screen.findByText("high-error-rate");

      const search = screen.getByLabelText("Search rules by name");
      await userEvent.type(search, "source-lag");
      expect(search).toHaveValue("source-lag");

      await userEvent.click(screen.getByRole("button", { name: "Name" }));
      const listbox = await screen.findByRole("listbox");
      await userEvent.click(within(listbox).getByText("Metric"));

      expect(screen.getByLabelText("Search rules by metric")).toHaveValue("");
      expect(screen.getByText("high-error-rate")).toBeInTheDocument();
      expect(screen.getByText("source-lag-warning")).toBeInTheDocument();
    });
  });

  describe("severity sorting", () => {
    const ruleNamesInTable = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[0].textContent?.trim());

    beforeEach(() => {
      vi.mocked(fetchAlertRules).mockResolvedValue([
        sampleRule({ id: 1, name: "info-rule", severity: "INFO" }),
        sampleRule({ id: 2, name: "warn-rule", severity: "WARNING" }),
        sampleRule({ id: 3, name: "crit-rule", severity: "CRITICAL" }),
      ]);
    });

    it("sorts Critical first on the first click, then Info first on the second", async () => {
      render(<AlertRules firingRuleIds={new Set()}  />);
      await screen.findByText("info-rule");

      expect(ruleNamesInTable()).toEqual(["info-rule", "warn-rule", "crit-rule"]);

      await userEvent.click(screen.getByRole("button", { name: /severity/i }));
      expect(ruleNamesInTable()).toEqual(["crit-rule", "warn-rule", "info-rule"]);

      await userEvent.click(screen.getByRole("button", { name: /severity/i }));
      expect(ruleNamesInTable()).toEqual(["info-rule", "warn-rule", "crit-rule"]);
    });
  });
});

describe("duration conversion", () => {
  it("converts ISO-8601 option values to seconds for the API", () => {
    expect(isoDurationToSeconds("PT0S")).toBe(0);
    expect(isoDurationToSeconds("PT1M")).toBe(60);
    expect(isoDurationToSeconds("PT5M")).toBe(300);
    expect(isoDurationToSeconds("PT1H")).toBe(3600);
  });

  it("converts API seconds back to ISO-8601 for the form selects", () => {
    expect(secondsToIsoDuration(0)).toBe("PT0S");
    expect(secondsToIsoDuration(60)).toBe("PT1M");
    expect(secondsToIsoDuration(300)).toBe("PT5M");
    expect(secondsToIsoDuration(3600)).toBe("PT1H");
    expect(secondsToIsoDuration(60.000000000)).toBe("PT1M");
  });
});
