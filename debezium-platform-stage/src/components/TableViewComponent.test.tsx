import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import TableViewComponent, { EXPAND_ALL_MAX_TABLES, pinnedSchemaIndex } from "./TableViewComponent";
import { SelectedDataListItem, TableData } from "../apis/types";
import { render } from "../__test__/unit/test-utils";
import { ExplorerBinding, resolveExplorerBinding } from "../utils/Datatype";

const inventory: TableData = {
  catalogs: [
    {
      name: null,
      totalCollections: 4,
      schemas: [
        {
          name: "public",
          collectionCount: 4,
          collections: [
            { name: "customers", fullyQualifiedName: "public.customers" },
            { name: "orders", fullyQualifiedName: "public.orders" },
            { name: "order_items", fullyQualifiedName: "public.order_items" },
            { name: "products", fullyQualifiedName: "public.products" },
          ],
        },
      ],
    },
  ],
};

function Harness({
  onChange,
  collections = inventory,
  binding,
}: {
  onChange: (selection: SelectedDataListItem | undefined) => void;
  collections?: TableData;
  binding?: ExplorerBinding;
}) {
  const [selection, setSelection] = useState<SelectedDataListItem | undefined>({
    schemas: [],
    tables: [],
  });

  return (
    <TableViewComponent
      collections={collections}
      binding={binding}
      selectedDataListItems={selection}
      setSelectedDataListItems={(next) => {
        setSelection(next);
        onChange(next);
      }}
    />
  );
}

function checkbox(name: string): HTMLInputElement {
  return screen.getByRole("checkbox", { name: `Select ${name}` });
}

function searchBox(): HTMLElement {
  return screen.getByRole("searchbox", { name: "Search input example" });
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return 400;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return 400;
    },
  });
});

