/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "react-query";
import { createPost, editPut, fetchDataTypeTwo } from "src/apis";
import { EditConnection } from "./EditConnection";
import { render } from "../../__test__/unit/test-utils";

const hoisted = vi.hoisted(() => ({ search: "" }));

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => vi.fn(),
    useParams: () => ({ connectionId: "1" }),
    useSearchParams: () => [new URLSearchParams(hoisted.search), vi.fn()],
  };
});

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return { ...mod, useQuery: vi.fn() };
});

vi.mock("src/apis", async (importOriginal) => {
  const mod = await importOriginal<typeof import("src/apis")>();
  return {
    ...mod,
    editPut: vi.fn(),
    createPost: vi.fn(),
    fetchDataTypeTwo: vi.fn(),
  };
});

vi.mock("../../appLayout/AppContext", () => ({
  useData: () => ({
    darkMode: false,
    navigationCollapsed: false,
    setDarkMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  }),
}));

const CONNECTION = {
  id: 1,
  name: "orders-db",
  type: "POSTGRES",
  description: "Primary OLTP database",
  config: { hostname: "db.example.com" },
};

const MATCHING_SCHEMA = [
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

/** A schema list that does not contain the connection's type. */
const UNRELATED_SCHEMA = [{ ...MATCHING_SCHEMA[0], type: "MYSQL" }];

const mockApi = (schemas: unknown) => {
  vi.mocked(fetchDataTypeTwo).mockImplementation((async (url: string) =>
    url.endsWith("/api/connections/schemas")
      ? { data: schemas, error: undefined }
      : { data: CONNECTION, error: undefined }) as any);
};

const input = (id: string) => document.getElementById(id) as HTMLInputElement;

const lastPutPayload = () =>
  vi.mocked(editPut).mock.calls[0]?.[1] as Record<string, unknown> | undefined;

describe("EditConnection description field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.search = "";
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
    } as any);
    vi.mocked(editPut).mockResolvedValue({
      data: CONNECTION,
      error: undefined,
    } as any);
    vi.mocked(createPost).mockResolvedValue({
      data: { valid: true },
      error: undefined,
    } as any);
  });

  it("seeds the saved description into the edit form (schema-matched connection)", async () => {
    mockApi(MATCHING_SCHEMA);
    render(<EditConnection />);
    await waitFor(() =>
      expect(input("connection-description")).toHaveValue(
        "Primary OLTP database",
      ),
    );
  });

  it("seeds the saved description when no schema matches the connection type", async () => {
    mockApi(UNRELATED_SCHEMA);
    render(<EditConnection />);
    await waitFor(() =>
      expect(input("connection-description")).toHaveValue(
        "Primary OLTP database",
      ),
    );
  });

  it("keeps the existing description in the payload when it is not edited", async () => {
    mockApi(UNRELATED_SCHEMA);
    render(<EditConnection />);
    await waitFor(() =>
      expect(input("connection-description")).toHaveValue(
        "Primary OLTP database",
      ),
    );

    fireEvent.submit(document.getElementById("create-connection-form")!);

    await waitFor(() => expect(lastPutPayload()).toBeDefined());
    expect(lastPutPayload()).toMatchObject({
      name: "orders-db",
      description: "Primary OLTP database",
    });
  });

  // A successful save flips the page back to view mode, so each of these
  // renders its own form rather than submitting twice.
  const editDescriptionAndSubmit = async (value: string) => {
    mockApi(UNRELATED_SCHEMA);
    render(<EditConnection />);
    await waitFor(() =>
      expect(input("connection-description")).toHaveValue(
        "Primary OLTP database",
      ),
    );
    fireEvent.change(input("connection-description"), { target: { value } });
    fireEvent.submit(document.getElementById("create-connection-form")!);
    await waitFor(() => expect(lastPutPayload()).toBeDefined());
  };

  it("sends an edited description", async () => {
    await editDescriptionAndSubmit("Replica used for reporting");
    expect(lastPutPayload()).toMatchObject({
      description: "Replica used for reporting",
    });
  });

  it("sends an empty string once the description is cleared", async () => {
    await editDescriptionAndSubmit("");
    expect(lastPutPayload()).toMatchObject({ description: "" });
  });

  // The schema-backed path builds the PUT payload in a different branch, and it
  // is the path every real connector takes, so it needs its own assertion.
  it("sends the description on the schema-backed path, without leaking it into config", async () => {
    mockApi(MATCHING_SCHEMA);
    render(<EditConnection />);
    await waitFor(() =>
      expect(input("connection-description")).toHaveValue(
        "Primary OLTP database",
      ),
    );

    fireEvent.change(input("connection-description"), {
      target: { value: "Replica used for reporting" },
    });

    // With a schema present the connection must be validated before saving.
    fireEvent.click(screen.getByText("Validate"));
    await waitFor(() =>
      expect(
        vi
          .mocked(createPost)
          .mock.calls.some(([url]) => String(url).endsWith("/validate")),
      ).toBe(true),
    );
    const validatePayload = vi
      .mocked(createPost)
      .mock.calls.find(([url]) => String(url).endsWith("/validate"))?.[1] as any;
    expect(validatePayload).toMatchObject({
      description: "Replica used for reporting",
    });

    fireEvent.submit(document.getElementById("create-connection-form")!);
    await waitFor(() => expect(lastPutPayload()).toBeDefined());

    const payload = lastPutPayload()!;
    expect(payload).toMatchObject({
      type: "POSTGRES",
      name: "orders-db",
      description: "Replica used for reporting",
    });
    expect(payload.config).toEqual({ hostname: "db.example.com" });
    expect(payload.config).not.toHaveProperty("description");
  });

  it("renders the description as read-only text in view mode", async () => {
    hoisted.search = "state=view";
    mockApi(UNRELATED_SCHEMA);
    render(<EditConnection />);
    await waitFor(() =>
      expect(screen.getByText("Primary OLTP database")).toBeInTheDocument(),
    );
    expect(input("connection-description")).toBeNull();
  });
});
