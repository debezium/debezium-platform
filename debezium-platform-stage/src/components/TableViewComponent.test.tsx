import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import TableViewComponent, { EXPAND_ALL_MAX_TABLES, pinnedSchemaIndex } from "./TableViewComponent";
import { SelectedDataListItem, TableData } from "../apis/types";
import { render } from "../__test__/unit/test-utils";

const inventory: TableData = {
  catalogs: [
    {
      name: "inventory",
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
}: {
  onChange: (selection: SelectedDataListItem | undefined) => void;
}) {
  const [selection, setSelection] = useState<SelectedDataListItem | undefined>({
    schemas: [],
    tables: [],
  });

  return (
    <TableViewComponent
      collections={inventory}
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
      expect(latest).toEqual({ schemas: ["public"], tables: [] });
    });

    await user.type(searchBox(), "order");
    expect(checkbox("public").checked).toBe(true);
    expect(checkbox("orders").checked).toBe(true);
    expect(checkbox("order_items").checked).toBe(true);

    await user.click(checkbox("public"));

    await waitFor(() => {
      expect(latest).toEqual({ schemas: [], tables: [] });
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
      expect(latest).toEqual({ schemas: ["public"], tables: [] });
    });
    expect(checkbox("public").checked).toBe(true);
    expect(checkbox("public").indeterminate).toBe(false);
  });
});

const twoSchemas: TableData = {
  catalogs: [
    {
      name: "inventory",
      totalCollections: 3,
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
          collectionCount: 1,
          collections: [
            { name: "invoices", fullyQualifiedName: "sales.invoices" },
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
        name: "inventory",
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
        collections={catalogWithTables(9)}
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
