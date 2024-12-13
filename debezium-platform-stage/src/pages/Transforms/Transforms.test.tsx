/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Transforms } from "./Transforms";
import transformsMock from "../../__mocks__/data/TransformsData.json";
import { useQuery } from "react-query";
import { useDeleteData } from "src/apis";
import { useNotification } from "@appContext/AppNotificationContext";

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

describe("Transforms", () => {
  const mockTransforms = transformsMock;
  // const mockPipelines = pipelinesMock;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useQuery).mockImplementation((key) => {
      if (key === "transforms") {
        return {
          data: mockTransforms,
          error: null,
          isLoading: false,
        } as any;
      }
      return { data: undefined, error: null, isLoading: false } as any;
    });

    vi.mocked(useDeleteData).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(useNotification).mockReturnValue({
      addNotification: vi.fn(),
    } as any);
  });

  it("displays loading state when data is being fetched", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    } as any);

    render(<Transforms />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays error message when API fails", async () => {
    // Mock the useQuery hook to simulate an API failure for transforms
    vi.mocked(useQuery).mockImplementation((key) => {
      if (key === "transforms") {
        return {
          data: undefined,
          error: new Error("Failed to fetch transforms"),
          isLoading: false,
        } as any;
      }
      // Keep the original implementation for other queries
      return { data: undefined, error: null, isLoading: false } as any;
    });

    render(<Transforms />);

    await waitFor(() => {
      expect(
        screen.getByText("Error: Failed to fetch transforms")
      ).toBeInTheDocument();
    });
  });

  it("renders transform when data is loaded", async () => {
    render(<Transforms />);

    await waitFor(() => {
      expect(screen.getByText("extract-new-record")).toBeInTheDocument();
      expect(screen.getByText("7 Items")).toBeInTheDocument();
    });
  });

  it("filters transform based on search input", async () => {
    render(<Transforms />);

    const searchInput = screen.getByPlaceholderText("Find by name");
    fireEvent.change(searchInput, { target: { value: "filter" } });

    await waitFor(() => {
      expect(screen.getByText("filter-transform")).toBeInTheDocument();
      expect(screen.getByText("3 Items")).toBeInTheDocument();
    });
  });

  it("filters transform for unknown search input and clears search", async () => {
    render(<Transforms />);

    const searchInput = screen.getByPlaceholderText("Find by name");
    fireEvent.change(searchInput, { target: { value: "xxx" } });

    await waitFor(() => {
      expect(screen.getByText("0 Items")).toBeInTheDocument();
      expect(
        screen.getByText("No matching transform is present.")
      ).toBeInTheDocument();
      expect(screen.getByText("Clear search")).toBeInTheDocument();
    });

    const clearButton = screen.getByText("Clear search");
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(searchInput).toHaveValue("");
      expect(screen.getByText("7 Items")).toBeInTheDocument();
    });
  });
});
