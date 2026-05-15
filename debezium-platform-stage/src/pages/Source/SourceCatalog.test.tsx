/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "react-query";
import { SourceCatalog } from "./SourceCatalog";
import sourceCatalogFixture from "../../__mocks__/data/SourceCatalog.json";
import { render } from "../../__test__/unit/test-utils";

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
    <div data-testid="source-catalog-grid">
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

describe("SourceCatalog", () => {
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

    render(<SourceCatalog />);
    expect(screen.getByTestId("catalog-skeleton")).toBeInTheDocument();
  });

  it("shows error alert when catalog query fails", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: new Error("network failed"),
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(<SourceCatalog />);
    expect(screen.getByText("Failed to load source catalog")).toBeInTheDocument();
    expect(screen.getByText("network failed")).toBeInTheDocument();
  });

  it("renders catalog grid with connector names when loaded", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: sourceCatalogFixture as any,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(<SourceCatalog />);

    expect(screen.getByText("Source catalog")).toBeInTheDocument();
    expect(screen.getByTestId("source-catalog-grid")).toHaveTextContent("MongoDB");
    expect(screen.getByText(`${sourceCatalogFixture.length} Items`)).toBeInTheDocument();
  });

  it("debounces search input", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: sourceCatalogFixture as any,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(<SourceCatalog />);

    const searchInput = screen.getByPlaceholderText("Search by name");
    fireEvent.change(searchInput, { target: { value: "mongo" } });

    await waitFor(
      () => {
        expect(screen.getByTestId("source-catalog-grid")).toHaveTextContent("MongoDB");
        expect(screen.queryByText("MariaDB")).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
