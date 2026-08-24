import { screen } from "@testing-library/react";
import { describe, expect, it, afterEach, vi } from "vitest";
import { AppRoutes } from "./AppRoutes";
import { render } from "./__test__/unit/test-utils";
import { featureFlagUi } from "@utils/featureFlag";

vi.mock("./appLayout/AppContext", () => ({
  useData: () => ({
    darkMode: false,
    navigationCollapsed: false,
    setDarkMode: vi.fn(),
    glassMode: false,
    setGlassMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  }),
}));

describe("AppRoutes", () => {
  afterEach(() => {
    featureFlagUi.hideDisabledFeaturesFromNav = false;
  });

  it("keeps coming-soon routes reachable by default", () => {
    render(<AppRoutes />, { initialEntries: ["/vaults"] });

    expect(screen.queryByText(/404: Page Not Found/i)).not.toBeInTheDocument();
    expect(screen.getByAltText("Coming Soon")).toBeInTheDocument();
  });

  it("does not expose disabled coming-soon routes when hideDisabledFeaturesFromNav is true", () => {
    featureFlagUi.hideDisabledFeaturesFromNav = true;
    render(<AppRoutes />, { initialEntries: ["/vaults"] });

    expect(screen.getByText(/404: Page Not Found/i)).toBeInTheDocument();
  });
});
