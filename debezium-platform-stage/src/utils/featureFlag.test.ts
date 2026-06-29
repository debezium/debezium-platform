import { describe, expect, it } from "vitest";
import {
  featureConfig,
  getEnabledPipelineTabs,
  getPipelineDetailsRoutePattern,
  isFeatureComingSoon,
  isFeatureEnabled,
  isFeatureHidden,
  isPipelineTabEnabled,
  isRouteNavVisible,
} from "./featureFlag";

describe("featureFlag", () => {
  it("exposes disabled coming-soon and hidden features", () => {
    expect(featureConfig.Vault).toEqual({
      enabled: false,
      mode: "comingSoon",
    });
  });

  it("exposes enabled coming-soon and hidden features", () => {
    expect(featureConfig.Connection).toEqual({
      enabled: true,
      mode: "comingSoon",
    });
    expect(featureConfig.Transforms).toEqual({
      enabled: true,
      mode: "comingSoon",
    });
    expect(featureConfig.PipelineMonitoring).toEqual({
      enabled: true,
      mode: "hidden",
    });
    expect(featureConfig.PipelineAction).toEqual({
      enabled: true,
      mode: "hidden",
    });
    expect(featureConfig.PipelineLogs).toEqual({
      enabled: true,
      mode: "hidden",
    });
  });

  it("identifies enabled and disabled features", () => {
    expect(isFeatureEnabled("Vault")).toBe(false);
    expect(isFeatureEnabled("PipelineMonitoring")).toBe(true);
    expect(isFeatureEnabled("Connection")).toBe(true);
    expect(isFeatureEnabled("Transforms")).toBe(true);
    expect(isFeatureEnabled("PipelineAction")).toBe(true);
    expect(isFeatureEnabled("PipelineLogs")).toBe(true);
  });

  it("identifies hidden features only when disabled", () => {
    expect(isFeatureHidden("PipelineMonitoring")).toBe(false);
    expect(isFeatureHidden("PipelineAction")).toBe(false);
    expect(isFeatureHidden("PipelineLogs")).toBe(false);
    expect(isFeatureHidden("Vault")).toBe(false);
  });

  it("identifies coming-soon features only when disabled", () => {
    expect(isFeatureComingSoon("Vault")).toBe(true);
    expect(isFeatureComingSoon("Connection")).toBe(false);
    expect(isFeatureComingSoon("Transforms")).toBe(false);
    expect(isFeatureComingSoon("PipelineMonitoring")).toBe(false);
  });

  it("keeps coming-soon routes visible in navigation", () => {
    expect(isRouteNavVisible("Vault")).toBe(true);
    expect(isRouteNavVisible("Connection")).toBe(true);
    expect(isRouteNavVisible("Transforms")).toBe(true);
    expect(isRouteNavVisible(undefined)).toBe(true);
  });

  it("hides disabled hidden features from navigation", () => {
    expect(isRouteNavVisible("PipelineMonitoring")).toBe(true);
    expect(isRouteNavVisible("PipelineAction")).toBe(true);
    expect(isRouteNavVisible("PipelineLogs")).toBe(true);
  });

  it("returns enabled pipeline tabs based on feature flags", () => {
    expect(getEnabledPipelineTabs()).toEqual([
      "overview",
      "action",
      "monitoring",
      "logs",
      "edit",
    ]);
    expect(isPipelineTabEnabled("monitoring")).toBe(true);
    expect(isPipelineTabEnabled("action")).toBe(true);
    expect(isPipelineTabEnabled("logs")).toBe(true);
  });

  it("builds a pipeline details route pattern from enabled tabs", () => {
    expect(getPipelineDetailsRoutePattern().test("/pipeline/1/overview")).toBe(
      true
    );
    expect(getPipelineDetailsRoutePattern().test("/pipeline/1/monitoring")).toBe(
      true
    );
    expect(getPipelineDetailsRoutePattern().test("/pipeline/1/logs")).toBe(true);
  });
});
