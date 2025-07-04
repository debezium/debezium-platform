/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Sources } from "./Sources";
import { useQuery } from "react-query";
import { useDeleteData } from "src/apis";
import { useNotification } from "../../appLayout/AppNotificationContext";
import sourcesMock from "../../__mocks__/data/Sources.json";
import pipelinesMock from "../../__mocks__/data/Pipelines.json"; 
import { render } from "../../__test__/unit/test-utils";

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

describe("Sources", () => {
  const mockSources = sourcesMock;
  const mockPipelines = pipelinesMock;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockImplementation((key) => {
      if (key === "sources") {
        return {
          data: mockSources,
          error: null,
          isLoading: false,
        } as any;
      } else if (key === "pipelines") {
        return {
          data: mockPipelines,
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
    render(<Sources />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays error message when API fails", async () => {
    // Mock the useQuery hook to simulate an API failure for sources
    vi.mocked(useQuery).mockImplementation((key) => {
      if (key === "sources") {
        return {
          data: undefined,
          error: new Error("Failed to fetch sources"),
          isLoading: false,
        } as any;
      }
      // Keep the original implementation for other queries
      return { data: undefined, error: null, isLoading: false } as any;
    });

    render(<Sources />);
    await waitFor(() => {
      expect(
        screen.getByText("Error: Failed to fetch sources")
      ).toBeInTheDocument();
    });
  });

  it("renders pipelines when data is loaded", async () => {
    render(<Sources />);
    await waitFor(() => {
      expect(screen.getByText("test-source-mongo")).toBeInTheDocument();
      expect(screen.getByText("2 Items")).toBeInTheDocument();
    });
  });

  it("check if current active pipeline no is shown correctly", async () => {
    render(<Sources />);
    await waitFor(() => {
      const nonUsedRow = screen
        .getByText("test-source-mongo")
        .closest("tr");
      expect(nonUsedRow).toBeInTheDocument();
      expect(
        nonUsedRow && nonUsedRow.textContent
      ).toContain("0");
      const activeSourceRow = screen.getByText("test-case").closest("tr");
      expect(activeSourceRow).toBeInTheDocument();
      expect(activeSourceRow && activeSourceRow.textContent).toContain("1");
    });
  });

  it("filters Sources based on search input", async () => {
    render(<Sources />);
    const searchInput = screen.getByPlaceholderText("Find by name");
    fireEvent.change(searchInput, { target: { value: "source" } });
    await waitFor(() => {
      expect(screen.getByText("test-source-mongo")).toBeInTheDocument();
    });
  });

  it("filters sources for unknown search input and clears search", async () => {
    render(<Sources />);
    const searchInput = screen.getByPlaceholderText("Find by name");
    fireEvent.change(searchInput, { target: { value: "xxx" } });
    await waitFor(() => {
      expect(screen.getByText("0 Items")).toBeInTheDocument();
      expect(
        screen.getByText("No matching source is present.")
      ).toBeInTheDocument();
      expect(screen.getByText("Clear search")).toBeInTheDocument();
    });
    const clearButton = screen.getByText("Clear search");
    fireEvent.click(clearButton);
    await waitFor(() => {
      expect(searchInput).toHaveValue("");
      expect(screen.getByText("2 Items")).toBeInTheDocument();
    });
  });
});
