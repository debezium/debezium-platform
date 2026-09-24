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

const renderList = (
  data: TransformData[],
  extra: {
    onSelection?: (selection: TransformData[]) => void;
    onCopy?: (transform: TransformData) => void;
    sourceType?: string;
  } = {}
) => {
  const onSelection = extra.onSelection ?? vi.fn();
  const onCopy = extra.onCopy ?? vi.fn();
  return {
    onSelection,
    onCopy,
    ...render(
      <TransformSelectionList
        data={data}
        onSelection={onSelection}
        onCopy={onCopy}
        sourceType={extra.sourceType}
      />
    ),
  };
};

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
    render(<TransformSelectionList data={[]} onSelection={onSelection} onCopy={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: /no transform available/i }),
    ).toBeInTheDocument();
  });

  it("renders table rows and invokes onSelection on row click", () => {
    const row = makeRow({
      id: 6,
      name: "filter-transform",
      type: "io.debezium.transforms.Filter",
    });

    const { onSelection } = renderList([row]);

    expect(screen.getByRole("cell", { name: "filter-transform" })).toBeInTheDocument();
    const [, dataRow] = screen.getAllByRole("row");
    fireEvent.click(dataRow);
    expect(onSelection).toHaveBeenCalledWith([row]);
  });

  it("invokes onCopy from Copy without attaching the original", () => {
    const row = makeRow({
      id: 1,
      name: "unused-transform",
      type: "io.debezium.transforms.Filter",
    });
    const { onCopy, onSelection } = renderList([row]);

    fireEvent.click(screen.getByRole("button", { name: /^copy$/i }));
    expect(onCopy).toHaveBeenCalledWith(row);
    expect(onSelection).not.toHaveBeenCalled();
  });

  it("makes Copy the primary action when Used in is 2 or more", () => {
    const row = makeRow({
      id: 6,
      name: "filter-transform",
      type: "io.debezium.transforms.Filter",
    });
    vi.mocked(useQuery).mockReturnValue({
      data: [
        { ...pipelinesMock[0], id: 1, transforms: [{ id: 6, name: "filter-transform" }] },
        { ...pipelinesMock[0], id: 2, name: "second", transforms: [{ id: 6, name: "filter-transform" }] },
      ],
      error: null,
      isLoading: false,
    } as any);

    renderList([row]);

    expect(screen.getByRole("button", { name: /^copy$/i })).toHaveClass("pf-m-primary");
    expect(screen.getByText(/shared with 2 pipelines/i)).toBeInTheDocument();
  });

  it("keeps Copy secondary when the transform is unused", () => {
    const row = makeRow({
      id: 99,
      name: "unused-transform",
      type: "io.debezium.transforms.Filter",
    });
    renderList([row]);

    expect(screen.getByRole("button", { name: /^copy$/i })).toHaveClass("pf-m-secondary");
  });

  it("shows a shared-transform helper when any row is used in a pipeline", () => {
    const row = makeRow({
      id: 6,
      name: "filter-transform",
      type: "io.debezium.transforms.Filter",
    });
    renderList([row]);

    expect(
      screen.getByText(/transforms already used by other pipelines are shared/i),
    ).toBeInTheDocument();
  });

  it("renders a toolbar with a search input and filter selector", () => {
    const row = makeRow({ id: 1, name: "my-transform", type: "io.debezium.transforms.Filter" });
    renderList([row]);

    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/find by name/i)).toBeInTheDocument();
  });

  it("filters rows by name as the user types", async () => {
    const rows = [
      makeRow({ id: 1, name: "filter-transform", type: "io.debezium.transforms.Filter" }),
      makeRow({ id: 2, name: "router-transform", type: "io.debezium.transforms.Router" }),
    ];
    renderList(rows);

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
    renderList(rows);

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
    renderList([row]);

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
    renderList(rows);

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

    const { onSelection, onCopy } = renderList(rows, {
      sourceType: "io.debezium.connector.postgresql.PostgresConnector",
    });

    const mongoRow = screen.getByRole("cell", { name: "mongo-smt" }).closest("tr");
    expect(mongoRow).toBeTruthy();
    expect(mongoRow?.querySelector("button")).toBeNull();

    const rowsEls = screen.getAllByRole("row");
    fireEvent.click(rowsEls[2]); // mongo — incompatible
    expect(onSelection).not.toHaveBeenCalled();

    fireEvent.click(rowsEls[1]); // postgres — compatible
    expect(onSelection).toHaveBeenCalledWith([rows[0]]);

    fireEvent.click(rowsEls[3]); // generic — always compatible
    expect(onSelection).toHaveBeenCalledWith([rows[2]]);

    fireEvent.click(screen.getAllByRole("button", { name: /^copy$/i })[0]);
    expect(onCopy).toHaveBeenCalledWith(rows[0]);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});
