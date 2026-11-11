import { screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "../__test__/unit/test-utils";
import { AuthGate, loginUrl, useAuthUser } from "./AuthGate";

const Who = () => {
  const user = useAuthUser();
  return <p>{user ? `user:${user.email}` : "anonymous"}</p>;
};

const meReturns = (status: number, body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  );

describe("AuthGate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renders the app without a user when OIDC is disabled", async () => {
    meReturns(200, { anonymous: true });
    render(<AuthGate><Who /></AuthGate>);
    expect(await screen.findByText("anonymous")).toBeInTheDocument();
  });

  test("exposes the logged-in user", async () => {
    meReturns(200, { email: "alice@example.com", name: "Alice" });
    render(<AuthGate><Who /></AuthGate>);
    expect(await screen.findByText("user:alice@example.com")).toBeInTheDocument();
  });

  test("401 shows the login screen instead of the app, without redirecting on its own", async () => {
    meReturns(401, {});
    render(<AuthGate><Who /></AuthGate>);
    expect(await screen.findByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      expect.stringMatching(/\/api\/auth\/login\?redirect=%2F/)
    );
    expect(screen.getByAltText("Debezium Logo")).toBeInTheDocument();
    expect(screen.queryByText("anonymous")).not.toBeInTheDocument();
  });

  test("login URL carries the current path back", () => {
    expect(loginUrl("/pipeline?x=1")).toMatch(
      /\/api\/auth\/login\?redirect=%2Fpipeline%3Fx%3D1$/
    );
  });

  test("403 shows the access denied page instead of the app", async () => {
    meReturns(403, { email: "eve@example.com", name: "Eve" });
    render(<AuthGate><Who /></AuthGate>);
    expect(await screen.findByText(/eve@example.com/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log out" })).toHaveAttribute(
      "href",
      expect.stringMatching(/\/api\/auth\/logout$/)
    );
    expect(screen.queryByText(/user:/)).not.toBeInTheDocument();
  });
});
