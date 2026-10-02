import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders small inline variant with retry button and triggers onRetry", () => {
    const onRetry = vi.fn();
    render(<ApiError errorType="small" onRetry={onRetry} />);
    expect(screen.getByText("Error : Failed to load")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders small inline variant with custom errorMsg", () => {
    render(<ApiError errorType="small" errorMsg="Custom error message" />);
    expect(screen.getByText("Custom error message")).toBeInTheDocument();
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

  it("renders popover variant with trigger button and shows danger alert popover on hover", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ApiError
        errorType="popover"
        errorMsg="Connection timeout"
        onRetry={onRetry}
      />,
    );

    const trigger = screen.getByRole("button", { name: /connection timeout/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveClass("api_error-popover-trigger");

    await user.hover(trigger);

    expect(await screen.findByRole("heading", { name: /failed to load/i })).toBeInTheDocument();
    expect(await screen.findByText("Connection timeout")).toBeInTheDocument();

    const retryBtn = await screen.findByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    await user.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders popover variant with custom title and description", async () => {
    const user = userEvent.setup();

    render(
      <ApiError
        errorType="popover"
        title="Custom Header"
        description="Detailed failure description"
      />,
    );

    const trigger = screen.getByRole("button", { name: /error/i });
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    expect(await screen.findByRole("heading", { name: /custom header/i })).toBeInTheDocument();
    expect(await screen.findByText("Detailed failure description")).toBeInTheDocument();
  });
});
