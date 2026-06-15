import { screen } from "@testing-library/react";
import AppBreadcrumb from "./AppBreadcrumb";
import { expect, test, vi } from "vitest";
import { render } from "../__test__/unit/test-utils";

vi.mock("@utils/featureFlag", async () => {
  const actual = await vi.importActual<typeof import("@utils/featureFlag")>(
    "@utils/featureFlag"
  );

  return {
    ...actual,
    getPipelineDetailsRoutePattern: vi.fn(actual.getPipelineDetailsRoutePattern),
  };
});

import { getPipelineDetailsRoutePattern } from "@utils/featureFlag";

test("render the Breadcrumb component", () => {
  const testPath = "/source/catalog";
  render(<AppBreadcrumb />, { initialEntries: [testPath] });

  const breadcrumb = screen.getByText("Catalog");
  expect(breadcrumb).toHaveTextContent("Catalog");

  const catalogLink = screen.getByText("Source");
  expect(catalogLink).toHaveAttribute("href", "/source");
});

test("render pipeline overview breadcrumb", () => {
  render(<AppBreadcrumb />, { initialEntries: ["/pipeline/123/overview"] });

  expect(screen.getByText("Pipeline")).toBeInTheDocument();
  expect(screen.getByText("Overview")).toBeInTheDocument();
  expect(screen.queryByText("Create pipeline")).not.toBeInTheDocument();
});

test("render pipeline monitoring breadcrumb when tab is enabled", () => {
  vi.mocked(getPipelineDetailsRoutePattern).mockReturnValue(
    /^\/pipeline\/[^/]+\/(overview|logs|edit|action|monitoring)$/
  );

  render(<AppBreadcrumb />, { initialEntries: ["/pipeline/123/monitoring"] });

  expect(screen.getByText("Pipeline")).toBeInTheDocument();
  expect(screen.getByText("Monitoring")).toBeInTheDocument();
  expect(screen.queryByText("Create pipeline")).not.toBeInTheDocument();
});

test("does not render monitoring breadcrumb when tab is disabled", () => {
  vi.mocked(getPipelineDetailsRoutePattern).mockReturnValue(
    /^\/pipeline\/[^/]+\/(overview|logs|edit|action)$/
  );

  render(<AppBreadcrumb />, { initialEntries: ["/pipeline/123/monitoring"] });

  expect(screen.queryByText("Monitoring")).not.toBeInTheDocument();
});
