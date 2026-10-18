import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import TableViewComponent from "./TableViewComponent";
import { SelectedDataListItem, TableData } from "../apis/types";

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
    await user.click(screen.getByRole("button", { name: "Expand" }));

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
