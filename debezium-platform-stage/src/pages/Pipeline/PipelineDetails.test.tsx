import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { PipelineDetails } from "./PipelineDetails";
import { render } from "../../__test__/unit/test-utils";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("./PipelineOverview", () => ({
  default: () => <div>Overview content</div>,
}));

vi.mock("./PipelineLog", () => ({
  default: () => <div>Logs content</div>,
}));

vi.mock("./PipelineDesignerEdit", () => ({
  PipelineDesignerEdit: () => <div>Edit content</div>,
}));

vi.mock("./PipelineAction", () => ({
  default: () => <div>Action content</div>,
}));

vi.mock("./PipelineMonitoring", () => ({
  default: () => <div>Monitoring content</div>,
}));

vi.mock("../../apis/apis", () => ({
  fetchDataTypeTwo: vi.fn().mockResolvedValue({
    data: {
      id: 123,
      name: "test-pipeline",
      description: "",
      source: { id: 1 },
      destination: { id: 2 },
      transforms: [],
      logLevel: "INFO",
      logLevels: {},
    },
    error: null,
  }),
}));

vi.mock("@utils/featureFlag", async () => {
  const actual = await vi.importActual<typeof import("@utils/featureFlag")>(
    "@utils/featureFlag"
  );

  return {
    ...actual,
    isPipelineTabEnabled: vi.fn(actual.isPipelineTabEnabled),
    getEnabledPipelineTabs: vi.fn(actual.getEnabledPipelineTabs),
  };
});

import {
  getEnabledPipelineTabs,
  isPipelineTabEnabled,
} from "@utils/featureFlag";

const renderPipelineDetails = (initialEntry: string) =>
  render(
    <Routes>
      <Route
        path="/pipeline/:pipelineId/:detailsTab"
        element={<PipelineDetails />}
      />
    </Routes>,
    { initialEntries: [initialEntry] }
  );

describe("PipelineDetails feature gating", () => {
  it("shows enabled hidden tabs by default", async () => {
    vi.mocked(isPipelineTabEnabled).mockImplementation(
      (tab) => tab !== "monitoring"
    );
    vi.mocked(getEnabledPipelineTabs).mockReturnValue([
      "overview",
      "action",
      "logs",
      "edit",
    ]);

    renderPipelineDetails("/pipeline/123/overview");

    expect(await screen.findByText("Overview content")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
    expect(screen.queryByText("Monitoring")).not.toBeInTheDocument();
  });

  it("hides the monitoring tab when PipelineMonitoring is disabled", async () => {
    vi.mocked(isPipelineTabEnabled).mockImplementation(
      (tab) => tab !== "monitoring"
    );
    vi.mocked(getEnabledPipelineTabs).mockReturnValue([
      "overview",
      "action",
      "logs",
      "edit",
    ]);

    renderPipelineDetails("/pipeline/123/overview");

    expect(await screen.findByText("Overview content")).toBeInTheDocument();
    expect(screen.queryByText("Monitoring")).not.toBeInTheDocument();
    expect(screen.queryByText("Monitoring content")).not.toBeInTheDocument();
  });

  it("redirects direct monitoring URLs when PipelineMonitoring is disabled", async () => {
    vi.mocked(isPipelineTabEnabled).mockImplementation(
      (tab) => tab !== "monitoring"
    );
    vi.mocked(getEnabledPipelineTabs).mockReturnValue([
      "overview",
      "action",
      "logs",
      "edit",
    ]);

    renderPipelineDetails("/pipeline/123/monitoring");

    expect(await screen.findByText("Overview content")).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith(
      "/pipeline/123/overview",
      { replace: true }
    );
  });

  it("hides action and logs tabs when those features are disabled", async () => {
    vi.mocked(isPipelineTabEnabled).mockImplementation(
      (tab) => !["monitoring", "action", "logs"].includes(tab)
    );
    vi.mocked(getEnabledPipelineTabs).mockReturnValue(["overview", "edit"]);

    renderPipelineDetails("/pipeline/123/overview");

    expect(await screen.findByText("Overview content")).toBeInTheDocument();
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Logs")).not.toBeInTheDocument();
  });

  it("shows gated tabs when all related features are enabled", async () => {
    vi.mocked(isPipelineTabEnabled).mockReturnValue(true);
    vi.mocked(getEnabledPipelineTabs).mockReturnValue([
      "overview",
      "action",
      "monitoring",
      "logs",
      "edit",
    ]);

    renderPipelineDetails("/pipeline/123/monitoring");

    expect(await screen.findByText("Monitoring")).toBeInTheDocument();
    expect(screen.getByText("Monitoring content")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
  });
});
