import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SchemaField from "./SchemaField";
import type { SchemaProperty } from "../apis/types";
import { render } from "../__test__/unit/test-utils";

const baseDisplay = {
  label: "Host",
  description: "Database host",
  group: "g",
  groupOrder: 0,
};

describe("SchemaField", () => {
  it("renders a text input and calls onChange", () => {
    const onChange = vi.fn();
    const property: SchemaProperty = {
      name: "host",
      type: "string",
      display: baseDisplay,
      validation: [],
      valueDependants: [],
    };

    render(
      <SchemaField property={property} value="localhost" onChange={onChange} />,
    );

    const input = screen.getByRole("textbox", { name: "Host" });
    fireEvent.change(input, { target: { value: "db.example.com" } });
    expect(onChange).toHaveBeenCalledWith("host", "db.example.com");

    const helpButton = screen.getByRole("button", { name: "More info for Host" });
    fireEvent.click(helpButton);
    expect(screen.getByText("Database host")).toBeInTheDocument();
  });

  it("pre-selects schema default in enum FormSelect", () => {
    const property: SchemaProperty = {
      name: "snapshot.mode",
      type: "string",
      default: "initial",
      display: { ...baseDisplay, label: "Snapshot mode" },
      validation: [{ type: "enum", values: ["initial", "never"] }],
      valueDependants: [],
    };

    render(<SchemaField property={property} value="initial" onChange={vi.fn()} />);

    const select = screen.getByRole("combobox", { name: "Snapshot mode" });
    expect(select).toHaveValue("initial");
    expect(screen.queryByText("Select an option")).not.toBeInTheDocument();
  });

  it("renders enum as FormSelect", () => {
    const onChange = vi.fn();
    const property: SchemaProperty = {
      name: "mode",
      type: "string",
      display: { ...baseDisplay, label: "Mode" },
      validation: [{ type: "enum", values: ["a", "b"] }],
      valueDependants: [],
    };

    render(<SchemaField property={property} value="a" onChange={onChange} />);

    expect(screen.getByRole("combobox", { name: "Mode" })).toBeInTheDocument();
  });

  it("renders boolean as switch", () => {
    const onChange = vi.fn();
    const property: SchemaProperty = {
      name: "ssl",
      type: "boolean",
      display: { ...baseDisplay, label: "SSL" },
      validation: [],
      valueDependants: [],
    };

    render(<SchemaField property={property} value="false" onChange={onChange} />);

    const sw = screen.getByRole("switch", { name: "SSL" });
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith("ssl", "true");
  });

  it("shows validation error instead of description", () => {
    const property: SchemaProperty = {
      name: "host",
      type: "string",
      display: baseDisplay,
      validation: [],
      valueDependants: [],
    };

    render(
      <SchemaField
        property={property}
        value=""
        onChange={vi.fn()}
        error="Required"
      />,
    );

    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText("Database host")).not.toBeInTheDocument();
  });
});
