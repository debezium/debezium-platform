import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConnectionCatalogGrid } from "./ConnectionCatalogGrid";
import type { Catalog } from "src/apis/types";
import { render } from "../__test__/unit/test-utils";

vi.mock("./ComponentImage", () => ({
  default: ({ connectorType }: { connectorType: string }) => (
    <span data-testid={`img-${connectorType}`} />
  ),
}));

const item = (overrides: Partial<Catalog> = {}): Catalog => ({
  class: "postgresql",
  name: "PostgreSQL",
  description: "Relational database",
  descriptor: "d",
  role: "source",
  ...overrides,
});

describe("ConnectionCatalogGrid", () => {
  it("renders grid cards and calls onCardSelect with class and role", () => {
    const onCardSelect = vi.fn();
    const catalog = [item(), item({ class: "kafka", name: "Kafka", role: "destination" })];

    render(
      <ConnectionCatalogGrid
        onCardSelect={onCardSelect}
        searchResult={catalog}
        displayType="grid"
      />,
    );

    fireEvent.click(screen.getByText("PostgreSQL"));
    expect(onCardSelect).toHaveBeenCalledWith("postgresql", "source");

    fireEvent.click(screen.getByText("Kafka"));
    expect(onCardSelect).toHaveBeenCalledWith("kafka", "destination");
  });

  it("renders list rows and calls onCardSelect", () => {
    const onCardSelect = vi.fn();
    const catalog = [item({ class: "mysql", name: "MySQL" })];

    render(
      <ConnectionCatalogGrid
        onCardSelect={onCardSelect}
        searchResult={catalog}
        displayType="list"
      />,
    );

    fireEvent.click(screen.getByText("MySQL"));
    expect(onCardSelect).toHaveBeenCalledWith("mysql", "source");
  });

  it("renders destination subtitle in list mode", () => {
    render(
      <ConnectionCatalogGrid
        onCardSelect={vi.fn()}
        searchResult={[item({ class: "kafka", name: "Kafka", role: "destination" })]}
        displayType="list"
      />,
    );

    expect(screen.getByText("Kafka")).toBeInTheDocument();
    expect(screen.getByText(/Destinations connection/i)).toBeInTheDocument();
  });
});
