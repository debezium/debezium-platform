import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, testQueryClient } from "../../__test__/unit/test-utils";
import AlertHistory from "./AlertEvents";
import { PagedAlertEventResponse } from "./alertsTypes";
import { ALERT_RULES_QUERY_KEY, AlertRuleSummary } from "../../apis/alerts";
import { Pipeline } from "../../apis/apis";

vi.mock("../../apis/apis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apis/apis")>();
  return {
    ...actual,
    fetchData: vi.fn(),
  };
});

import { fetchData } from "../../apis/apis";

const singlePageResponse = (
  overrides: Partial<PagedAlertEventResponse> = {}
): PagedAlertEventResponse => ({
  events: [
    {
      id: 101,
      ruleId: 1,
      ruleName: "high-source-lag",
      pipelineId: "payments-stream",
      pipelineName: "Payments Stream",
      status: "firing",
      value: 1500,
      threshold: 1000,
      severity: "CRITICAL",
      message: "Source lag exceeded threshold",
      firedAt: "2026-08-17T10:00:00.000Z",
      resolvedAt: null,
      durationSeconds: 120,
      createdAt: "2026-08-17T10:00:00.000Z",
    },
  ],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
  ...overrides,
});

const pipelinesResponse: Pipeline[] = [
  { id: 1, name: "payments-stream" } as Pipeline,
  { id: 2, name: "orders-cdc" } as Pipeline,
];

const ruleSummariesResponse: AlertRuleSummary[] = [
  { id: 1, name: "high-source-lag" },
  { id: 2, name: "snapshot-stalled" },
];

let eventsResponse: PagedAlertEventResponse;

const mockFetchDataByUrl = (url: string) => {
  if (url.includes("/api/alerts/events")) return Promise.resolve(eventsResponse);
  if (url.includes("/api/alerts/rules")) return Promise.resolve(ruleSummariesResponse);
  if (url.includes("/api/pipelines")) return Promise.resolve(pipelinesResponse);
  return Promise.reject(new Error(`Unhandled fetchData url in test: ${url}`));
};

/** Most recent `fetchData` call whose URL contains `substring`, parsed for query-param assertions. */
const lastRequestedUrl = (substring: string) => {
  const match = vi
    .mocked(fetchData)
    .mock.calls.map(([url]) => url as string)
    .filter((url) => url.includes(substring))
    .pop();
  if (!match) throw new Error(`No fetchData call matched "${substring}"`);
  return new URL(match);
};

const switchFilterField = async (from: string, to: string) => {
  await userEvent.click(screen.getByRole("button", { name: from }));
  const listbox = await screen.findByRole("listbox");
  await userEvent.click(within(listbox).getByText(to));
};

