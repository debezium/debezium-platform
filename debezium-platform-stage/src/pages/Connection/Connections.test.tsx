/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Connections } from "./Connections";
import { useQuery } from "react-query";
import { useDeleteData } from "src/apis";
import { useNotification } from "../../appLayout/AppNotificationContext";
import connectionsMock from "../../__mocks__/data/Connections.json";
import sourcesMock from "../../__mocks__/data/Sources.json";
import destinationsMock from "../../__mocks__/data/Destinations.json";
import type { Catalog } from "../../apis/types";
import { render } from "../../__test__/unit/test-utils";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
    QueryClient: class MockQueryClient {
      invalidateQueries = vi.fn();
    },
  };
});

vi.mock("src/apis", () => ({
  useDeleteData: vi.fn(),
}));

vi.mock("../../appLayout/AppNotificationContext", () => ({
  useNotification: vi.fn(),
}));

const sourceCatalogForRole: Catalog[] = [
  {
    class: "mariadb",
    name: "MariaDB",
    description: "",
    descriptor: "",
    role: "source",
  },
];

describe("Connections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeleteData).mockReturnValue({
      mutate: vi.fn(),
    } as any);
    vi.mocked(useNotification).mockReturnValue({
      addNotification: vi.fn(),
    } as any);
  });

  const mockQueriesLoaded = (connections: typeof connectionsMock) => {
    vi.mocked(useQuery).mockImplementation((key: unknown) => {
      if (key === "sources") {
        return { data: sourcesMock, error: null, isLoading: false } as any;
      }
      if (key === "destinations") {
        return { data: destinationsMock, error: null, isLoading: false } as any;
      }
      if (key === "connections") {
        return { data: connections, error: null, isLoading: false } as any;
      }
      if (key === "sourceConnectorCatalog") {
        return { data: sourceCatalogForRole, error: null, isLoading: false } as any;
      }
      return { data: undefined, error: null, isLoading: false } as any;
    });
  };

  it("shows loading state while connections are loading", () => {
    vi.mocked(useQuery).mockImplementation((key: unknown) => {
      if (key === "connections") {
        return { data: undefined, error: null, isLoading: true } as any;
      }
      return { data: undefined, error: null, isLoading: false } as any;
    });
    render(<Connections />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows API error when connections query fails", () => {
    vi.mocked(useQuery).mockImplementation((key: unknown) => {
      if (key === "connections") {
        return {
          data: undefined,
          error: new Error("boom"),
          isLoading: false,
        } as any;
      }
      return { data: undefined, error: null, isLoading: false } as any;
    });
    render(<Connections />);
    expect(screen.getByText("Error: boom")).toBeInTheDocument();
  });

  it("renders empty state when there are no connections", () => {
    mockQueriesLoaded([]);
    render(<Connections />);
    expect(screen.getByText("No Connection available")).toBeInTheDocument();
  });

  it("renders connection rows when data is loaded", async () => {
    mockQueriesLoaded(connectionsMock);
    render(<Connections />);
    await waitFor(() => {
      expect(screen.getByText("mariaconnection")).toBeInTheDocument();
      expect(screen.getByText("kinesis-connection")).toBeInTheDocument();
      expect(screen.getByText("2 Items")).toBeInTheDocument();
    });
  });

  it("filters connections by debounced search", async () => {
    mockQueriesLoaded(connectionsMock);
    render(<Connections />);
    const searchInput = screen.getByPlaceholderText("Find by name");
    fireEvent.change(searchInput, { target: { value: "kinesis" } });
    await waitFor(
      () => {
        expect(screen.getByText("kinesis-connection")).toBeInTheDocument();
        expect(screen.queryByText("mariaconnection")).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("shows no-results search state then clears search", async () => {
    mockQueriesLoaded(connectionsMock);
    render(<Connections />);
    const searchInput = screen.getByPlaceholderText("Find by name");
    fireEvent.change(searchInput, { target: { value: "zzz" } });
    await waitFor(
      () => {
        expect(screen.getByText("No matching connection is present.")).toBeInTheDocument();
        expect(screen.getByText("Clear search")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    fireEvent.click(screen.getByText("Clear search"));
    await waitFor(
      () => {
        expect(searchInput).toHaveValue("");
        expect(screen.getByText("2 Items")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
