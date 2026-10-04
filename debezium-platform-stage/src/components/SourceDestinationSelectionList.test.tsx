/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "react-query";
import SourceDestinationSelectionList from "./SourceDestinationSelectionList";
import type { Source, Destination } from "../apis/apis";
import pipelinesMock from "../__mocks__/data/Pipelines.json";
import { render } from "../__test__/unit/test-utils";

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
  };
});

vi.mock("./ComponentImage", () => ({
  default: () => <span data-testid="connector-stub" />,
}));

const makeSource = (
  partial: Partial<Source> & Pick<Source, "id" | "name" | "type">
): Source => ({
  schema: "",
  vaults: [],
  config: {},
  ...partial,
});

const makeDestination = (
  partial: Partial<Destination> & Pick<Destination, "id" | "name" | "type">
): Destination => ({
  schema: "",
  vaults: [],
  config: {},
  ...partial,
});

describe("SourceDestinationSelectionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue({
      data: pipelinesMock,
      error: null,
      isLoading: false,
    } as any);
  });

  // ── Empty-state ────────────────────────────────────────────────────────────

  it("renders the source empty state when data is empty", () => {
    render(
      <SourceDestinationSelectionList
        tableType="source"
        data={[]}
        onSelection={vi.fn()}
      />
    );
    expect(
      screen.getByRole("heading", { name: /no source available/i })
    ).toBeInTheDocument();
  });

  it("renders the destination empty state when data is empty", () => {
    render(
      <SourceDestinationSelectionList
        tableType="destination"
        data={[]}
        onSelection={vi.fn()}
      />
    );
    expect(
      screen.getByRole("heading", { name: /no destination available/i })
    ).toBeInTheDocument();
  });

  // ── Row render & selection ─────────────────────────────────────────────────

  it("renders source rows and calls onSelection on click", () => {
    const onSelection = vi.fn();
    const row = makeSource({
      id: 1,
      name: "mongo-source",
      type: "io.debezium.connector.mongodb.MongoDbConnector",
    });

    render(
      <SourceDestinationSelectionList
        tableType="source"
        data={[row]}
        onSelection={onSelection}
      />
    );

    expect(screen.getByRole("cell", { name: "mongo-source" })).toBeInTheDocument();
    const [, dataRow] = screen.getAllByRole("row");
    fireEvent.click(dataRow);
    expect(onSelection).toHaveBeenCalledWith(row);
  });

  it("renders destination rows and calls onSelection on click", () => {
    const onSelection = vi.fn();
    const row = makeDestination({
      id: 2,
      name: "kafka-sink",
      type: "io.debezium.connector.kafka.KafkaSink",
    });

    render(
      <SourceDestinationSelectionList
        tableType="destination"
        data={[row]}
        onSelection={onSelection}
      />
    );

    expect(screen.getByRole("cell", { name: "kafka-sink" })).toBeInTheDocument();
    const [, dataRow] = screen.getAllByRole("row");
    fireEvent.click(dataRow);
    expect(onSelection).toHaveBeenCalledWith(row);
  });

  // ── Toolbar presence ───────────────────────────────────────────────────────

  it("renders a toolbar with a search input and filter selector when there is data", () => {
    const row = makeSource({
      id: 1,
      name: "mongo-source",
      type: "io.debezium.connector.mongodb.MongoDbConnector",
    });

    render(
      <SourceDestinationSelectionList
        tableType="source"
        data={[row]}
        onSelection={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/find by name/i)).toBeInTheDocument();
  });

  // ── Search by name ─────────────────────────────────────────────────────────

  it("filters rows by name as the user types", async () => {
    const rows = [
      makeSource({ id: 1, name: "mongo-source", type: "io.debezium.connector.mongodb.MongoDbConnector" }),
      makeSource({ id: 2, name: "postgres-source", type: "io.debezium.connector.postgresql.PostgresConnector" }),
    ];

    render(
      <SourceDestinationSelectionList
        tableType="source"
        data={rows}
        onSelection={vi.fn()}
      />
    );

    await userEvent.type(screen.getByPlaceholderText(/find by name/i), "postgres");

    await waitFor(() => {
      expect(screen.queryByRole("cell", { name: "mongo-source" })).not.toBeInTheDocument();
      expect(screen.getByRole("cell", { name: "postgres-source" })).toBeInTheDocument();
    });
  });

  // ── Search by type ─────────────────────────────────────────────────────────

  it("filters rows by type when the Type filter field is selected", async () => {
    const rows = [
      makeSource({ id: 1, name: "mongo-source", type: "io.debezium.connector.mongodb.MongoDbConnector" }),
      makeSource({ id: 2, name: "postgres-source", type: "io.debezium.connector.postgresql.PostgresConnector" }),
    ];

    render(
      <SourceDestinationSelectionList
        tableType="source"
        data={rows}
        onSelection={vi.fn()}
      />
    );

    // Switch filter field to "Type"
    await userEvent.click(screen.getByRole("button", { name: /name/i }));
    await userEvent.click(await screen.findByRole("option", { name: /^type$/i }));

    await userEvent.type(screen.getByPlaceholderText(/find by type/i), "postgresql");

    await waitFor(() => {
      expect(screen.queryByRole("cell", { name: "mongo-source" })).not.toBeInTheDocument();
      expect(screen.getByRole("cell", { name: "postgres-source" })).toBeInTheDocument();
    });
  });

  // ── No results ─────────────────────────────────────────────────────────────

  it("shows a no-results empty state when the search matches nothing", async () => {
    const row = makeSource({
      id: 1,
      name: "mongo-source",
      type: "io.debezium.connector.mongodb.MongoDbConnector",
    });

    render(
      <SourceDestinationSelectionList
        tableType="source"
        data={[row]}
        onSelection={vi.fn()}
      />
    );

    await userEvent.type(screen.getByPlaceholderText(/find by name/i), "zzznomatch");

    await waitFor(() => {
      expect(screen.queryByRole("cell", { name: "mongo-source" })).not.toBeInTheDocument();
    });
  });

  // ── Item count ─────────────────────────────────────────────────────────────

  it("shows correct item count with and without an active filter", async () => {
    const rows = [
      makeSource({ id: 1, name: "mongo-source", type: "io.debezium.connector.mongodb.MongoDbConnector" }),
      makeSource({ id: 2, name: "postgres-source", type: "io.debezium.connector.postgresql.PostgresConnector" }),
    ];

    render(
      <SourceDestinationSelectionList
        tableType="source"
        data={rows}
        onSelection={vi.fn()}
      />
    );

    // No filter → "2 items"
    expect(screen.getByText(/2 items/i)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/find by name/i), "mongo");

    // Filter active → "1 of 2 items"
    await waitFor(() => {
      expect(screen.getByText(/1 of 2 items/i)).toBeInTheDocument();
    });
  });

  // ── Field switch clears search ─────────────────────────────────────────────

  it("clears the search input and resets results when switching filter field", async () => {
    const rows = [
      makeSource({ id: 1, name: "mongo-source", type: "io.debezium.connector.mongodb.MongoDbConnector" }),
      makeSource({ id: 2, name: "postgres-source", type: "io.debezium.connector.postgresql.PostgresConnector" }),
    ];

    render(
      <SourceDestinationSelectionList
        tableType="source"
        data={rows}
        onSelection={vi.fn()}
      />
    );

    // Type a name query that hides postgres-source
    await userEvent.type(screen.getByPlaceholderText(/find by name/i), "mongo");
    await waitFor(() =>
      expect(screen.queryByRole("cell", { name: "postgres-source" })).not.toBeInTheDocument()
    );

    // Switch to "Type" — search should clear and both rows should reappear
    await userEvent.click(screen.getByRole("button", { name: /name/i }));
    await userEvent.click(await screen.findByRole("option", { name: /^type$/i }));

    await waitFor(() => {
      expect(screen.getByRole("cell", { name: "mongo-source" })).toBeInTheDocument();
      expect(screen.getByRole("cell", { name: "postgres-source" })).toBeInTheDocument();
    });
  });
});
