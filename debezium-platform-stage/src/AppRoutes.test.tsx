import { screen } from "@testing-library/react";
import { describe, expect, it, afterEach, vi } from "vitest";
import { AppRoutes } from "./AppRoutes";
import { render } from "./__test__/unit/test-utils";
import {
  featureFlagUi,
  getComingSoonFlags,
  getFeaturePageAccess,
  type FeatureFlag,
} from "@utils/featureFlag";

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

const originalHideDisabled = featureFlagUi.hideDisabledFeaturesFromNav;

const GATED_PAGE_PATHS: Partial<Record<FeatureFlag, string>> = {
  Vault: "/vaults",
  Alerts: "/alerts/rules",
  Transforms: "/transform",
  Connection: "/connections",
};

describe("AppRoutes", () => {
  afterEach(() => {
    featureFlagUi.hideDisabledFeaturesFromNav = originalHideDisabled;
  });

  it.each(
    (Object.entries(GATED_PAGE_PATHS) as [FeatureFlag, string][])
  )("routes %s according to the current feature flags", (flag, path) => {
    render(<AppRoutes />, { initialEntries: [path] });

    const access = getFeaturePageAccess(flag);
    if (access === "unavailable") {
      expect(screen.getByText(/404: Page Not Found/i)).toBeInTheDocument();
      return;
    }

    expect(screen.queryByText(/404: Page Not Found/i)).not.toBeInTheDocument();
    if (access === "comingSoon") {
      expect(screen.getByAltText("Coming Soon")).toBeInTheDocument();
    }
  });

  it.skipIf(getComingSoonFlags().length === 0)(
    "does not expose disabled coming-soon routes when hideDisabledFeaturesFromNav is true",
    () => {
      const comingSoonFlag = getComingSoonFlags()[0];
      const path = GATED_PAGE_PATHS[comingSoonFlag];
      if (!path) {
        return;
      }

      featureFlagUi.hideDisabledFeaturesFromNav = true;
      render(<AppRoutes />, { initialEntries: [path] });

      expect(screen.getByText(/404: Page Not Found/i)).toBeInTheDocument();
    }
  );
});
