import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render } from "../../__test__/unit/test-utils";
import { screen } from "@testing-library/react";
import PipelineOverview from "./PipelineOverview";
import { server } from "../../__mocks__/server";
import { http, HttpResponse } from "msw";

vi.mock("src/config", () => ({
  getBackendUrl: () => "",
}));

vi.mock("@components/pipelineDesigner/CompositionFlow", () => ({
  __esModule: true,
  default: (props: unknown) => (
    <div data-testid="composition-flow">{JSON.stringify(props)}</div>
  ),
}));

describe("PipelineOverview", () => {
  it("renders pipeline overview with source and destination details", async () => {
    server.use(
      http.get("/api/pipelines/2", () =>
        HttpResponse.json({
          id: 2,
          name: "p2",
          description: "",
          source: { id: 2, name: "test-cass" },
          destination: { id: 2, name: "test-infi" },
          transforms: [],
          logLevel: "INFO",
          logLevels: {},
        })
      )
    );

    render(
      <MemoryRouter>
        <PipelineOverview pipelineId="2" />
      </MemoryRouter>
    );

    expect(await screen.findByText("Pipeline composition")).toBeInTheDocument();
    expect(await screen.findByText("test-cass")).toBeInTheDocument();
    expect(await screen.findByText("test-infi")).toBeInTheDocument();
    expect(await screen.findByTestId("composition-flow")).toBeInTheDocument();
  });
});


