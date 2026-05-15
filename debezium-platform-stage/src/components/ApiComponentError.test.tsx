import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ApiComponentError from "./ApiComponentError";
import { render } from "../__test__/unit/test-utils";

describe("ApiComponentError", () => {
  it("shows title, expandable JSON, and retry", async () => {
    const retry = vi.fn();
    const err = { code: 503, message: "timeout" };

    render(<ApiComponentError error={err} retry={retry} />);

    expect(
      screen.getByRole("heading", {
        name: "Failed to load database table/collection",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show details/i }));
    expect(screen.getByText(/"code"/)).toBeInTheDocument();
    expect(screen.getByText(/503/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(retry).toHaveBeenCalled();
  });

  it("applies compact class when isCompact is false by default for non-compact", () => {
    const { container } = render(
      <ApiComponentError error={{}} retry={() => {}} />,
    );
    expect(container.querySelector(".api-component-error")).toBeInTheDocument();
  });

  it("omits api-component-error class when compact", () => {
    const { container } = render(
      <ApiComponentError error={{}} retry={() => {}} isCompact />,
    );
    expect(container.querySelector(".api-component-error")).not.toBeInTheDocument();
  });
});
