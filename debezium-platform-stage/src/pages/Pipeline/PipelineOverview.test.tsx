import { describe, it, expect, vi } from "vitest";
import { render } from "../../__test__/unit/test-utils";
import { screen } from "@testing-library/react";
import PipelineOverview from "./PipelineOverview";

vi.mock("src/config", () => ({
  getBackendUrl: () => "",
}));

vi.mock("@components/pipelineDesigner/CompositionFlow", () => ({
  __esModule: true,
  default: (props: unknown) => (
    <div data-testid="composition-flow">{JSON.stringify(props)}</div>
  ),
}));

vi.mock("../../appLayout/AppContext", () => ({
  useData: () => ({
    darkMode: false,
    navigationCollapsed: false,
    setDarkMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  }),
}));

describe("PipelineOverview", () => {
  it("renders pipeline overview with source and destination details", async () => {
    const pipeline = {
      id: 2,
      name: "p2",
      description: "",
      errorMessage: "",
      status: "RUNNING" as const,
      source: { id: 2, name: "test-cass" },
      destination: { id: 2, name: "test-infi" },
      transforms: [],
      logLevel: "INFO",
      logLevels: {},
    };

    render(
      <PipelineOverview
        pipelineId="2"
        activeTabKey="overview"
        pipeline={pipeline}
      />
    );

    expect(await screen.findByText("Pipeline composition")).toBeInTheDocument();
    expect(screen.queryByText("Snapshot in progress")).not.toBeInTheDocument();
    expect(await screen.findByText("test-cass")).toBeInTheDocument();
    expect(await screen.findByText("test-infi")).toBeInTheDocument();
    expect(await screen.findByTestId("composition-flow")).toBeInTheDocument();
  });

  it("shows snapshot progress on the overview while a snapshot is active", () => {
    const pipeline = {
      id: 2,
      name: "p2",
      description: "",
      errorMessage: "",
      status: "RUNNING" as const,
      source: { id: 2, name: "test-cass" },
      destination: { id: 2, name: "test-infi" },
      transforms: [],
      logLevel: "INFO",
      logLevels: {},
    };

    render(
      <PipelineOverview
        pipelineId="2"
        activeTabKey="overview"
        pipeline={pipeline}
        snapshotProgress={{
          type: "INITIAL",
          status: "RUNNING",
          globalProgress: { totalTables: 12, completedTables: 7, percentage: 58.3 },
          tables: [],
          startedAt: new Date().toISOString(),
          elapsedSeconds: 10,
        }}
      />
    );

    expect(screen.getByText("Snapshot in progress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument();
  });
});


