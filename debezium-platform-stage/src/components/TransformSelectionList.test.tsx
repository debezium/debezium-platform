/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "react-query";
import TransformSelectionList from "./TransformSelectionList";
import type { TransformData } from "../apis/apis";
import pipelinesMock from "../__mocks__/data/Pipelines.json";
import { render } from "../__test__/unit/test-utils";

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
  };
});

const makeRow = (partial: Partial<TransformData> & Pick<TransformData, "id" | "name" | "type">): TransformData => ({
  schema: "",
  vaults: [],
  config: {},
  ...partial,
});

describe("TransformSelectionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue({
      data: pipelinesMock,
      error: null,
      isLoading: false,
    } as any);
  });

  it("renders empty state when there are no transforms", () => {
    const onSelection = vi.fn();
    render(<TransformSelectionList data={[]} onSelection={onSelection} />);

    expect(
      screen.getByRole("heading", { name: /no transform available/i }),
    ).toBeInTheDocument();
  });

  it("renders table rows and invokes onSelection on row click", () => {
    const onSelection = vi.fn();
    const row = makeRow({
      id: 6,
      name: "filter-transform",
      type: "io.debezium.transforms.Filter",
    });

    render(<TransformSelectionList data={[row]} onSelection={onSelection} />);

    expect(screen.getByRole("cell", { name: "filter-transform" })).toBeInTheDocument();
    const [, dataRow] = screen.getAllByRole("row");
    fireEvent.click(dataRow);
    expect(onSelection).toHaveBeenCalledWith([row]);
  });

  it("renders a toolbar with a search input and filter selector", () => {
    const row = makeRow({ id: 1, name: "my-transform", type: "io.debezium.transforms.Filter" });
    render(<TransformSelectionList data={[row]} onSelection={vi.fn()} />);

    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/find by name/i)).toBeInTheDocument();
  });

  it("filters rows by name as the user types", async () => {
    const rows = [
      makeRow({ id: 1, name: "filter-transform", type: "io.debezium.transforms.Filter" }),
      makeRow({ id: 2, name: "router-transform", type: "io.debezium.transforms.Router" }),
    ];
    render(<TransformSelectionList data={rows} onSelection={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/find by name/i);
    await userEvent.type(searchInput, "router");

    await waitFor(() => {
      expect(screen.queryByRole("cell", { name: "filter-transform" })).not.toBeInTheDocument();
      expect(screen.getByRole("cell", { name: "router-transform" })).toBeInTheDocument();
    });
  });

  it("filters rows by type when the Type filter field is selected", async () => {
    const rows = [
      makeRow({ id: 1, name: "filter-transform", type: "io.debezium.transforms.Filter" }),
      makeRow({ id: 2, name: "router-transform", type: "io.debezium.transforms.Router" }),
    ];
    render(<TransformSelectionList data={rows} onSelection={vi.fn()} />);

    // Open the filter dropdown and pick "Type"
    const filterToggle = screen.getByRole("button", { name: /name/i });
    await userEvent.click(filterToggle);
    const typeOption = await screen.findByRole("option", { name: /^type$/i });
    await userEvent.click(typeOption);

    // Now the placeholder should reflect the new field
    const searchInput = screen.getByPlaceholderText(/find by type/i);
    await userEvent.type(searchInput, "Router");

    await waitFor(() => {
      expect(screen.queryByRole("cell", { name: "filter-transform" })).not.toBeInTheDocument();
      expect(screen.getByRole("cell", { name: "router-transform" })).toBeInTheDocument();
    });
  });

  it("shows a no-results empty state when the search matches nothing", async () => {
    const row = makeRow({ id: 1, name: "filter-transform", type: "io.debezium.transforms.Filter" });
    render(<TransformSelectionList data={[row]} onSelection={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/find by name/i);
    await userEvent.type(searchInput, "zzznomatch");

    await waitFor(() => {
      expect(screen.queryByRole("cell", { name: "filter-transform" })).not.toBeInTheDocument();
    });
  });

  it("shows correct item count with and without an active filter", async () => {
    const rows = [
      makeRow({ id: 1, name: "filter-transform", type: "io.debezium.transforms.Filter" }),
      makeRow({ id: 2, name: "router-transform", type: "io.debezium.transforms.Router" }),
    ];
    render(<TransformSelectionList data={rows} onSelection={vi.fn()} />);

    // No filter active → "2 items"
    expect(screen.getByText(/2 items/i)).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/find by name/i);
    await userEvent.type(searchInput, "router");

    // Filter active → "1 of 2 items"
    await waitFor(() => {
      expect(screen.getByText(/1 of 2 items/i)).toBeInTheDocument();
    });
  });

  it("disables connector-specific rows that do not match the selected source", () => {
    const onSelection = vi.fn();
    const rows = [
      makeRow({
        id: 1,
        name: "pg-smt",
        type: "io.debezium.connector.postgresql.transforms.TimescaleDb",
      }),
      makeRow({
        id: 2,
        name: "mongo-smt",
        type: "io.debezium.connector.mongodb.transforms.ExtractNewDocumentState",
      }),
      makeRow({
        id: 3,
        name: "generic-smt",
        type: "io.debezium.transforms.Filter",
      }),
    ];

    render(
      <TransformSelectionList
        data={rows}
        onSelection={onSelection}
        sourceType="io.debezium.connector.postgresql.PostgresConnector"
      />
    );

    const rowsEls = screen.getAllByRole("row");
    // header + 3 data rows
    fireEvent.click(rowsEls[2]); // mongo — incompatible
    expect(onSelection).not.toHaveBeenCalled();

    fireEvent.click(rowsEls[1]); // postgres — compatible
    expect(onSelection).toHaveBeenCalledWith([rows[0]]);

    fireEvent.click(rowsEls[3]); // generic — always compatible
    expect(onSelection).toHaveBeenCalledWith([rows[2]]);
  });
});
