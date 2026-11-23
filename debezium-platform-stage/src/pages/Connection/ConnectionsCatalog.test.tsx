/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "@tanstack/react-query";
import { ConnectionsCatalog } from "./ConnectionsCatalog";
import type { Catalog } from "../../apis/types";
import { render } from "../../__test__/unit/test-utils";
import catalogFixture from "../../__fixtures__/catalog.json";

// Mock data
const sourceCatalogRows: Catalog[] = [
  {
    class: "mariadb",
    name: "MariaDB",
    description: "d",
    descriptor: "desc",
    role: "source",
  },
];

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

const mockRefetch = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
  };
});

vi.mock("@components/CatalogSkeleton", () => ({
  __esModule: true,
  default: () => <div data-testid="catalog-skeleton" />,
}));

vi.mock("@components/CatalogGrid", () => ({
  CatalogGrid: ({
    searchResult,
  }: {
    searchResult: Catalog[];
  }) => (
    <div data-testid="connection-catalog-grid">
      {searchResult.map((c) => (
        <span key={c.name}>{c.name}</span>
      ))}
    </div>
  ),
}));

describe("ConnectionsCatalog", () => {
  const destinationCatalogFixture = catalogFixture.components["server-sink"].map((entry: any) => ({
    ...entry,
    role: "destination",
  }));
  const defaultMergedCount =
    sourceCatalogRows.length + destinationCatalogFixture.length;

  const mockSuccessfulCatalog = () => {
    vi.mocked(useQuery).mockImplementation((options: any): any => {
      const queryKey = Array.isArray(options?.queryKey)
        ? options.queryKey[0]
        : options?.queryKey;
      if (queryKey === "sourceConnectorCatalog") {
        return {
          data: sourceCatalogRows,
          error: null,
          isLoading: false,
          refetch: mockRefetch,
        };
      }
      if (queryKey === "destinationConnectorCatalog") {
        return {
          data: destinationCatalogFixture,
          error: null,
          isLoading: false,
          refetch: mockRefetch,
        };
      }
      return { data: [], error: null, isLoading: false, refetch: mockRefetch };
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSuccessfulCatalog();
  });

  it("shows skeleton while catalog is loading", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      refetch: mockRefetch,
    } as any);

    render(<ConnectionsCatalog />);
    expect(screen.getByTestId("catalog-skeleton")).toBeInTheDocument();
    expect(
      screen.queryByText("No matching connection type is present"),
    ).not.toBeInTheDocument();
  });

  it("shows error alert when catalog query fails", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: new Error("network failed"),
      isLoading: false,
      refetch: mockRefetch,
    } as any);

    render(<ConnectionsCatalog />);
    expect(screen.getByText("Failed to load connection catalog")).toBeInTheDocument();
    expect(screen.getByText("network failed")).toBeInTheDocument();
    expect(
      screen.queryByText("No matching connection type is present"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("connection-catalog-grid")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mockRefetch).toHaveBeenCalledTimes(2);
  });

  it("renders title and merged catalog entries", () => {
    render(<ConnectionsCatalog />);

    expect(screen.getByText("Connection catalog")).toBeInTheDocument();
    expect(screen.getByTestId("connection-catalog-grid")).toHaveTextContent(
      "MariaDB",
    );
    // Check for one of the destinations from the fixture
    expect(screen.getByTestId("connection-catalog-grid")).toHaveTextContent(
      "io.debezium.server.kafka.KafkaChangeConsumer",
    );
    expect(
      screen.getByText(new RegExp(`${defaultMergedCount}\\s+Items`)),
    ).toBeInTheDocument();
  });

  it("shows empty search state when no connectors match", async () => {

    render(<ConnectionsCatalog />);

    const searchInput = screen.getByPlaceholderText("Search by name");
    fireEvent.change(searchInput, { target: { value: "zzz" } });

    await waitFor(
      () => {
        expect(
          screen.getByText("No matching connection type is present"),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    fireEvent.click(screen.getByText("Clear all"));
    await waitFor(
      () => {
        expect(searchInput).toHaveValue("");
        expect(
          screen.getByText(new RegExp(`${defaultMergedCount}\\s+Items`)),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
