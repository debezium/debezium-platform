import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import TableViewComponent from "./TableViewComponent";
import { SelectedDataListItem, TableData } from "../apis/types";
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
    await user.click(screen.getByRole("button", { name: "Expand" }));

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
    await user.click(screen.getByRole("button", { name: "Expand" }));
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
});
