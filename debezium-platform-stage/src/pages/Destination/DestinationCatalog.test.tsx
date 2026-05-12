/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "react-query";
import { DestinationCatalog } from "./DestinationCatalog";
import { render } from "../../__test__/unit/test-utils";
import catalogFixture from "../../__fixtures__/catalog.json";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
  };
});

vi.mock("@components/CatalogGrid", () => ({
  CatalogGrid: ({ searchResult }: { searchResult: { name: string }[] }) => (
    <div data-testid="destination-catalog-grid">
      {searchResult.map((c) => (
        <span key={c.name}>{c.name}</span>
      ))}
    </div>
  ),
}));

vi.mock("@components/CatalogSkeleton", () => ({
  __esModule: true,
  default: () => <div data-testid="catalog-skeleton" />,
}));

vi.mock("@components/PageTour", () => ({
  __esModule: true,
  default: () => null,
}));

// Extract destination catalog from fixture
const destinationCatalogFixture = (catalogFixture.components["server-sink"] ?? []).map((entry) => ({
  ...entry,
  role: "destination",
}));

describe("DestinationCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton while catalog is loading", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      refetch: vi.fn(),
    } as any);

    render(<DestinationCatalog />);
    expect(screen.getByTestId("catalog-skeleton")).toBeInTheDocument();
  });

  it("shows error alert when catalog query fails", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: new Error("network failed"),
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(<DestinationCatalog />);
    expect(screen.getByText("Failed to load destination catalog")).toBeInTheDocument();
    expect(screen.getByText("network failed")).toBeInTheDocument();
  });

  it("renders catalog grid with connector names when loaded", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: destinationCatalogFixture as any,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(<DestinationCatalog />);

    expect(screen.getByText("Destination catalog")).toBeInTheDocument();
    expect(screen.getByTestId("destination-catalog-grid")).toHaveTextContent(
      "io.debezium.server.kafka.KafkaChangeConsumer",
    );
    expect(
      screen.getByText(`${destinationCatalogFixture.length} Items`),
    ).toBeInTheDocument();
  });

  it("debounces search to filter visible connectors", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: destinationCatalogFixture as any,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(<DestinationCatalog />);

    const searchInput = screen.getByPlaceholderText("Search by name");
    fireEvent.change(searchInput, { target: { value: "pulsar" } });

    await waitFor(
      () => {
        expect(screen.getByTestId("destination-catalog-grid")).toHaveTextContent(
          "io.debezium.server.pulsar.PulsarChangeConsumer",
        );
        expect(screen.queryByText("io.debezium.server.kafka.KafkaChangeConsumer")).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
