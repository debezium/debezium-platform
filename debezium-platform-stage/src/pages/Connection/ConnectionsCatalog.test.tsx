/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "react-query";
import { ConnectionsCatalog } from "./ConnectionsCatalog";
import type { Catalog } from "../../apis/types";
import destinationCatalogFixture from "../../__mocks__/data/DestinationCatalog.json";
import { render } from "../../__test__/unit/test-utils";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
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

const catalogRows: Catalog[] = [
  {
    class: "mariadb",
    name: "MariaDB",
    description: "d",
    descriptor: "desc",
    role: "source",
  },
  {
    class: "kinesis",
    name: "Amazon Kinesis",
    description: "d",
    descriptor: "desc2",
    role: "destination",
  },
];

describe("ConnectionsCatalog", () => {
  const defaultMergedCount =
    catalogRows.length + destinationCatalogFixture.length;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and merged catalog entries", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: catalogRows,
      error: null,
      isLoading: false,
    } as any);

    render(<ConnectionsCatalog />);

    expect(screen.getByText("Connection catalog")).toBeInTheDocument();
    expect(screen.getByTestId("connection-catalog-grid")).toHaveTextContent(
      "MariaDB",
    );
    expect(screen.getByTestId("connection-catalog-grid")).toHaveTextContent(
      "Amazon Kinesis",
    );
    expect(
      screen.getByText(new RegExp(`${defaultMergedCount}\\s+Items`)),
    ).toBeInTheDocument();
  });

  it("shows empty search state when no connectors match", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: catalogRows,
      error: null,
      isLoading: false,
    } as any);

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
