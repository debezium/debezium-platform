import { describe, it, expect } from "vitest";
import { getActivePipelineCount } from "./pipelineUtils";
import type { Pipeline } from "../apis/apis";

describe("getActivePipelineCount", () => {
  const pipelines: Pipeline[] = [
    {
      id: 1,
      name: "p1",
      description: "",
      source: { id: 10, name: "s10" },
      destination: { id: 20, name: "d20" },
      transforms: [{ id: 6, name: "t6" }],
      logLevel: "INFO",
      logLevels: {},
    },
    {
      id: 2,
      name: "p2",
      description: "",
      source: { id: 11, name: "s11" },
      destination: { id: 21, name: "d21" },
      transforms: [{ id: 7, name: "t7" }],
      logLevel: "INFO",
      logLevels: {},
    },
  ];

  it("counts pipelines that include a transform id", () => {
    expect(getActivePipelineCount(pipelines, 6, "transform")).toBe(1);
    expect(getActivePipelineCount(pipelines, 7, "transform")).toBe(1);
    expect(getActivePipelineCount(pipelines, 99, "transform")).toBe(0);
  });

  it("counts pipelines by source id", () => {
    expect(getActivePipelineCount(pipelines, 10, "source")).toBe(1);
    expect(getActivePipelineCount(pipelines, 11, "source")).toBe(1);
    expect(getActivePipelineCount(pipelines, 99, "source")).toBe(0);
  });

  it("counts pipelines by destination id", () => {
    expect(getActivePipelineCount(pipelines, 20, "destination")).toBe(1);
    expect(getActivePipelineCount(pipelines, 21, "destination")).toBe(1);
    expect(getActivePipelineCount(pipelines, 99, "destination")).toBe(0);
  });

  it("defaults type to transform", () => {
    expect(getActivePipelineCount(pipelines, 6)).toBe(1);
  });

  it("treats missing transforms array as no matches", () => {
    const noTransforms: Pipeline[] = [
      {
        id: 3,
        name: "p3",
        description: "",
        source: { id: 1, name: "s" },
        destination: { id: 2, name: "d" },
        transforms: undefined as unknown as Pipeline["transforms"],
        logLevel: "INFO",
        logLevels: {},
      },
    ];
    expect(getActivePipelineCount(noTransforms, 6, "transform")).toBe(0);
  });
});
