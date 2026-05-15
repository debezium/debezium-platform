import { describe, it, expect } from "vitest";
import CatalogSkeleton from "./CatalogSkeleton";
import { render } from "../__test__/unit/test-utils";

describe("CatalogSkeleton", () => {
  it("renders a gallery of skeleton cards", () => {
    const { container } = render(<CatalogSkeleton />);

    expect(container.querySelector(".custom-gallery")).toBeInTheDocument();
    expect(container.querySelectorAll(".pf-v6-c-skeleton").length).toBeGreaterThan(0);
  });
});
