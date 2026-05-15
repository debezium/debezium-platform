import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CatalogGrid } from "./CatalogGrid";
import type { Catalog } from "src/apis/types";
import { render } from "../__test__/unit/test-utils";
import * as helpers from "../utils/helpers";

vi.mock("./ComponentImage", () => ({
  default: ({ connectorType }: { connectorType: string }) => (
    <span data-testid={`img-${connectorType}`} />
  ),
}));

const cat = (overrides: Partial<Catalog> = {}): Catalog => ({
  class: "mongodb",
  name: "MongoDB",
  description: "Document store",
  descriptor: "d",
  role: "source",
  ...overrides,
});

describe("CatalogGrid", () => {
  beforeEach(() => {
    vi.spyOn(helpers, "openDBZIssues").mockImplementation(() => {});
  });

  it("renders grid gallery with catalog cards (grid layout path)", () => {
    const onCardSelect = vi.fn();

    const { container } = render(
      <CatalogGrid
        onCardSelect={onCardSelect}
        catalogType="source"
        isAddButtonVisible={false}
        searchResult={[cat()]}
        displayType="grid"
      />,
    );

    expect(container.querySelector(".custom-gallery")).toBeInTheDocument();
    expect(screen.getByText("MongoDB")).toBeInTheDocument();
    expect(screen.getByTestId("img-mongodb")).toBeInTheDocument();
  });

  it("opens DBZ issues when request-new-resource grid card is clicked", () => {
    const onCardSelect = vi.fn();

    const { container } = render(
      <CatalogGrid
        onCardSelect={onCardSelect}
        catalogType="source"
        isAddButtonVisible
        searchResult={[]}
        displayType="grid"
      />,
    );

    const secondary = container.querySelector(
      ".catalog-grid-card-source.pf-m-secondary",
    );
    expect(secondary).toBeTruthy();
    fireEvent.click(secondary as HTMLElement);
    expect(helpers.openDBZIssues).toHaveBeenCalled();
  });

  it("renders request-new-resource card when isAddButtonVisible and opens issues on list row click", () => {
    const onCardSelect = vi.fn();

    render(
      <CatalogGrid
        onCardSelect={onCardSelect}
        catalogType="destination"
        isAddButtonVisible
        searchResult={[cat({ class: "kafka", name: "Kafka" })]}
        displayType="list"
      />,
    );

    expect(screen.getByText(/Request destination/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Request destination/i));
    expect(helpers.openDBZIssues).toHaveBeenCalled();
  });

  it("selects a list row and calls onCardSelect", () => {
    const onCardSelect = vi.fn();

    render(
      <CatalogGrid
        onCardSelect={onCardSelect}
        catalogType="source"
        isAddButtonVisible={false}
        searchResult={[cat()]}
        displayType="list"
      />,
    );

    const row = screen.getByText("MongoDB").closest("li");
    expect(row).toBeTruthy();
    fireEvent.click(row as HTMLElement);
    expect(onCardSelect).toHaveBeenCalledWith("mongodb");
  });
});
