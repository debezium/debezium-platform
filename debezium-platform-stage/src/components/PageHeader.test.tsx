import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PageHeader from "./PageHeader";
import { render } from "../__test__/unit/test-utils";

describe("PageHeader", () => {
  it("renders title and description", () => {
    render(
      <PageHeader title="Connections" description="Manage connections here." />,
    );

    expect(
      screen.getByRole("heading", { name: "Connections", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Manage connections here.")).toBeInTheDocument();
  });
});
