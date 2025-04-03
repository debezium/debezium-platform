/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Pipelines } from "./Pipelines";
import { useQuery } from "react-query";
import { useDeleteData } from "src/apis";
import { useNotification } from "../../appLayout/AppNotificationContext";
import pipelinesMock from "../../__mocks__/data/Pipelines.json";
import { render } from '../../__test__/unit/test-utils';

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
    QueryClient: vi.fn().mockImplementation(() => ({
      invalidateQueries: vi.fn(),
    })),
  };
});

vi.mock("src/apis", () => ({
  useDeleteData: vi.fn(),
}));

vi.mock("../../appLayout/AppNotificationContext", () => ({
  useNotification: vi.fn(),
}));

describe("Pipelines", () => {
  const mockPipelines = pipelinesMock;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useQuery).mockReturnValue({
      data: mockPipelines,
      error: null,
      isLoading: false,
    } as any);

    vi.mocked(useDeleteData).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(useNotification).mockReturnValue({
      addNotification: vi.fn(),
    } as any);
  });

  it("renders pipelines when data is loaded", async () => {
    render(<Pipelines />);

    await waitFor(() => {
      expect(screen.getByText("indra-ui-test")).toBeInTheDocument();
    });
  });

  it("displays loading state when data is being fetched", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    } as any);

    render(<Pipelines />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("filters pipelines based on search input", async () => {
    render(<Pipelines />);

    const searchInput = screen.getByPlaceholderText("Find by name");
    fireEvent.change(searchInput, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("indra-ui-test")).toBeInTheDocument();
    });
  });
});
