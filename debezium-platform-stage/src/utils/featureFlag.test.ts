import { describe, expect, it, afterEach } from "vitest";
import {
  featureConfig,
  featureFlagUi,
  featureFlags,
  getComingSoonFlags,
  getEnabledPipelineTabs,
  getFeaturePageAccess,
  getPipelineDetailsRoutePattern,
  isFeatureAccessible,
  isFeatureComingSoon,
  isFeatureEnabled,
  isFeatureHidden,
  isPipelineTabEnabled,
  isRouteNavVisible,
  PIPELINE_TAB_FEATURE_FLAGS,
  type FeatureFlag,
  type GatedPipelineTab,
} from "./featureFlag";

const originalHideDisabled = featureFlagUi.hideDisabledFeaturesFromNav;

describe("featureFlag", () => {
  afterEach(() => {
    featureFlagUi.hideDisabledFeaturesFromNav = originalHideDisabled;
  });

  it("derives enabled, hidden, and coming-soon state from featureConfig", () => {
    featureFlags.forEach((flag) => {
      const { enabled, mode } = featureConfig[flag];

      expect(isFeatureEnabled(flag)).toBe(enabled);
      expect(isFeatureHidden(flag)).toBe(!enabled && mode === "hidden");
      expect(isFeatureComingSoon(flag)).toBe(!enabled && mode === "comingSoon");
    });
  });

  it("keeps ungated routes visible and reachable", () => {
    expect(isRouteNavVisible(undefined)).toBe(true);
    expect(isFeatureAccessible(undefined)).toBe(true);
  });

  it("applies the current nav policy to every feature flag", () => {
    featureFlags.forEach((flag) => {
      const visible = isRouteNavVisible(flag);
      const accessible = isFeatureAccessible(flag);
      const access = getFeaturePageAccess(flag);

      if (isFeatureEnabled(flag)) {
        expect(visible).toBe(true);
        expect(accessible).toBe(true);
        expect(access).toBe("enabled");
        return;
      }

      if (isFeatureHidden(flag)) {
        expect(visible).toBe(false);
        expect(accessible).toBe(false);
        expect(access).toBe("unavailable");
        return;
      }

      expect(visible).toBe(!featureFlagUi.hideDisabledFeaturesFromNav);
      expect(accessible).toBe(!featureFlagUi.hideDisabledFeaturesFromNav);
      expect(access).toBe(
        featureFlagUi.hideDisabledFeaturesFromNav ? "unavailable" : "comingSoon"
      );
    });
  });

  it.skipIf(getComingSoonFlags().length === 0)(
    "toggles coming-soon nav visibility with hideDisabledFeaturesFromNav",
    () => {
      const comingSoonFlags = getComingSoonFlags();

      featureFlagUi.hideDisabledFeaturesFromNav = false;
      comingSoonFlags.forEach((flag) => {
        expect(isRouteNavVisible(flag)).toBe(true);
        expect(isFeatureAccessible(flag)).toBe(true);
        expect(getFeaturePageAccess(flag)).toBe("comingSoon");
      });

      featureFlagUi.hideDisabledFeaturesFromNav = true;
      comingSoonFlags.forEach((flag) => {
        expect(isRouteNavVisible(flag)).toBe(false);
        expect(isFeatureAccessible(flag)).toBe(false);
        expect(getFeaturePageAccess(flag)).toBe("unavailable");
      });
    }
  );

  it("keeps enabled features visible even when their mode is hidden", () => {
    const enabledHiddenFlags = featureFlags.filter(
      (flag) => featureConfig[flag].enabled && featureConfig[flag].mode === "hidden"
    );

    enabledHiddenFlags.forEach((flag) => {
      expect(isRouteNavVisible(flag)).toBe(true);
      expect(isFeatureAccessible(flag)).toBe(true);
    });
  });

  it("returns enabled pipeline tabs based on feature flags", () => {
    const tabs = getEnabledPipelineTabs();

    expect(tabs).toContain("overview");
    expect(tabs).toContain("edit");

    (Object.entries(PIPELINE_TAB_FEATURE_FLAGS) as [GatedPipelineTab, FeatureFlag][]).forEach(
      ([tab, flag]) => {
        expect(tabs.includes(tab)).toBe(isFeatureEnabled(flag));
        expect(isPipelineTabEnabled(tab)).toBe(isFeatureEnabled(flag));
      }
    );
  });

  it("builds a pipeline details route pattern from enabled tabs", () => {
    const pattern = getPipelineDetailsRoutePattern();

    expect(pattern.test("/pipeline/1/overview")).toBe(true);
    expect(pattern.test("/pipeline/1/edit")).toBe(true);
    expect(pattern.test("/pipeline/1/monitoring")).toBe(
      isPipelineTabEnabled("monitoring")
    );
    expect(pattern.test("/pipeline/1/logs")).toBe(isPipelineTabEnabled("logs"));
    expect(pattern.test("/pipeline/1/action")).toBe(isPipelineTabEnabled("action"));
    expect(pattern.test("/pipeline/1/unknown")).toBe(false);
  });
});
