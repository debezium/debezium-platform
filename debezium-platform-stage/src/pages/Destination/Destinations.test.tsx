/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Destinations } from "./Destinations";
import { useQuery } from "react-query";
import { useDeleteData } from "src/apis";
import { useNotification } from "../../appLayout/AppNotificationContext";
import destinationsMock from "../../__mocks__/data/Destinations.json";
import pipelinesMock from "../../__mocks__/data/Pipelines.json"; // Add this import
import { render } from "../../__test__/unit/test-utils";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

// Mock the react-query hooks and QueryClient
vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
    QueryClient: vi.fn().mockImplementation(() => ({
      // Add any methods you need to mock from QueryClient
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

describe("Destinations", () => {
  const mockDestinations = destinationsMock;
  const mockPipelines = pipelinesMock; // Add this line
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock useQuery to return sources
    vi.mocked(useQuery).mockImplementation((key) => {
      if (key === "destinations") {
        return {
          data: mockDestinations,
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
    render(<Destinations />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays error message when API fails", async () => {
    // Mock the useQuery hook to simulate an API failure for destinations
    vi.mocked(useQuery).mockImplementation((key) => {
      if (key === "destinations") {
        return {
          data: undefined,
          error: new Error("Failed to fetch destinations"),
          isLoading: false,
        } as any;
      }
      // Keep the original implementation for other queries
      return { data: undefined, error: null, isLoading: false } as any;
    });

    render(<Destinations />);
    await waitFor(() => {
      expect(
        screen.getByText("Error: Failed to fetch destinations")
      ).toBeInTheDocument();
    });
  });

  it("renders destinations when data is loaded", async () => {
    render(<Destinations />);
    await waitFor(() => {
      expect(screen.getByText("test-infi")).toBeInTheDocument();
      expect(screen.getByText("kafka")).toBeInTheDocument();
      expect(screen.getByText("2 Items")).toBeInTheDocument();
    });
  });

  it("check if current active pipeline no is shown correctly", async () => {
    render(<Destinations />);
    await waitFor(() => {
      const activeDestinationRow = screen.getByText("test-infi").closest("tr");
      expect(activeDestinationRow).toBeInTheDocument();
      expect(
        activeDestinationRow && activeDestinationRow.textContent
      ).toContain("1");
      const nonUsedDestinationRow = screen.getByText("kafka").closest("tr");
      expect(nonUsedDestinationRow).toBeInTheDocument();
      expect(
        nonUsedDestinationRow && nonUsedDestinationRow.textContent
      ).toContain("0");
    });
  });

  it("filters destinations based on search input", async () => {
    render(<Destinations />);
    const searchInput = screen.getByPlaceholderText("Find by name");
    fireEvent.change(searchInput, { target: { value: "test" } });
    await waitFor(() => {
      expect(screen.getByText("test-infi")).toBeInTheDocument();
    });
  });

  it("filters destinations for unknown search input and clears search", async () => {
    render(<Destinations />);
    const searchInput = screen.getByPlaceholderText("Find by name");
    fireEvent.change(searchInput, { target: { value: "xxx" } });
    await waitFor(() => {
      expect(screen.getByText("0 Items")).toBeInTheDocument();
      expect(
        screen.getByText("No matching destination is present.")
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
