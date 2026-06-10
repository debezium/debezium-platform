/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { useQuery } from "react-query";
import SchemaReviewView from "./SchemaReviewView";
import type { Source } from "../apis/apis";
import type { ConnectorSchema } from "../apis/types";
import { render } from "../__test__/unit/test-utils";

vi.mock("./ComponentImage", () => ({
  __esModule: true,
  default: () => <span data-testid="connector-image-mock" />,
}));

vi.mock("./TableViewComponent", () => ({
  __esModule: true,
  default: () => <div data-testid="table-view-mock" />,
}));

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
  };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => vi.fn(),
  };
});

const minimalSchema: ConnectorSchema = {
  name: "Test",
  type: "t",
  version: "1",
  metadata: { description: "d" },
  properties: [],
  groups: [],
};

const baseSource: Source = {
  id: 1,
  name: "Review Source",
  description: "A description",
  schema: "s",
  type: "mongodb",
  vaults: [],
  config: {},
};

beforeAll(() => {
  globalThis.IntersectionObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

describe("SchemaReviewView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders connector essentials including source name and type", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(
      <SchemaReviewView connector={baseSource} connectorSchema={minimalSchema} connectorType="source" />,
    );

    expect(await screen.findByText("Review Source")).toBeInTheDocument();
    expect(screen.getByText("MongoDB Connector")).toBeInTheDocument();
    expect(screen.getByText("A description")).toBeInTheDocument();
    expect(screen.getByTestId("connector-image-mock")).toBeInTheDocument();
  });

  it("shows em dash for unset connection name when no connection is linked", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(
      <SchemaReviewView connector={baseSource} connectorSchema={minimalSchema} connectorType="source" />,
    );

    const unsetValues = await screen.findAllByText("—");
    expect(unsetValues.length).toBeGreaterThan(0);
  });

  it("shows schema default values with (default) hint when not explicitly saved", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    const schemaWithDefault: ConnectorSchema = {
      ...minimalSchema,
      groups: [
        {
          name: "Advanced",
          order: 1,
          description: "Advanced settings",
        },
      ],
      properties: [
        {
          name: "statistics.metrics.enabled",
          type: "boolean",
          default: "true",
          display: {
            label: "Enable metrics",
            description: "Collect statistics metrics",
            group: "Advanced",
            groupOrder: 0,
          },
          validation: [],
          valueDependants: [],
        },
      ],
    };

    render(
      <SchemaReviewView
        connector={baseSource}
        connectorSchema={schemaWithDefault}
        connectorType="source"
      />,
    );

    expect(await screen.findByText("true")).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.queryByText("Configured")).not.toBeInTheDocument();
    expect(screen.getByText("Enable metrics")).toBeInTheDocument();

    const helpButton = screen.getByRole("button", { name: "More info for Enable metrics" });
    fireEvent.click(helpButton);
    expect(screen.getByText("Collect statistics metrics")).toBeInTheDocument();
  });

  it("shows Configured badge when value is explicitly saved", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    const schemaWithDefault: ConnectorSchema = {
      ...minimalSchema,
      groups: [{ name: "Advanced", order: 1, description: "Advanced settings" }],
      properties: [
        {
          name: "statistics.metrics.enabled",
          type: "boolean",
          default: "true",
          display: {
            label: "Enable metrics",
            description: "Collect statistics metrics",
            group: "Advanced",
            groupOrder: 0,
          },
          validation: [],
          valueDependants: [],
        },
      ],
    };

    const sourceWithConfig: Source = {
      ...baseSource,
      config: { "statistics.metrics.enabled": false },
    };

    render(
      <SchemaReviewView
        connector={sourceWithConfig}
        connectorSchema={schemaWithDefault}
        connectorType="source"
      />,
    );

    expect(await screen.findByText("false")).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.queryByText("Default")).not.toBeInTheDocument();
  });

  it("shows collections error UI when connection collections query fails", async () => {
    const withConnection: Source = {
      ...baseSource,
      connection: { id: 42, name: "db-conn" },
    };

    vi.mocked(useQuery).mockImplementation((key: unknown) => {
      if (Array.isArray(key) && key[0] === "connection-collections") {
        return {
          data: undefined,
          error: { message: "not allowed" },
          isLoading: false,
          refetch: vi.fn(),
        } as any;
      }
      return {
        data: undefined,
        error: null,
        isLoading: false,
        refetch: vi.fn(),
      } as any;
    });

    const filtersSchema: ConnectorSchema = {
      ...minimalSchema,
      groups: [
        {
          name: "Filters",
          order: 1,
          description: "Filter settings",
        },
      ],
      properties: [
        {
          name: "database.include.list",
          type: "string",
          display: {
            label: "Database include list",
            description: "Managed via table explorer for this connector.",
            group: "Filters",
            groupOrder: 0,
          },
          validation: [],
          valueDependants: [],
        },
      ],
    };

    render(
      <SchemaReviewView connector={withConnection} connectorSchema={filtersSchema} connectorType="source" />,
    );

    expect(
      await screen.findByText("Failed to load database table/collection"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });

});
