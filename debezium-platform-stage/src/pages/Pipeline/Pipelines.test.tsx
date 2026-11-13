/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Pipelines } from "./Pipelines";
import { useQuery } from "@tanstack/react-query";
import { useDeleteData } from "src/apis";
import { useNotification } from "../../appLayout/AppNotificationContext";
import pipelinesMock from "../../__mocks__/data/Pipelines.json";
import { render } from '../../__test__/unit/test-utils';

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
    QueryClient: class MockQueryClient {
      invalidateQueries = vi.fn();
    },
  };
});

vi.mock("src/apis", () => ({
  useDeleteData: vi.fn(),
}));

vi.mock("../../appLayout/AppContext", () => ({
  useData: () => ({
    darkMode: false,
    navigationCollapsed: false,
    setDarkMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  }),
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

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("filters pipelines based on search input", async () => {
    render(<Pipelines />);

    const searchInput = screen.getByPlaceholderText(/find by name/i);
    fireEvent.change(searchInput, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("indra-ui-test")).toBeInTheDocument();
    });
  });

  it("renders initial snapshot running badge and navigates on click", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [
        {
          ...mockPipelines[0],
          activeSnapshotType: "INITIAL",
          activeSnapshotStatus: "RUNNING",
        },
      ],
      error: null,
      isLoading: false,
    } as any);

    render(<Pipelines />);

    const badge = await screen.findByText(/Initial Running/i);
    expect(badge).toBeInTheDocument();

    fireEvent.click(badge);
    expect(mockNavigate).toHaveBeenCalledWith("/pipeline/1/snapshots");
  });

  it("does not render initial snapshot badge when status is not running", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [
        {
          ...mockPipelines[0],
          activeSnapshotType: "INITIAL",
          activeSnapshotStatus: "PAUSED",
        },
      ],
      error: null,
      isLoading: false,
    } as any);

    render(<Pipelines />);

    await waitFor(() => {
      expect(screen.getByText("indra-ui-test")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Initial Running/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Initial Paused/i)).not.toBeInTheDocument();
  });

  it("renders incremental snapshot running badge and navigates on click", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [
        {
          ...mockPipelines[0],
          activeSnapshotType: "INCREMENTAL",
          activeSnapshotStatus: "RUNNING",
        },
      ],
      error: null,
      isLoading: false,
    } as any);

    render(<Pipelines />);

    const badge = await screen.findByText(/Incremental Running/i);
    expect(badge).toBeInTheDocument();

    fireEvent.click(badge);
    expect(mockNavigate).toHaveBeenCalledWith("/pipeline/1/snapshots");
  });

  it("renders incremental snapshot paused badge and navigates on click", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [
        {
          ...mockPipelines[0],
          activeSnapshotType: "INCREMENTAL",
          activeSnapshotStatus: "PAUSED",
        },
      ],
      error: null,
      isLoading: false,
    } as any);

    render(<Pipelines />);

    const badge = await screen.findByText(/Incremental Paused/i);
    expect(badge).toBeInTheDocument();

    fireEvent.click(badge);
    expect(mockNavigate).toHaveBeenCalledWith("/pipeline/1/snapshots");
  });

  it("does not render snapshot badge when active snapshot status is null or absent", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [
        {
          ...mockPipelines[0],
          activeSnapshotType: null,
          activeSnapshotStatus: null,
        },
      ],
      error: null,
      isLoading: false,
    } as any);

    render(<Pipelines />);

    await waitFor(() => {
      expect(screen.getByText("indra-ui-test")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Initial Running/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Incremental Running/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Incremental Paused/i)).not.toBeInTheDocument();
  });
});
