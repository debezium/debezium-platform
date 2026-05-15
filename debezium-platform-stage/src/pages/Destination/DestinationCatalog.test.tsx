import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DestinationCatalog } from "./DestinationCatalog";
import destinationCatalogFixture from "../../__mocks__/data/DestinationCatalog.json";
import { render } from "../../__test__/unit/test-utils";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@components/CatalogGrid", () => ({
  CatalogGrid: ({ searchResult }: { searchResult: { name: string }[] }) => (
    <div data-testid="destination-catalog-grid">
      {searchResult.map((c) => (
        <span key={c.name}>{c.name}</span>
      ))}
    </div>
  ),
}));

vi.mock("@components/PageTour", () => ({
  __esModule: true,
  default: () => null,
}));

describe("DestinationCatalog", () => {
  it("renders heading and static catalog entries", () => {
    render(<DestinationCatalog />);

    expect(screen.getByText("Destination catalog")).toBeInTheDocument();
    expect(screen.getByTestId("destination-catalog-grid")).toHaveTextContent(
      "Amazon Kinesis",
    );
    expect(
      screen.getByText(`${destinationCatalogFixture.length} Items`),
    ).toBeInTheDocument();
  });

  it("debounces search to filter visible connectors", async () => {
    render(<DestinationCatalog />);

    const searchInput = screen.getByPlaceholderText("Search by name");
    fireEvent.change(searchInput, { target: { value: "pulsar" } });

    await waitFor(
      () => {
        expect(screen.getByTestId("destination-catalog-grid")).toHaveTextContent(
          "Apache Pulsar",
        );
        expect(screen.queryByText("Amazon Kinesis")).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
