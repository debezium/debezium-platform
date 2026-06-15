import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeatureGate } from "./FeatureGate";
import { render } from "../__test__/unit/test-utils";

vi.mock("../appLayout/AppContext", () => ({
  useData: () => ({
    darkMode: false,
    navigationCollapsed: false,
    setDarkMode: vi.fn(),
    updateNavigationCollapsed: vi.fn(),
  }),
}));

vi.mock("@utils/featureFlag", async () => {
  const actual = await vi.importActual<typeof import("@utils/featureFlag")>(
    "@utils/featureFlag"
  );

  return {
    ...actual,
    isFeatureEnabled: vi.fn(actual.isFeatureEnabled),
    isFeatureHidden: vi.fn(actual.isFeatureHidden),
    isFeatureComingSoon: vi.fn(actual.isFeatureComingSoon),
  };
});

import {
  isFeatureComingSoon,
  isFeatureEnabled,
  isFeatureHidden,
} from "@utils/featureFlag";

describe("FeatureGate", () => {
  it("renders children when the feature is enabled", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
    vi.mocked(isFeatureHidden).mockReturnValue(false);
    vi.mocked(isFeatureComingSoon).mockReturnValue(false);

    render(
      <FeatureGate flag="Vault">
        <div>Vault content</div>
      </FeatureGate>
    );

    expect(screen.getByText("Vault content")).toBeInTheDocument();
    expect(screen.queryByAltText("Coming Soon")).not.toBeInTheDocument();
  });

  it("renders fallback when the feature is hidden", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
    vi.mocked(isFeatureHidden).mockReturnValue(true);
    vi.mocked(isFeatureComingSoon).mockReturnValue(false);

    render(
      <FeatureGate flag="PipelineMonitoring" fallback={<div>Hidden</div>}>
        <div>Monitoring content</div>
      </FeatureGate>
    );

    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.queryByText("Monitoring content")).not.toBeInTheDocument();
  });

  it("renders a coming-soon overlay when the feature is in preview mode", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
    vi.mocked(isFeatureHidden).mockReturnValue(false);
    vi.mocked(isFeatureComingSoon).mockReturnValue(true);

    render(
      <FeatureGate flag="Vault">
        <div>Vault content</div>
      </FeatureGate>
    );

    expect(screen.getByAltText("Coming Soon")).toBeInTheDocument();
    expect(screen.getByText("Vault content")).toBeInTheDocument();
  });
});
