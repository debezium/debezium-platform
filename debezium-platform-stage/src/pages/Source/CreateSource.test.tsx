/* eslint-disable @typescript-eslint/no-explicit-any */
import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "react-query";
import { CreateSource } from "./CreateSource";
import { useNotification } from "../../appLayout/AppNotificationContext";
import { render } from "../../__test__/unit/test-utils";

const { mockNavigate, mockUseParams } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseParams: vi.fn(() => ({})),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
    useLocation: () => ({ pathname: "/source/create", state: null }),
  };
});

vi.mock("react-query", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-query")>();
  return {
    ...mod,
    useQuery: vi.fn(),
  };
});

vi.mock("../../appLayout/AppNotificationContext", () => ({
  useNotification: vi.fn(),
}));

vi.mock("@components/CreateSourceSchemaForm", () => ({
  __esModule: true,
  default: () => <div data-testid="schema-form-mock" />,
}));

describe("CreateSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({});
    vi.mocked(useNotification).mockReturnValue({
      addNotification: vi.fn(),
    } as any);
  });

  it("shows inline warning when no connector is selected", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    } as any);

    render(<CreateSource />);

    expect(screen.getByText("No connector selected")).toBeInTheDocument();
    expect(
      screen.getByText("Please select a connector from the catalog first."),
    ).toBeInTheDocument();
  });

  it("shows schema error alert when catalog schema fails to load", () => {
    mockUseParams.mockReturnValue({ sourceId: "mongodb" });

    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      error: new Error("Catalog unreachable"),
      isLoading: false,
    } as any);

    render(<CreateSource />);

    expect(screen.getByText("Failed to load connector schema")).toBeInTheDocument();
    expect(screen.getByText("Catalog unreachable")).toBeInTheDocument();
  });
});