describe("AlertHistory", () => {
  beforeEach(() => {
    eventsResponse = singlePageResponse();
    vi.mocked(fetchData).mockReset();
    vi.mocked(fetchData).mockImplementation(mockFetchDataByUrl);
  });

  it("shows a loading state, then renders the fetched page of events", async () => {
    render(<AlertHistory />);

    expect(screen.getByLabelText("Loading alert history")).toBeInTheDocument();

    expect(await screen.findByText("high-source-lag")).toBeInTheDocument();
    expect(screen.getByText("Payments Stream")).toBeInTheDocument();
    expect(screen.queryByLabelText("Loading alert history")).not.toBeInTheDocument();
  });

  it("still renders history when the shared rules cache holds a non-array value", async () => {
    testQueryClient.setQueryData(ALERT_RULES_QUERY_KEY, {
      events: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    });

    render(<AlertHistory />);

    expect(await screen.findByText("high-source-lag")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Severity" })).toBeInTheDocument();
  });

  it("requests page 0 and size 20 by default", async () => {
    render(<AlertHistory />);

    await screen.findByText("high-source-lag");

    const url = lastRequestedUrl("/api/alerts/events");
    expect(url.searchParams.get("page")).toBe("0");
    expect(url.searchParams.get("size")).toBe("20");
  });

  it("requests the 0-indexed page when paging forward", async () => {
    eventsResponse = singlePageResponse({ totalElements: 45, totalPages: 3 });

    render(<AlertHistory />);
    await screen.findByText("high-source-lag");

    await userEvent.click(
      screen.getAllByRole("button", { name: /next page/i })[0]
    );

    await waitFor(() => {
      expect(lastRequestedUrl("/api/alerts/events").searchParams.get("page")).toBe("1");
    });
  });

  it("sends repeated severity= query params when multiple severities are selected", async () => {
    render(<AlertHistory />);
    await screen.findByText("high-source-lag");

    await userEvent.click(screen.getByRole("button", { name: "Filter by severity" }));
    const menu = await screen.findByRole("menu");
    await userEvent.click(within(menu).getByText("CRITICAL"));
    await userEvent.click(within(menu).getByText("WARNING"));

    await waitFor(() => {
      expect(lastRequestedUrl("/api/alerts/events").searchParams.getAll("severity")).toEqual([
        "CRITICAL",
        "WARNING",
      ]);
    });
  });

  it("requests status=firing when the URL includes status=firing", async () => {
    render(<AlertHistory />, { initialEntries: ["/alerts/history?status=firing"] });

    await screen.findByText("high-source-lag");

    expect(lastRequestedUrl("/api/alerts/events").searchParams.getAll("status")).toEqual([
      "firing",
    ]);
  });

  it("sends a single status= query param and replaces it when another status is selected", async () => {
    render(<AlertHistory />);
    await screen.findByText("high-source-lag");

    await switchFilterField("Severity", "Status");
    await userEvent.click(screen.getByRole("button", { name: "Filter by status" }));
    const listbox = await screen.findByRole("listbox");
    await userEvent.click(within(listbox).getByText("Firing"));

    await waitFor(() => {
      expect(lastRequestedUrl("/api/alerts/events").searchParams.getAll("status")).toEqual(["firing"]);
    });

    await userEvent.click(screen.getByRole("button", { name: "Filter by status" }));
    const nextListbox = await screen.findByRole("listbox");
    await userEvent.click(within(nextListbox).getByText("Resolved"));

    await waitFor(() => {
      expect(lastRequestedUrl("/api/alerts/events").searchParams.getAll("status")).toEqual(["resolved"]);
    });
  });

  it("sends from/to params when a date preset is selected", async () => {
    render(<AlertHistory />);
    await screen.findByText("high-source-lag");

    await userEvent.click(screen.getByRole("button", { name: "All time" }));
    const listbox = await screen.findByRole("listbox");
    await userEvent.click(within(listbox).getByText("Last 24 hours"));

    await waitFor(() => {
      const url = lastRequestedUrl("/api/alerts/events");
      expect(url.searchParams.get("from")).toBeTruthy();
      expect(url.searchParams.get("to")).toBeTruthy();
    });
  });

  it("does not send from/to when Custom is selected until Apply is clicked", async () => {
    render(<AlertHistory />);
    await screen.findByText("high-source-lag");

    await userEvent.click(screen.getByRole("button", { name: "All time" }));
    const listbox = await screen.findByRole("listbox");
    await userEvent.click(within(listbox).getByText("Custom"));

    expect(screen.getByLabelText("Alert history from date and time")).toBeInTheDocument();
    expect(screen.getByLabelText("Alert history to date and time")).toBeInTheDocument();

    const url = lastRequestedUrl("/api/alerts/events");
    expect(url.searchParams.get("from")).toBeNull();
    expect(url.searchParams.get("to")).toBeNull();
  });

  it("sends from/to params when a custom range is applied", async () => {
    render(<AlertHistory />);
    await screen.findByText("high-source-lag");

    await userEvent.click(screen.getByRole("button", { name: "All time" }));
    const listbox = await screen.findByRole("listbox");
    await userEvent.click(within(listbox).getByText("Custom"));

    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      const url = lastRequestedUrl("/api/alerts/events");
      expect(url.searchParams.get("from")).toBeTruthy();
      expect(url.searchParams.get("to")).toBeTruthy();
    });
  });

  describe("Pipeline/Rule entity filter", () => {
    it("defaults to Severity mode and fetches the pipeline list only after switching to Pipeline", async () => {
      render(<AlertHistory />);
      await screen.findByText("high-source-lag");

      expect(screen.getByRole("button", { name: "Severity" })).toBeInTheDocument();
      expect(
        vi.mocked(fetchData).mock.calls.some(([url]) => (url as string).includes("/api/pipelines"))
      ).toBe(false);
      expect(
        vi.mocked(fetchData).mock.calls.some(([url]) => (url as string).includes("/api/alerts/rules"))
      ).toBe(false);

      await switchFilterField("Severity", "Pipeline");

      await waitFor(() => {
        expect(
          vi.mocked(fetchData).mock.calls.some(([url]) => (url as string).includes("/api/pipelines"))
        ).toBe(true);
      });
      expect(
        vi.mocked(fetchData).mock.calls.some(([url]) => (url as string).includes("/api/alerts/rules"))
      ).toBe(false);
    });

    it("supports typeahead filtering and sends the selected pipeline name as pipelineId", async () => {
      render(<AlertHistory />);
      await screen.findByText("high-source-lag");
      await switchFilterField("Severity", "Pipeline");

      const input = await screen.findByPlaceholderText("Filter by pipeline");
      await userEvent.click(input);
      await userEvent.type(input, "orders");

      const listbox = await screen.findByRole("listbox");
      expect(within(listbox).queryByText("payments-stream")).not.toBeInTheDocument();
      await userEvent.click(within(listbox).getByText("orders-cdc"));

      await waitFor(() => {
        expect(lastRequestedUrl("/api/alerts/events").searchParams.getAll("pipelineId")).toEqual([
          "orders-cdc",
        ]);
      });
    });

    it("fetches rules only after switching the filter-field select to Rule, and sends the selected rule id as ruleId", async () => {
      render(<AlertHistory />);
      await screen.findByText("high-source-lag");

      await switchFilterField("Severity", "Rule");

      await waitFor(() => {
        expect(
          vi.mocked(fetchData).mock.calls.some(([url]) => (url as string).includes("/api/alerts/rules"))
        ).toBe(true);
      });

      const input = await screen.findByPlaceholderText("Filter by rule");
      await userEvent.click(input);
      const listbox = await screen.findByRole("listbox");
      await userEvent.click(within(listbox).getByText("snapshot-stalled"));

      await waitFor(() => {
        expect(lastRequestedUrl("/api/alerts/events").searchParams.getAll("ruleId")).toEqual(["2"]);
      });
    });

    it("retains pipeline and rule selections when toggling, and only drops them when the user clears", async () => {
      render(<AlertHistory />);
      await screen.findByText("high-source-lag");
      await switchFilterField("Severity", "Pipeline");

      const pipelineInput = await screen.findByPlaceholderText("Filter by pipeline");
      await userEvent.click(pipelineInput);
      const pipelineListbox = await screen.findByRole("listbox");
      await userEvent.click(within(pipelineListbox).getByText("payments-stream"));

      await waitFor(() => {
        expect(lastRequestedUrl("/api/alerts/events").searchParams.getAll("pipelineId")).toEqual([
          "payments-stream",
        ]);
      });

      // Close the still-open Pipeline typeahead menu before opening the filter-field select,
      // so there's only ever one listbox on screen at a time.
      await userEvent.keyboard("{Escape}");

      await userEvent.click(screen.getByRole("button", { name: "Pipeline" }));
      const fieldListbox = await screen.findByRole("listbox");
      await userEvent.click(within(fieldListbox).getByText("Rule"));

      await waitFor(() => {
        const url = lastRequestedUrl("/api/alerts/events");
        expect(url.searchParams.getAll("pipelineId")).toEqual(["payments-stream"]);
        expect(url.searchParams.getAll("ruleId")).toEqual([]);
      });

      const ruleInput = await screen.findByPlaceholderText("Filter by rule");
      await userEvent.click(ruleInput);
      const ruleListbox = await screen.findByRole("listbox");
      await userEvent.click(within(ruleListbox).getByText("snapshot-stalled"));

      await waitFor(() => {
        const url = lastRequestedUrl("/api/alerts/events");
        expect(url.searchParams.getAll("pipelineId")).toEqual(["payments-stream"]);
        expect(url.searchParams.getAll("ruleId")).toEqual(["2"]);
      });

      await userEvent.keyboard("{Escape}");
      await userEvent.click(screen.getByRole("button", { name: "Rule" }));
      const pipelineFieldListbox = await screen.findByRole("listbox");
      await userEvent.click(within(pipelineFieldListbox).getByText("Pipeline"));

      await waitFor(() => {
        const url = lastRequestedUrl("/api/alerts/events");
        expect(url.searchParams.getAll("pipelineId")).toEqual(["payments-stream"]);
        expect(url.searchParams.getAll("ruleId")).toEqual(["2"]);
      });
      expect(screen.getByPlaceholderText("Filter by pipeline")).toBeInTheDocument();
    });
  });

  describe("column management", () => {
    const dataColumnHeaders = () =>
      screen
        .getAllByRole("columnheader")
        .map((header) => header.textContent?.trim())
        .filter((name) => name && name !== "Expand");

    it("shows the default columns and hides the optional ones", async () => {
      render(<AlertHistory />);
      await screen.findByText("high-source-lag");

      expect(dataColumnHeaders()).toEqual([
        "Severity",
        "Rule",
        "Pipeline",
        "Status",
        "Fired at",
        "Duration",
      ]);
      expect(screen.queryByRole("columnheader", { name: "Value" })).not.toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Threshold" })).not.toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Resolved at" })).not.toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Created at" })).not.toBeInTheDocument();
    });

    it("preselects currently visible columns when the modal opens", async () => {
      render(<AlertHistory />);
      await screen.findByText("high-source-lag");

      await userEvent.click(screen.getByRole("button", { name: "Manage columns" }));
      const dialog = await screen.findByRole("dialog");

      expect(within(dialog).getByRole("checkbox", { name: "Severity" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Rule" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Pipeline" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Status" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Fired at" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Duration" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Value" })).not.toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Threshold" })).not.toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Resolved at" })).not.toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Created at" })).not.toBeChecked();
    });

    it("toggles a column checkbox in the modal", async () => {
      render(<AlertHistory />);
      await screen.findByText("high-source-lag");

      await userEvent.click(screen.getByRole("button", { name: "Manage columns" }));
      const dialog = await screen.findByRole("dialog");
      const valueCheckbox = within(dialog).getByRole("checkbox", { name: "Value" });

      expect(valueCheckbox).not.toBeChecked();
      await userEvent.click(valueCheckbox);
      expect(valueCheckbox).toBeChecked();
      await userEvent.click(valueCheckbox);
      expect(valueCheckbox).not.toBeChecked();
    });

    it("adds a selected column after saving the manage-columns modal", async () => {
      render(<AlertHistory />);
      await screen.findByText("high-source-lag");

      await userEvent.click(screen.getByRole("button", { name: "Manage columns" }));
      const dialog = await screen.findByRole("dialog");
      await userEvent.click(within(dialog).getByRole("checkbox", { name: "Value" }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

      expect(await screen.findByRole("columnheader", { name: "Value" })).toBeInTheDocument();
      expect(screen.getByText("1500")).toBeInTheDocument();
      expect(dataColumnHeaders()).toEqual([
        "Severity",
        "Rule",
        "Pipeline",
        "Status",
        "Value",
        "Fired at",
        "Duration",
      ]);
    });

    it("shows every column in canonical order after Select all", async () => {
      render(<AlertHistory />);
      await screen.findByText("high-source-lag");

      await userEvent.click(screen.getByRole("button", { name: "Manage columns" }));
      const dialog = await screen.findByRole("dialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Select all" }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

      expect(dataColumnHeaders()).toEqual([
        "Severity",
        "Rule",
        "Pipeline",
        "Status",
        "Value",
        "Threshold",
        "Fired at",
        "Resolved at",
        "Created at",
        "Duration",
      ]);
    });

    it("does not apply column changes when the modal is cancelled", async () => {
      render(<AlertHistory />);
      await screen.findByText("high-source-lag");

      await userEvent.click(screen.getByRole("button", { name: "Manage columns" }));
      const dialog = await screen.findByRole("dialog");
      await userEvent.click(within(dialog).getByRole("checkbox", { name: "Value" }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("columnheader", { name: "Value" })).not.toBeInTheDocument();
    });
  });
});
