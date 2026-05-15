/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { useQuery } from "react-query";
import SourceSchemaReviewView from "./SourceSchemaReviewView";
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

describe("SourceSchemaReviewView", () => {
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
      <SourceSchemaReviewView source={baseSource} connectorSchema={minimalSchema} />,
    );

    expect(await screen.findByText("Review Source")).toBeInTheDocument();
    expect(screen.getByText("MongoDB")).toBeInTheDocument();
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
      <SourceSchemaReviewView source={baseSource} connectorSchema={minimalSchema} />,
    );

    const unsetValues = await screen.findAllByText("—");
    expect(unsetValues.length).toBeGreaterThan(0);
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
      <SourceSchemaReviewView source={withConnection} connectorSchema={filtersSchema} />,
    );

    expect(
      await screen.findByText("Failed to load database table/collection"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });

});
