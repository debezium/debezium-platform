import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SchemaReviewValue from "./SchemaReviewValue";
import { render } from "../__test__/unit/test-utils";

describe("SchemaReviewValue", () => {
  it("shows Default badge without inline suffix", () => {
    render(<SchemaReviewValue raw="true" state="default" />);
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.queryByText("true (default)")).not.toBeInTheDocument();
  });

  it("shows Configured badge for explicitly saved values", () => {
    render(<SchemaReviewValue raw="9999" state="configured" />);
    expect(screen.getByText("9999")).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
  });

  it("shows unset dash with no badge", () => {
    render(<SchemaReviewValue raw="" state="unset" />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Default")).not.toBeInTheDocument();
    expect(screen.queryByText("Configured")).not.toBeInTheDocument();
  });
});
