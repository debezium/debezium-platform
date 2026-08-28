import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { render } from "../../__test__/unit/test-utils";
import InformationModal from "./InformationModal";

describe("InformationModal", () => {
  it("renders title, body, and actions when open", () => {
    render(
      <InformationModal
        isOpen
        onClose={vi.fn()}
        title="Create a pipeline first"
        primaryAction={{ label: "Create pipeline", onClick: vi.fn() }}
        secondaryAction={{ label: "Cancel", onClick: vi.fn() }}
      >
        You need a pipeline before adding a rule.
      </InformationModal>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Create a pipeline first")).toBeInTheDocument();
    expect(screen.getByText("You need a pipeline before adding a rule.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create pipeline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <InformationModal
        isOpen={false}
        onClose={vi.fn()}
        title="Create a pipeline first"
        primaryAction={{ label: "Create pipeline", onClick: vi.fn() }}
      >
        You need a pipeline before adding a rule.
      </InformationModal>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("invokes primary and secondary actions", async () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();

    render(
      <InformationModal
        isOpen
        onClose={vi.fn()}
        title="Create a pipeline first"
        primaryAction={{ label: "Create pipeline", onClick: onPrimary }}
        secondaryAction={{ label: "Cancel", onClick: onSecondary }}
      >
        You need a pipeline before adding a rule.
      </InformationModal>
    );

    await userEvent.click(screen.getByRole("button", { name: "Create pipeline" }));
    expect(onPrimary).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});
