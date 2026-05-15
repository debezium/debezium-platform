import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "./App";
import { render } from "./__test__/unit/test-utils";

test("renders the App", () => {
  render(<App />, { withMemoryRouter: false, withSuspense: true });

  const dbzLogo = screen.getByAltText("Debezium Logo");
  expect(dbzLogo).toBeInTheDocument();
});
