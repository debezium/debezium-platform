/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Connections } from "./Connections";
import { useQuery } from "react-query";
import { useDeleteData } from "src/apis";
import { useNotification } from "../../appLayout/AppNotificationContext";
import connectionsMock from "../../__mocks__/data/Connections.json";
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

describe("Connections", () => {
  const mockConnections = connectionsMock;
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock useQuery to return sources
    vi.mocked(useQuery).mockImplementation((key) => {
      if (key === "connections") {
        return {
          data: mockConnections,
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
    render(<Connections />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays error message when API fails", async () => {
        // Mock the useQuery hook to simulate an API failure for connections
    vi.mocked(useQuery).mockImplementation((key) => {
      if (key === "connections") {
        return {
          data: undefined,
          error: new Error("Failed to fetch connections"),
          isLoading: false,
        } as any;
      }
      // Keep the original implementation for other queries
      return { data: undefined, error: null, isLoading: false } as any;
    });

    render(<Connections />);
    await waitFor(() => {
      expect(
        screen.getByText("Error: Failed to fetch connections")
      ).toBeInTheDocument();
    });
  });

  it("renders connections when data is loaded", async () => {
    render(<Connections />);
    await waitFor(() => {
      expect(screen.getByText("mariaconnection")).toBeInTheDocument();
      expect(screen.getByText("kinesis-connection")).toBeInTheDocument();
      expect(screen.getByText("2 Items")).toBeInTheDocument();
    });
  });

//   it("check if current active pipeline no is shown correctly", async () => {
//     render(<Connections />);
//     await waitFor(() => {
//       const activeDestinationRow = screen.getByText("mariaconnection").closest("tr");
//       expect(activeDestinationRow).toBeInTheDocument();
//       expect(
//         activeDestinationRow && activeDestinationRow.textContent
//       ).toContain("1");
//       const nonUsedDestinationRow = screen.getByText("kinesis-connection").closest("tr");
//       expect(nonUsedDestinationRow).toBeInTheDocument();
//       expect(
//         nonUsedDestinationRow && nonUsedDestinationRow.textContent
//       ).toContain("0");
//     });
//   });

  it("filters connections based on search input", async () => {
    render(<Connections />);
    const searchInput = screen.getByPlaceholderText("Find by name");
    fireEvent.change(searchInput, { target: { value: "kinesis" } });
    await waitFor(() => {
      expect(screen.getByText("kinesis-connection")).toBeInTheDocument();
    });
  });

  it("filters connections for unknown search input and clears search", async () => {
    render(<Connections />);
    const searchInput = screen.getByPlaceholderText("Find by name");
    fireEvent.change(searchInput, { target: { value: "xxx" } });
    await waitFor(() => {
      expect(screen.getByText("0 Items")).toBeInTheDocument();
      expect(
        screen.getByText("No matching connection is present.")
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
