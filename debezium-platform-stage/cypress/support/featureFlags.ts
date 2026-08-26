import {
  getEnabledPipelineTabs,
  getFeaturePageAccess,
  isFeatureAccessible,
  isPipelineTabEnabled,
  isRouteNavVisible,
  type FeatureFlag,
} from "../../src/utils/featureFlag";

export {
  getEnabledPipelineTabs,
  getFeaturePageAccess,
  isFeatureAccessible,
  isPipelineTabEnabled,
  isRouteNavVisible,
};
export type { FeatureFlag };

export const PIPELINE_TAB_LABELS = {
  overview: "Overview",
  action: "Actions",
  monitoring: "Monitoring",
  logs: "Logs",
  edit: "Edit",
} as const;

export const FLAGGED_NAV_TOURS: { flag: FeatureFlag; tour: string }[] = [
  { flag: "Transforms", tour: "nav-transform" },
  { flag: "Connection", tour: "nav-connections" },
  { flag: "Vault", tour: "nav-vaults" },
];

export const skipIfFeatureUnavailable = (flag: FeatureFlag) => {
  before(function () {
    if (!isFeatureAccessible(flag)) {
      this.skip();
    }
  });
};
