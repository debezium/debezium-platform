import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import AdditionalProperties from "./AdditionalProperties";
import { render } from "../__test__/unit/test-utils";

describe("AdditionalProperties", () => {
  it("renders rows, value input, remove, and add property", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onDelete = vi.fn();
    const onChange = vi.fn();

    const properties = new Map([
      ["row-1", { key: "k1", value: "v1" }],
    ]);

    render(
      <AdditionalProperties
        properties={properties}
        schemaPropertyNames={["k1", "k2"]}
        onAdd={onAdd}
        onDelete={onDelete}
        onChange={onChange}
        errorKeys={[]}
      />,
    );

    expect(screen.getByDisplayValue("v1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onDelete).toHaveBeenCalledWith("row-1");

    await user.click(screen.getByRole("button", { name: /add property/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it("hides remove and add when readOnly", () => {
    render(
      <AdditionalProperties
        properties={new Map([["r", { key: "a", value: "b" }]])}
        schemaPropertyNames={[]}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onChange={vi.fn()}
        errorKeys={[]}
        readOnly
      />,
    );

    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add property/i })).not.toBeInTheDocument();
  });

  it("marks value input error when id is in errorKeys", () => {
    render(
      <AdditionalProperties
        properties={new Map([["row-e", { key: "x", value: "" }]])}
        schemaPropertyNames={[]}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onChange={vi.fn()}
        errorKeys={["row-e"]}
      />,
    );

    const valueInput = screen.getByPlaceholderText("Value");
    expect(valueInput).toHaveAttribute("aria-invalid", "true");
  });
});
