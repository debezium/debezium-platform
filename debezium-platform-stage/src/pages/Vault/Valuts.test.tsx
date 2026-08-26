import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Vaults } from "./Vaults";
import { useData } from "../../appLayout/AppContext";
import { render } from "../../__test__/unit/test-utils";
import { isFeatureComingSoon, isFeatureEnabled } from "@utils/featureFlag";

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

const vaultContentVisible = isFeatureEnabled("Vault") || isFeatureComingSoon("Vault");

describe("Vaults Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useData).mockReturnValue({
      darkMode: false,
      navigationCollapsed: false,
      setDarkMode: vi.fn(),
      glassMode: false,
      setGlassMode: vi.fn(),
      updateNavigationCollapsed: vi.fn(),
    });
  });

  it("renders the Vaults component according to the Vault feature flag", () => {
    render(<Vaults />);

    if (!vaultContentVisible) {
      expect(screen.queryByText("No vault available")).not.toBeInTheDocument();
      return;
    }

    if (isFeatureComingSoon("Vault")) {
      expect(screen.getByAltText("Coming Soon")).toBeInTheDocument();
    } else {
      expect(screen.queryByAltText("Coming Soon")).not.toBeInTheDocument();
    }

    expect(screen.getByText("No vault available")).toBeInTheDocument();
    expect(
      screen.getByText(/No vault is configure for this cluster yet/),
    ).toBeInTheDocument();
    expect(screen.getByText("Add vault")).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Destinations")).toBeInTheDocument();
    expect(screen.getByText("Pipelines")).toBeInTheDocument();
  });

  it.skipIf(!vaultContentVisible)("navigates via secondary quick links", () => {
    render(<Vaults />);

    fireEvent.click(screen.getByText("Sources"));
    expect(mockNavigate).toHaveBeenCalledWith("/source");

    fireEvent.click(screen.getByText("Destinations"));
    expect(mockNavigate).toHaveBeenCalledWith("/destination");

    fireEvent.click(screen.getByText("Pipelines"));
    expect(mockNavigate).toHaveBeenCalledWith("/pipeline");
  });
});
