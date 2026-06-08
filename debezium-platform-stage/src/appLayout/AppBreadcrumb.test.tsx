import { screen } from "@testing-library/react";
import AppBreadcrumb from "./AppBreadcrumb";
import { expect, test } from "vitest";
import { render } from "../__test__/unit/test-utils";

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
