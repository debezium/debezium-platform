import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import WelcomePage from "./WelcomePage";
import { render } from "../../__test__/unit/test-utils";

describe("WelcomePage", () => {
  it("renders welcome copy and primary action", () => {
    render(<WelcomePage />);

    expect(screen.getByText("Welcome to Stage")).toBeInTheDocument();
    expect(
      screen.getByText(/Stage UI provide a visual tool/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create a pipeline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Source" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Destination" })).toBeInTheDocument();
  });
});
