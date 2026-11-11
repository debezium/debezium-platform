import { screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import App from "./App";
import { render } from "./__test__/unit/test-utils";

test("renders the App", async () => {
  // OIDC disabled on the conductor: AuthGate lets the app through
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ anonymous: true }))));
  render(<App />, { withMemoryRouter: false, withSuspense: true });

  const dbzLogo = await screen.findByAltText("Debezium Logo");
  expect(dbzLogo).toBeInTheDocument();
  vi.unstubAllGlobals();
});
