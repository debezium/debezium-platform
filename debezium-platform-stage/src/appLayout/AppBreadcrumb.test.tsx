import { render, screen } from "@testing-library/react";
import AppBreadcrumb from "./AppBreadcrumb";
import { expect, test } from "vitest";
import { MemoryRouter } from "react-router-dom";

test("render the Breadcrumb component", () => {
  const testPath = "/source/catalog";
  render(
    <MemoryRouter initialEntries={[testPath]}>
      <AppBreadcrumb />
    </MemoryRouter>
  );

  const breadcrumb = screen.getByText("Catalog");
  expect(breadcrumb).toHaveTextContent("Catalog");

  const catalogLink = screen.getByText("Source");
  expect(catalogLink).toHaveAttribute("href", "/source");
});