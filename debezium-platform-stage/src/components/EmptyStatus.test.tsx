import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "@patternfly/react-core";
import EmptyStatus from "./EmptyStatus";
import { render } from "../__test__/unit/test-utils";

describe("EmptyStatus", () => {
  it("renders heading, messages, and actions", () => {
    render(
      <EmptyStatus
        heading="Nothing here"
        primaryMessage="Primary copy"
        secondaryMessage="Secondary copy"
        primaryAction={<Button>Add item</Button>}
        secondaryActions={<Button variant="link">Learn more</Button>}
      />,
    );

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Primary copy")).toBeInTheDocument();
    expect(screen.getByText("Secondary copy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Learn more" })).toBeInTheDocument();
  });
});
