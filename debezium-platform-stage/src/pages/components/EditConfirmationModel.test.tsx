import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import EditConfirmationModel from "./EditConfirmationModel";
import { render } from "../../__test__/unit/test-utils";

const baseProps = {
  isWarningOpen: true,
  setIsWarningOpen: vi.fn(),
  pendingSave: {
    values: {},
    setError: vi.fn(),
  },
  setPendingSave: vi.fn(),
  handleEdit: vi.fn(),
};

describe("EditConfirmationModel", () => {
  it("keeps the restart confirm copy for sources", () => {
    render(<EditConfirmationModel type="source" {...baseProps} />);

    expect(screen.getByText(/source update will restart pipeline/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("offers save-as-copy as the recommended choice for a used transform", () => {
    const onSaveAsCopy = vi.fn();
    const handleEdit = vi.fn();
    render(
      <EditConfirmationModel
        type="transform"
        {...baseProps}
        handleEdit={handleEdit}
        usedInCount={1}
        onSaveAsCopy={onSaveAsCopy}
      />
    );

    expect(screen.getByText(/this transform is used by other pipelines/i)).toBeInTheDocument();
    expect(screen.getByText(/recommended/i)).toBeInTheDocument();
    const copyRadio = screen.getByRole("radio", { name: /save as a new copy/i });
    expect(copyRadio).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(onSaveAsCopy).toHaveBeenCalled();
    expect(handleEdit).not.toHaveBeenCalled();
  });

  it("updates the shared transform when that radio is selected", () => {
    const onSaveAsCopy = vi.fn();
    const handleEdit = vi.fn();
    render(
      <EditConfirmationModel
        type="transform"
        {...baseProps}
        handleEdit={handleEdit}
        usedInCount={3}
        onSaveAsCopy={onSaveAsCopy}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /update the shared transform/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(handleEdit).toHaveBeenCalled();
    expect(onSaveAsCopy).not.toHaveBeenCalled();
  });

  it("keeps the restart confirm copy for an unused transform", () => {
    render(
      <EditConfirmationModel
        type="transform"
        {...baseProps}
        usedInCount={0}
        onSaveAsCopy={vi.fn()}
      />
    );

    expect(screen.getByText(/transform update will restart pipeline/i)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeInTheDocument();
  });
});
