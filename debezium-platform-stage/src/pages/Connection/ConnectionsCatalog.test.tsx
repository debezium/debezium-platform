/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn((queryKey) => {
      // Return different data based on query key
      if (queryKey === "sourceConnectorCatalog") {
        return {
          data: sourceCatalogRows,
          error: null,
          isLoading: false,
        };
      } else if (queryKey === "destinationConnectorCatalog") {
        return {
          data: catalogFixture.components["server-sink"].map((entry: any) => ({
            ...entry,
            role: "destination",
          })),
          error: null,
          isLoading: false,
        };
      }
      return { data: [], error: null, isLoading: false };
    }),
  };
});

vi.mock("@components/ConnectionCatalogGrid", () => ({
  ConnectionCatalogGrid: ({
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

  beforeEach(() => {
    vi.clearAllMocks();
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