describe("TableViewComponent selection", () => {
  it("selects only visible tables when a filtered schema is checked", async () => {
    const user = userEvent.setup();
    let latest: SelectedDataListItem | undefined;
    render(<Harness onChange={(next) => { latest = next; }} />);

    await user.type(searchBox(), "order");
    await user.click(checkbox("public"));

    await waitFor(() => {
      expect(latest).toEqual({
        schemas: [],
        tables: ["public.orders", "public.order_items"],
        values: { "table.include.list": ["public.orders", "public.order_items"] },
      });
    });
    expect(checkbox("public").indeterminate).toBe(true);
    expect(checkbox("orders").checked).toBe(true);
    expect(checkbox("order_items").checked).toBe(true);

    await user.clear(searchBox());
    await user.click(screen.getByRole("button", { name: /^Expand$/ }));

    expect(checkbox("customers").checked).toBe(false);
    expect(checkbox("products").checked).toBe(false);
    expect(checkbox("public").indeterminate).toBe(true);
    expect(latest).toEqual({
      schemas: [],
      tables: ["public.orders", "public.order_items"],
      values: { "table.include.list": ["public.orders", "public.order_items"] },
    });
  });

  it("keeps a schema partial when every visible match is selected individually", async () => {
    const user = userEvent.setup();
    let latest: SelectedDataListItem | undefined;
    render(<Harness onChange={(next) => { latest = next; }} />);

    await user.type(searchBox(), "order");
    await user.click(checkbox("orders"));
    await user.click(checkbox("order_items"));

    await waitFor(() => {
      expect(latest).toEqual({
        schemas: [],
        tables: ["public.orders", "public.order_items"],
        values: { "table.include.list": ["public.orders", "public.order_items"] },
      });
    });
    expect(checkbox("public").indeterminate).toBe(true);

    await user.clear(searchBox());
    expect(checkbox("public").indeterminate).toBe(true);
  });

  it("unticks a schema while a search filter is active", async () => {
    const user = userEvent.setup();
    let latest: SelectedDataListItem | undefined;
    render(<Harness onChange={(next) => { latest = next; }} />);

    await screen.findByRole("checkbox", { name: "Select public" });
    await user.click(checkbox("public"));
    await waitFor(() => {
      expect(latest).toEqual({
        schemas: ["public"],
        tables: [],
        values: { "schema.include.list": ["public"] },
      });
    });

    await user.type(searchBox(), "order");
    expect(checkbox("public").checked).toBe(true);
    expect(checkbox("orders").checked).toBe(true);
    expect(checkbox("order_items").checked).toBe(true);

    await user.click(checkbox("public"));

    await waitFor(() => {
      expect(latest).toEqual({ schemas: [], tables: [], values: {} });
    });
    expect(checkbox("public").checked).toBe(false);
    expect(checkbox("public").indeterminate).toBe(false);
    expect(checkbox("orders").checked).toBe(false);
    expect(checkbox("order_items").checked).toBe(false);

    await user.clear(searchBox());
    await user.click(screen.getByRole("button", { name: /^Expand$/ }));
    expect(checkbox("customers").checked).toBe(false);
    expect(checkbox("products").checked).toBe(false);
  });

  it("selects every table when an unfiltered schema is checked", async () => {
    const user = userEvent.setup();
    let latest: SelectedDataListItem | undefined;
    render(<Harness onChange={(next) => { latest = next; }} />);

    await screen.findByRole("checkbox", { name: "Select public" });
    await user.click(checkbox("public"));

    await waitFor(() => {
      expect(latest).toEqual({
        schemas: ["public"],
        tables: [],
        values: { "schema.include.list": ["public"] },
      });
    });
    expect(checkbox("public").checked).toBe(true);
    expect(checkbox("public").indeterminate).toBe(false);
  });

  it("selects a database and fully qualified tables when the schema name is blank", async () => {
    const user = userEvent.setup();
    const collections: TableData = {
      catalogs: [
        {
          name: "inventory",
          totalCollections: 2,
          schemas: [
            {
              name: null,
              collectionCount: 2,
              collections: [
                { name: "customers", fullyQualifiedName: "inventory.customers" },
                { name: "orders", fullyQualifiedName: "inventory.orders" },
              ],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(
      [{ name: "database.include.list" }, { name: "table.include.list" }],
      collections,
    );
    let latest: SelectedDataListItem | undefined;
    render(
      <Harness
        collections={collections}
        binding={binding}
        onChange={(next) => { latest = next; }}
      />,
    );

    await screen.findByRole("checkbox", { name: "Select inventory" });
    await user.click(screen.getByRole("button", { name: "Expand" }));
    await user.click(checkbox("customers"));
    await waitFor(() => {
      expect(latest).toEqual({
        schemas: [],
        tables: ["inventory.customers"],
        values: { "table.include.list": ["inventory.customers"] },
      });
    });
  });

  it("writes the database name when a whole database is checked", async () => {
    const user = userEvent.setup();
    const collections: TableData = {
      catalogs: [
        {
          name: "inventory",
          totalCollections: 1,
          schemas: [
            {
              name: null,
              collectionCount: 1,
              collections: [{ name: "customers", fullyQualifiedName: "inventory.customers" }],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(
      [{ name: "database.include.list" }, { name: "table.include.list" }],
      collections,
    );
    let latest: SelectedDataListItem | undefined;
    render(
      <Harness
        collections={collections}
        binding={binding}
        onChange={(next) => { latest = next; }}
      />,
    );

    await screen.findByRole("checkbox", { name: "Select inventory" });
    await user.click(checkbox("inventory"));
    await waitFor(() => {
      expect(latest).toEqual({
        schemas: ["inventory"],
        tables: [],
        values: { "database.include.list": ["inventory"] },
      });
    });
  });

  it("writes collection fully qualified names for a mongo-shaped tree", async () => {
    const user = userEvent.setup();
    const collections: TableData = {
      catalogs: [
        {
          name: "inventory",
          totalCollections: 2,
          schemas: [
            {
              name: null,
              collectionCount: 2,
              collections: [
                { name: "customers", fullyQualifiedName: "inventory.customers" },
                { name: "orders", fullyQualifiedName: "inventory.orders" },
              ],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(
      [{ name: "database.include.list" }, { name: "collection.include.list" }],
      collections,
    );
    let latest: SelectedDataListItem | undefined;
    render(
      <Harness
        collections={collections}
        binding={binding}
        onChange={(next) => { latest = next; }}
      />,
    );

    await screen.findByRole("checkbox", { name: "Select inventory" });
    await user.click(screen.getByRole("button", { name: "Expand" }));
    await user.click(checkbox("customers"));
    await waitFor(() => {
      expect(latest).toEqual({
        schemas: [],
        tables: ["inventory.customers"],
        values: { "collection.include.list": ["inventory.customers"] },
      });
    });
  });

  it("selects child tables when a schema is not an include-list property", async () => {
    const user = userEvent.setup();
    const collections: TableData = {
      catalogs: [
        {
          name: "sales",
          totalCollections: 3,
          schemas: [
            {
              name: "dbo",
              collectionCount: 2,
              collections: [
                { name: "orders", fullyQualifiedName: "sales.dbo.orders" },
                { name: "customers", fullyQualifiedName: "sales.dbo.customers" },
              ],
            },
            {
              name: "audit",
              collectionCount: 1,
              collections: [{ name: "events", fullyQualifiedName: "sales.audit.events" }],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(
      [{ name: "database.include.list" }, { name: "table.include.list" }],
      collections,
    );
    let latest: SelectedDataListItem | undefined;
    render(
      <Harness
        collections={collections}
        binding={binding}
        onChange={(next) => { latest = next; }}
      />,
    );

    await screen.findByRole("checkbox", { name: "Select sales" });
    await user.click(screen.getByRole("button", { name: "Expand" }));
    await user.click(checkbox("dbo"));
    await waitFor(() => {
      expect(latest).toEqual({
        schemas: [],
        tables: ["sales.dbo.orders", "sales.dbo.customers"],
        values: { "table.include.list": ["sales.dbo.orders", "sales.dbo.customers"] },
      });
    });
  });

  it("writes the database name when every table in that database is selected together", async () => {
    const user = userEvent.setup();
    const collections: TableData = {
      catalogs: [
        {
          name: "sales",
          totalCollections: 1,
          schemas: [
            {
              name: "dbo",
              collectionCount: 1,
              collections: [{ name: "orders", fullyQualifiedName: "sales.dbo.orders" }],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(
      [{ name: "database.include.list" }, { name: "table.include.list" }],
      collections,
    );
    let latest: SelectedDataListItem | undefined;
    render(
      <Harness
        collections={collections}
        binding={binding}
        onChange={(next) => { latest = next; }}
      />,
    );

    await screen.findByRole("checkbox", { name: "Select sales" });
    await user.click(checkbox("sales"));
    await waitFor(() => {
      expect(latest).toEqual({
        schemas: ["sales"],
        tables: [],
        values: { "database.include.list": ["sales"] },
      });
    });
  });

  it("does not check a same-named database from a schema include list", async () => {
    const user = userEvent.setup();
    const collections: TableData = {
      catalogs: [
        {
          name: "public",
          totalCollections: 2,
          schemas: [
            {
              name: "app",
              collectionCount: 1,
              collections: [{ name: "orders", fullyQualifiedName: "public.app.orders" }],
            },
            {
              name: "audit",
              collectionCount: 1,
              collections: [{ name: "events", fullyQualifiedName: "public.audit.events" }],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(
      [
        { name: "database.include.list" },
        { name: "schema.include.list" },
        { name: "table.include.list" },
      ],
      collections,
    );

    render(
      <TableViewComponent
        collections={collections}
        binding={binding}
        selectedDataListItems={{
          schemas: ["public", "app"],
          tables: [],
          values: { "schema.include.list": ["app"] },
        }}
        setSelectedDataListItems={() => {}}
      />,
    );

    const database = await screen.findByRole("checkbox", { name: "Select public" });
    await user.click(screen.getByRole("button", { name: /^Expand$/ }));
    expect(database.checked).toBe(false);
    expect(database.indeterminate).toBe(true);
    expect(checkbox("app").checked).toBe(true);
    expect(checkbox("audit").checked).toBe(false);
  });

  it("keeps the database checkbox when a table name cannot be saved", async () => {
    const user = userEvent.setup();
    const collections: TableData = {
      catalogs: [
        {
          name: "sales",
          totalCollections: 2,
          schemas: [
            {
              name: "dbo",
              collectionCount: 1,
              collections: [{ name: "orders", fullyQualifiedName: "sales.dbo.orders" }],
            },
            {
              name: "audit",
              collectionCount: 1,
              collections: [{ name: "events", fullyQualifiedName: "sales.audit.events" }],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(
      [{ name: "database.include.list" }, { name: "schema.include.list" }],
      collections,
    );
    let latest: SelectedDataListItem | undefined;
    render(
      <Harness
        collections={collections}
        binding={binding}
        onChange={(next) => { latest = next; }}
      />,
    );

    const database = await screen.findByRole("checkbox", { name: "Select sales" });
    expect(database).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /^Expand$/ }));
    expect(checkbox("dbo")).toBeEnabled();
    expect(checkbox("audit")).toBeEnabled();

    await user.click(screen.getAllByRole("button", { name: /^Expand$/ })[0]);
    expect(checkbox("orders")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^Expand$/ }));
    expect(checkbox("events")).toBeDisabled();

    await user.click(database);
    await waitFor(() => {
      expect(latest).toEqual({
        schemas: ["sales"],
        tables: [],
        values: { "database.include.list": ["sales"] },
      });
    });
  });

  it("disables a schema folder when neither the schema nor its tables can be saved", async () => {
    const user = userEvent.setup();
    const collections: TableData = {
      catalogs: [
        {
          name: "sales",
          totalCollections: 2,
          schemas: [
            {
              name: "dbo",
              collectionCount: 1,
              collections: [{ name: "orders", fullyQualifiedName: "sales.dbo.orders" }],
            },
            {
              name: "audit",
              collectionCount: 1,
              collections: [{ name: "events", fullyQualifiedName: "sales.audit.events" }],
            },
          ],
        },
      ],
    };
    const binding = resolveExplorerBinding(
      [{ name: "database.include.list" }],
      collections,
    );

    render(
      <Harness collections={collections} binding={binding} onChange={() => {}} />,
    );

    expect(await screen.findByRole("checkbox", { name: "Select sales" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /^Expand$/ }));
    expect(checkbox("dbo")).toBeDisabled();
    expect(checkbox("audit")).toBeDisabled();
  });

  it("keeps a saved include value the tree cannot match until the user changes the selection", async () => {
    const user = userEvent.setup();
    let latest: SelectedDataListItem | undefined;
    const saved: SelectedDataListItem = {
      schemas: [],
      tables: ["public.orders", "missing.orders"],
      values: { "table.include.list": ["public.orders", "missing.orders"] },
    };
    render(
      <TableViewComponent
        collections={inventory}
        selectedDataListItems={saved}
        setSelectedDataListItems={(next) => { latest = next; }}
      />,
    );

    await screen.findByRole("checkbox", { name: "Select public" });
    await user.click(screen.getByRole("button", { name: /^Expand$/ }));
    expect(checkbox("orders").checked).toBe(true);
    expect(checkbox("customers").checked).toBe(false);
    expect(latest).toBeUndefined();

    await user.click(checkbox("customers"));
    await waitFor(() => {
      expect(latest).toEqual({
        schemas: [],
        tables: ["public.customers", "public.orders"],
        values: { "table.include.list": ["public.customers", "public.orders"] },
      });
    });
  });

  it("still collapses a saved selection when every saved table is in the tree", async () => {
    let latest: SelectedDataListItem | undefined;
    const tables = ["public.customers", "public.orders", "public.order_items", "public.products"];
    render(
      <TableViewComponent
        collections={inventory}
        selectedDataListItems={{
          schemas: [],
          tables,
          values: { "table.include.list": tables },
        }}
        setSelectedDataListItems={(next) => { latest = next; }}
      />,
    );

    await waitFor(() => {
      expect(latest).toEqual({
        schemas: ["public"],
        tables: [],
        values: { "schema.include.list": ["public"] },
      });
    });
  });
});

const twoSchemas: TableData = {
  catalogs: [
    {
      name: null,
      totalCollections: 4,
      schemas: [
        {
          name: "public",
          collectionCount: 2,
          collections: [
            { name: "orders", fullyQualifiedName: "public.orders" },
            { name: "customers", fullyQualifiedName: "public.customers" },
          ],
        },
        {
          name: "sales",
          collectionCount: 2,
          collections: [
            { name: "invoices", fullyQualifiedName: "sales.invoices" },
            { name: "payments", fullyQualifiedName: "sales.payments" },
          ],
        },
      ],
    },
  ],
};

function catalogWithTables(count: number): TableData {
  const collections = Array.from({ length: count }, (_, index) => ({
    name: `table_${index}`,
    fullyQualifiedName: `public.table_${index}`,
  }));
  return {
    catalogs: [
      {
        name: null,
        totalCollections: count,
        schemas: [
          {
            name: "public",
            collectionCount: count,
            collections,
          },
        ],
      },
    ],
  };
}

describe("TableViewComponent navigation", () => {
  it("collapses and expands a schema while a search is active", async () => {
    const user = userEvent.setup();
    render(
      <TableViewComponent
        collections={twoSchemas}
        selectedDataListItems={{ schemas: [], tables: [] }}
        setSelectedDataListItems={() => {}}
      />
    );

    await user.type(searchBox(), "order");
    expect(checkbox("orders")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Collapse$/ }));
    expect(screen.queryByRole("checkbox", { name: "Select orders" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Expand$/ }));
    expect(checkbox("orders")).toBeInTheDocument();

    await user.clear(searchBox());
    expect(screen.queryByRole("checkbox", { name: "Select orders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select invoices" })).not.toBeInTheDocument();
    expect(checkbox("public")).toBeInTheDocument();
    expect(checkbox("sales")).toBeInTheDocument();
  });

  it("collapses and expands every match from the toolbar while searching", async () => {
    const user = userEvent.setup();
    render(<Harness onChange={() => {}} />);

    await user.type(searchBox(), "order");
    expect(screen.getByText("2 tables in 1 schema")).toBeInTheDocument();
    expect(checkbox("orders")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Collapse all$/ }));
    expect(screen.queryByRole("checkbox", { name: "Select orders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select order_items" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Expand all$/ }));
    expect(checkbox("orders")).toBeInTheDocument();
    expect(checkbox("order_items")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.queryByText("2 tables in 1 schema")).not.toBeInTheDocument();
    expect(searchBox()).toHaveValue("");
    expect(checkbox("public")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select orders" })).not.toBeInTheDocument();
  });

  it("shows selected and total table counts on each schema", async () => {
    const user = userEvent.setup();
    render(<Harness onChange={() => {}} />);

    expect(await screen.findByText("(0/4)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Expand$/ }));
    await user.click(checkbox("orders"));
    expect(screen.getByText("(1/4)")).toBeInTheDocument();

    await user.click(checkbox("public"));
    expect(screen.getByText("(4/4)")).toBeInTheDocument();
  });

  it("shows an empty state and restores the tree when search is cleared", async () => {
    const user = userEvent.setup();
    render(<Harness onChange={() => {}} />);

    await user.type(searchBox(), "zzzz");
    expect(screen.getByText("No matching tables")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select public" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.queryByText("No matching tables")).not.toBeInTheDocument();
    expect(checkbox("public")).toBeInTheDocument();
  });

  it("summarizes a fully selected schema without listing its tables", async () => {
    const user = userEvent.setup();
    render(<Harness onChange={() => {}} />);

    expect(screen.getByText("No tables selected")).toBeInTheDocument();
    await screen.findByRole("checkbox", { name: "Select public" });
    await user.click(checkbox("public"));

    const summary = (await screen.findByText("Selected")).closest(".virtual-tree__summary");
    expect(summary).toHaveTextContent("1 schema");
    expect(summary).not.toHaveTextContent("public");
    expect(summary).not.toHaveTextContent("customers");

    await user.click(screen.getByRole("button", { name: "View selection" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("public");
    expect(dialog).toHaveTextContent("4/4");
    expect(dialog).not.toHaveTextContent("customers");
    expect(screen.queryByRole("button", { name: "Expand public" })).not.toBeInTheDocument();
  });

  it("summarizes a single selected table by schema in the selection list", async () => {
    const user = userEvent.setup();
    render(<Harness onChange={() => {}} />);

    await screen.findByRole("checkbox", { name: "Select public" });
    await user.click(screen.getByRole("button", { name: /^Expand$/ }));
    await user.click(checkbox("orders"));

    const summary = (await screen.findByText("Selected")).closest(".virtual-tree__summary");
    expect(summary).toHaveTextContent("1 table");
    expect(summary).not.toHaveTextContent("public.orders");

    await user.click(screen.getByRole("button", { name: "View selection" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("public");
    expect(dialog).toHaveTextContent("1");
    expect(dialog).not.toHaveTextContent("1/4");
    expect(dialog).not.toHaveTextContent("orders");
    expect(screen.queryByRole("button", { name: "Expand public" })).not.toBeInTheDocument();
  });

  it("keeps a long selection out of the summary and lists schema counts on request", async () => {
    const user = userEvent.setup();
    const tables = Array.from({ length: 9 }, (_, index) => `public.table_${index}`);
    render(
      <TableViewComponent
        collections={catalogWithTables(10)}
        selectedDataListItems={{ schemas: [], tables }}
        setSelectedDataListItems={() => {}}
      />
    );

    const summary = (await screen.findByText("Selected")).closest(".virtual-tree__summary");
    expect(summary).toHaveTextContent("9 tables");
    expect(summary).not.toHaveTextContent("public");
    expect(summary).not.toHaveTextContent("table_0");

    await user.click(screen.getByRole("button", { name: "View selection" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("public");
    expect(dialog).toHaveTextContent("9");
    expect(dialog).not.toHaveTextContent("9/9");
    expect(dialog).not.toHaveTextContent("table_0");
    expect(screen.queryByRole("button", { name: "Expand public" })).not.toBeInTheDocument();
  });

  it("groups a fully included schema separately from partial tables", async () => {
    const user = userEvent.setup();
    render(
      <TableViewComponent
        collections={twoSchemas}
        selectedDataListItems={{ schemas: ["public"], tables: ["sales.invoices"] }}
        setSelectedDataListItems={() => {}}
      />
    );

    const summary = (await screen.findByText("Selected")).closest(".virtual-tree__summary");
    expect(summary).toHaveTextContent("1 schema");
    expect(summary).toHaveTextContent("1 table");
    expect(summary).not.toHaveTextContent("invoices");

    await user.click(screen.getByRole("button", { name: "View selection" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("public");
    expect(dialog).toHaveTextContent("2/2");
    expect(dialog).toHaveTextContent("sales");
    expect(dialog).toHaveTextContent("1");
    expect(dialog).not.toHaveTextContent("1/1");
    expect(dialog).not.toHaveTextContent("invoices");
    expect(dialog).not.toHaveTextContent("orders");
    expect(screen.queryByRole("button", { name: "Expand sales" })).not.toBeInTheDocument();
  });

  it("disables expand all above the table limit and still collapses an open search", async () => {
    const user = userEvent.setup();
    render(
      <TableViewComponent
        collections={catalogWithTables(EXPAND_ALL_MAX_TABLES + 1)}
        selectedDataListItems={{ schemas: [], tables: [] }}
        setSelectedDataListItems={() => {}}
      />
    );

    await screen.findByRole("checkbox", { name: "Select public" });
    const expandAll = screen.getByRole("button", { name: /^Expand all$/ });
    expect(expandAll).toBeDisabled();
    expect(screen.queryByRole("checkbox", { name: "Select table_0" })).not.toBeInTheDocument();

    await user.type(searchBox(), "t");
    expect(checkbox("table_0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Collapse all$/ }));
    expect(screen.queryByRole("checkbox", { name: "Select table_0" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Expand all$/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^Expand$/ }));
    expect(checkbox("table_0")).toBeInTheDocument();
  });

  it("expands a catalog under the table limit", async () => {
    const user = userEvent.setup();
    render(<Harness onChange={() => {}} />);

    await user.click(screen.getByRole("button", { name: /^Expand all$/ }));
    expect(checkbox("customers")).toBeInTheDocument();
    expect(checkbox("products")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Collapse all$/ }));
    expect(screen.queryByRole("checkbox", { name: "Select customers" })).not.toBeInTheDocument();
  });
});

describe("pinnedSchemaIndex", () => {
  const rows = [
    { depth: 0 },
    { depth: 1 },
    { depth: 0 },
    { depth: 1 },
  ];

  it("stays unpinned when the first schema header is at the top", () => {
    expect(pinnedSchemaIndex(rows, 0, 36)).toBeNull();
  });

  it("pins the schema whose header has scrolled off while its tables remain", () => {
    expect(pinnedSchemaIndex(rows, 36, 36)).toBe(0);
  });

  it("moves the pin to the next schema after the section boundary", () => {
    expect(pinnedSchemaIndex(rows, 73, 36)).toBe(2);
    expect(pinnedSchemaIndex(rows, 72, 36)).toBeNull();
  });
});
