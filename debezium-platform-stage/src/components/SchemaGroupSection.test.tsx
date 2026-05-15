import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SchemaGroupSection from "./SchemaGroupSection";
import type { SchemaProperty } from "../apis/types";
import { render } from "../__test__/unit/test-utils";

const textProp = (name: string, order: number): SchemaProperty => ({
  name,
  type: "string",
  display: {
    label: name,
    description: `${name} help`,
    group: "g",
    groupOrder: order,
  },
  validation: [],
  valueDependants: [],
});

describe("SchemaGroupSection", () => {
  it("returns null when no visible properties remain", () => {
    const { container } = render(
      <SchemaGroupSection
        properties={[textProp("a", 1)]}
        values={{}}
        onChange={vi.fn()}
        errors={{}}
        allValues={{}}
        dependencyMap={new Map()}
        allDependantNames={new Set()}
        omittedPropertyNames={new Set(["a"])}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders visible fields sorted by groupOrder", () => {
    const onChange = vi.fn();
    render(
      <SchemaGroupSection
        properties={[textProp("second", 2), textProp("first", 1)]}
        values={{ first: "x", second: "y" }}
        onChange={onChange}
        errors={{}}
        allValues={{ first: "x", second: "y" }}
        dependencyMap={new Map()}
        allDependantNames={new Set()}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveAccessibleName("first");
    expect(inputs[1]).toHaveAccessibleName("second");

    fireEvent.change(inputs[0], { target: { value: "z" } });
    expect(onChange).toHaveBeenCalledWith("first", "z");
  });
});
