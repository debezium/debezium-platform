/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "react-query";
import { createPost } from "src/apis";
import { CreateConnection } from "./CreateConnection";
import { render } from "../../__test__/unit/test-utils";

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ state: { connectionType: "source" } }),
    useParams: () => ({ connectionId: "postgres" }),
  };
});

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return { ...mod, useQuery: vi.fn() };
});

vi.mock("src/apis", async (importOriginal) => {
  const mod = await importOriginal<typeof import("src/apis")>();
  return { ...mod, createPost: vi.fn(), fetchData: vi.fn() };
});

vi.mock("../../appLayout/AppContext", () => ({
  useData: () => ({
    darkMode: false,
    navigationCollapsed: false,
    setDarkMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  }),
}));

/** Payload passed to the POST that creates the connection. */
const lastCreatePayload = () => {
  const call = vi
    .mocked(createPost)
    .mock.calls.find(([url]) => String(url).endsWith("/api/connections"));
  return call?.[1] as Record<string, unknown> | undefined;
};

/** Matches the mocked `connectionId` of "postgres", so `selectedSchema` resolves. */
const POSTGRES_SCHEMA = [
  {
    type: "POSTGRES",
    schema: {
      type: "object",
      title: "PostgreSQL",
      description: "PostgreSQL connection properties",
      required: ["hostname"],
      additionalProperties: { type: "string" },
      properties: { hostname: { type: "string", title: "Hostname" } },
    },
  },
];

describe("CreateConnection description field", () => {
  /** `connectionsSchema` drives whether the form takes the schema-backed path. */
  const withSchemas = (schemas: unknown) =>
    vi.mocked(useQuery).mockImplementation(
      ((key: unknown) =>
        key === "connectionsSchema"
          ? { data: schemas, error: null, isLoading: false }
          : { data: [], error: null, isLoading: false }) as any,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no schema for this type, so the form renders the plain
    // name + description + additional-properties path and submits directly.
    withSchemas([]);
    vi.mocked(createPost).mockResolvedValue({
      data: { id: 1, name: "conn", valid: true },
      error: undefined,
    } as any);
  });

  // The name FormGroup is `isRequired`, so its label carries a required marker
  // and is not an exact text match; target the inputs by id, as the Cypress
  // specs for this same form already do.
  const input = (id: string) => document.getElementById(id) as HTMLInputElement;

  const submit = () =>
    fireEvent.submit(document.getElementById("create-connection-form")!);

  it("renders an optional description input", () => {
    render(<CreateConnection />);
    const description = screen.getByLabelText("Description");
    expect(description).toBeInTheDocument();
    expect(description).not.toBeRequired();
    expect(description).toHaveValue("");
  });

  it("sends the entered description in the create payload", async () => {
    render(<CreateConnection />);
    fireEvent.change(input("connection-name"), {
      target: { value: "orders-db" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Primary OLTP database" },
    });
    submit();

    await waitFor(() => expect(lastCreatePayload()).toBeDefined());
    expect(lastCreatePayload()).toMatchObject({
      name: "orders-db",
      description: "Primary OLTP database",
    });
  });

  it("still submits when the description is left empty", async () => {
    render(<CreateConnection />);
    fireEvent.change(input("connection-name"), {
      target: { value: "orders-db" },
    });
    submit();

    await waitFor(() => expect(lastCreatePayload()).toBeDefined());
    expect(lastCreatePayload()).toMatchObject({
      name: "orders-db",
      description: "",
    });
  });

  // The schema-backed path is the one every real connector takes, and it builds
  // the payload in a different branch, so it needs its own assertion.
  it("sends the description on the schema-backed path, without leaking it into config", async () => {
    withSchemas(POSTGRES_SCHEMA);
    render(<CreateConnection />);

    fireEvent.change(input("connection-name"), {
      target: { value: "orders-db" },
    });
    fireEvent.change(input("hostname"), {
      target: { value: "db.example.com" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Primary OLTP database" },
    });

    // With a schema present the connection must be validated before it can be
    // created, so go through Validate first.
    fireEvent.click(screen.getByText("Validate"));
    await waitFor(() =>
      expect(
        vi
          .mocked(createPost)
          .mock.calls.some(([url]) => String(url).endsWith("/validate")),
      ).toBe(true),
    );
    // Validation posts the same payload, so it must carry the description too.
    const validatePayload = vi
      .mocked(createPost)
      .mock.calls.find(([url]) => String(url).endsWith("/validate"))?.[1] as any;
    expect(validatePayload).toMatchObject({
      description: "Primary OLTP database",
    });

    submit();
    await waitFor(() => expect(lastCreatePayload()).toBeDefined());

    const payload = lastCreatePayload()!;
    expect(payload).toMatchObject({
      type: "POSTGRES",
      name: "orders-db",
      description: "Primary OLTP database",
    });
    expect(payload.config).toEqual({ hostname: "db.example.com" });
    expect(payload.config).not.toHaveProperty("description");
  });
});
