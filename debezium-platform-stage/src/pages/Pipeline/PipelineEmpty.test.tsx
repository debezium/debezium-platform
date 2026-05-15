import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PipelineEmpty } from "./PipelineEmpty";
import { render } from "../../__test__/unit/test-utils";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@components/pipelineDesigner/WelcomeFlow", () => ({
  __esModule: true,
  default: () => <div data-testid="welcome-flow-mock" />,
}));

describe("PipelineEmpty", () => {
  it("renders welcome content and embedded flow placeholder", () => {
    render(<PipelineEmpty />);

    expect(screen.getByTestId("welcome-flow-mock")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create your first pipeline" }),
    ).toBeInTheDocument();
  });

  it("navigates to designer and resource pages from actions", () => {
    render(<PipelineEmpty />);

    fireEvent.click(screen.getByRole("button", { name: "Create your first pipeline" }));
    expect(mockNavigate).toHaveBeenCalledWith("/pipeline/pipeline_designer");

    fireEvent.click(screen.getByRole("button", { name: "Sources" }));
    expect(mockNavigate).toHaveBeenCalledWith("/source");

    fireEvent.click(screen.getByRole("button", { name: "Transforms" }));
    expect(mockNavigate).toHaveBeenCalledWith("/transform");

    fireEvent.click(screen.getByRole("button", { name: "Destinations" }));
    expect(mockNavigate).toHaveBeenCalledWith("/destination");
  });
});
