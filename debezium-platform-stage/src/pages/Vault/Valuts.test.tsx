import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Vaults } from "./Vaults";
import { useData } from "../../appLayout/AppContext";
import { render } from "../../__test__/unit/test-utils";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../appLayout/AppContext", () => ({
  useData: vi.fn(),
}));

describe("Vaults Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useData).mockReturnValue({
      darkMode: false,
      navigationCollapsed: false,
      setDarkMode: vi.fn(),
      updateNavigationCollapsed: vi.fn(),
    });
  });

  it("renders the Vaults component with correct content", () => {
    render(<Vaults />);

    expect(screen.getByAltText("Coming Soon")).toBeInTheDocument();
    expect(screen.getByText("No vault available")).toBeInTheDocument();
    expect(
      screen.getByText(/No vault is configure for this cluster yet/),
    ).toBeInTheDocument();
    expect(screen.getByText("Add vault")).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Destinations")).toBeInTheDocument();
    expect(screen.getByText("Pipelines")).toBeInTheDocument();
  });

  it("navigates via secondary quick links", () => {
    render(<Vaults />);

    fireEvent.click(screen.getByText("Sources"));
    expect(mockNavigate).toHaveBeenCalledWith("/source");

    fireEvent.click(screen.getByText("Destinations"));
    expect(mockNavigate).toHaveBeenCalledWith("/destination");

    fireEvent.click(screen.getByText("Pipelines"));
    expect(mockNavigate).toHaveBeenCalledWith("/pipeline");
  });
});
