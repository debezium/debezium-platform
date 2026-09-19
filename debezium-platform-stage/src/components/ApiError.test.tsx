import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import ApiError from "./ApiError";
import { render } from "../__test__/unit/test-utils";

describe("ApiError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders small inline variant", () => {
    render(<ApiError errorType="small" />);
    expect(screen.getByText("Error : Failed to load")).toBeInTheDocument();
  });

  it("renders large empty state with message and refresh", () => {
    render(
      <ApiError
        errorType="large"
        errorMsg="Service unavailable"
        secondaryActions={<button type="button">Go home</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Failed to load" })).toBeInTheDocument();
    expect(screen.getByText("Error: Service unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go home" })).toBeInTheDocument();
  });

  it("uses a custom title and description, and retries in place", () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
    } as unknown as Location);
    const onRetry = vi.fn();

    render(
      <ApiError
        errorType="large"
        title="Failed to load Transforms"
        description="Check your connection and try again."
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Failed to load Transforms" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Check your connection and try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Error:/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("invokes window.location.reload when refresh is clicked", () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
    } as unknown as Location);

    render(<ApiError errorType="large" errorMsg="x" />);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(reload).toHaveBeenCalled();
  });
});
