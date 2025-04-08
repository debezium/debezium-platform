import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Vaults } from "./Vaults";
import { MemoryRouter } from "react-router-dom";
import { useData } from "../../appLayout/AppContext";
import { render } from '../../__test__/unit/test-utils';

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../appLayout/AppContext", () => ({
  useData: vi.fn(),
}));

describe("Vaults Component", () => {
  beforeEach(() => {
    vi.mocked(useData).mockReturnValue({
      darkMode: false,
      navigationCollapsed: false,
      setDarkMode: vi.fn(),
      updateNavigationCollapsed: vi.fn(),
    });
  });

  it("renders the Vaults component with correct content", () => {
    render(
      <MemoryRouter>
        <Vaults />
      </MemoryRouter>
    );

    expect(screen.getByAltText("Coming Soon")).toBeInTheDocument();
    expect(screen.getByText("No vault available")).toBeInTheDocument();
    expect(
      screen.getByText(/No vault is configure for this cluster yet/)
    ).toBeInTheDocument();
    expect(screen.getByText("Add vault")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Destination")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
  });
});
