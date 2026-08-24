export type FeatureFlagMode = "hidden" | "comingSoon";

export type FeatureFlagConfig = {
  enabled: boolean;
  mode: FeatureFlagMode;
};

export const featureConfig = {
  Vault: { enabled: false, mode: "comingSoon" },
  Connection: { enabled: true, mode: "comingSoon" },
  Transforms: { enabled: true, mode: "comingSoon" },
  Alerts: { enabled: false, mode: "comingSoon" },
  PipelineMonitoring: { enabled: true, mode: "hidden" },
  PipelineAction: { enabled: true, mode: "hidden" },
  PipelineLogs: { enabled: true, mode: "hidden" },
} as const satisfies Record<string, FeatureFlagConfig>;

export type FeatureFlag = keyof typeof featureConfig;

/**
 * UI policy for disabled features.
 * - `false` (default): coming-soon features stay in the sidebar and remain reachable, with the coming-soon overlay.
 * - `true`: disabled features are omitted from the sidebar and their routes 404.
 */
export const featureFlagUi = {
  hideDisabledFeaturesFromNav: true,
};

export const PIPELINE_TAB_FEATURE_FLAGS = {
  action: "PipelineAction",
  logs: "PipelineLogs",
  monitoring: "PipelineMonitoring",
} as const;

export type GatedPipelineTab = keyof typeof PIPELINE_TAB_FEATURE_FLAGS;

const PIPELINE_TAB_ORDER = [
  "overview",
  "action",
  "monitoring",
  "logs",
  "edit",
] as const;

export const isFeatureEnabled = (flag: FeatureFlag): boolean =>
  featureConfig[flag].enabled;

export const isFeatureHidden = (flag: FeatureFlag): boolean => {
  const config = featureConfig[flag] as FeatureFlagConfig;
  return !config.enabled && config.mode === "hidden";
};

export const isFeatureComingSoon = (flag: FeatureFlag): boolean => {
  const config = featureConfig[flag] as FeatureFlagConfig;
  return !config.enabled && config.mode === "comingSoon";
};

/** Hidden features are never routable; coming-soon features 404 only when stripped from nav. */
export const isFeatureAccessible = (flag: FeatureFlag | undefined): boolean => {
  if (!flag) {
    return true;
  }
  if (isFeatureHidden(flag)) {
    return false;
  }
  if (featureFlagUi.hideDisabledFeaturesFromNav) {
    return isFeatureEnabled(flag);
  }
  return true;
};

/** Hidden features are always excluded from nav; coming-soon features stay unless stripped. */
export const isRouteNavVisible = (flag: FeatureFlag | undefined): boolean => {
  if (!flag) {
    return true;
  }
  if (isFeatureHidden(flag)) {
    return false;
  }
  if (featureFlagUi.hideDisabledFeaturesFromNav) {
    return isFeatureEnabled(flag);
  }
  return true;
};

export const getEnabledPipelineTabs = (): string[] =>
  PIPELINE_TAB_ORDER.filter((tab) => {
    const flag =
      PIPELINE_TAB_FEATURE_FLAGS[tab as GatedPipelineTab];
    return flag === undefined || isFeatureEnabled(flag);
  });

export const isPipelineTabEnabled = (tab: string): boolean =>
  getEnabledPipelineTabs().includes(tab);

export const getPipelineDetailsRoutePattern = (): RegExp => {
  const enabledTabs = getEnabledPipelineTabs().join("|");
  return new RegExp(`^\\/pipeline\\/[^/]+\\/(${enabledTabs})$`);
};
