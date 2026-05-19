import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import AdditionalProperties from "./AdditionalProperties";
import { render } from "../__test__/unit/test-utils";
import type { AdditionalPropertyRow, AdditionalPropertyRowErrorCode } from "@utils/additionalConfigProperties";

describe("AdditionalProperties", () => {
  const defaultRow: AdditionalPropertyRow = {
    key: "k1",
    valueKind: "string",
    stringValue: "v1",
    booleanValue: false,
    integerInput: "",
  };

  it("renders rows, value input, remove, and add property", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onDelete = vi.fn();
    const onPatch = vi.fn();
    const onValueKindChange = vi.fn();

    const properties = new Map<string, AdditionalPropertyRow>([
      ["row-1", defaultRow],
    ]);

    render(
      <AdditionalProperties
        properties={properties}
        onAdd={onAdd}
        onDelete={onDelete}
        onPatch={onPatch}
        onValueKindChange={onValueKindChange}
        rowIdsWithErrors={new Set()}
        rowErrorCodes={new Map()}
      />,
    );

    expect(screen.getByDisplayValue("v1")).toBeInTheDocument();
    
    // PatternFly and i18next might render 'Remove row' or similar based on translations.
    await user.click(screen.getByRole("button", { name: /remove/i }));
    expect(onDelete).toHaveBeenCalledWith("row-1");

    await user.click(screen.getByRole("button", { name: /add property/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it("hides remove and add when readOnly", () => {
    render(
      <AdditionalProperties
        properties={new Map([["row-1", defaultRow]])}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onPatch={vi.fn()}
        onValueKindChange={vi.fn()}
        rowIdsWithErrors={new Set()}
        rowErrorCodes={new Map()}
        readOnly
      />,
    );

    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add property/i })).not.toBeInTheDocument();
  });

  it("marks value input error when id is in errorKeys", () => {
    const rowErrorCodes = new Map<string, AdditionalPropertyRowErrorCode[]>([
      ["row-e", ["empty_value"]],
    ]);
    render(
      <AdditionalProperties
        properties={new Map([["row-e", { ...defaultRow, stringValue: "" }]])}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onPatch={vi.fn()}
        onValueKindChange={vi.fn()}
        rowIdsWithErrors={new Set(["row-e"])}
        rowErrorCodes={rowErrorCodes}
      />,
    );

    // The value input has an aria-invalid attribute when marked with an error
    const valueInput = screen.getByRole("textbox", { name: /value/i });
    expect(valueInput).toHaveAttribute("aria-invalid", "true");
  });
});
