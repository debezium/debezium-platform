import { describe, it, expect } from "vitest";
import {
  buildPipelineRestartPayload,
  getActivePipelineCount,
} from "./pipelineUtils";
import type { Pipeline } from "../apis/apis";

describe("getActivePipelineCount", () => {
  const pipelines: Pipeline[] = [
    {
      id: 1,
      name: "p1",
      description: "",
      errorMessage: "",
      status: "FAILED",
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
      errorMessage: "",
      status: "FAILED",
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
        errorMessage: "",
        status: "FAILED",
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

describe("buildPipelineRestartPayload", () => {
  it("builds a PUT payload without status or errorMessage", () => {
    const pipeline: Pipeline = {
      id: 1,
      name: "orders-pipeline",
      description: "CDC orders",
      errorMessage: "Something failed",
      status: "FAILED",
      source: { id: 10, name: "orders-src" },
      destination: { id: 20, name: "orders-dest" },
      transforms: [
        { id: 6, name: "t6" },
        { id: 7, name: "t7" },
      ],
      logLevel: "DEBUG",
      logLevels: { "io.debezium": "INFO" },
    };

    expect(buildPipelineRestartPayload(pipeline)).toEqual({
      name: "orders-pipeline",
      description: "CDC orders",
      source: { id: 10, name: "orders-src" },
      destination: { id: 20, name: "orders-dest" },
      transforms: [
        { id: 6, name: "t6" },
        { id: 7, name: "t7" },
      ],
      logLevel: "DEBUG",
      logLevels: { "io.debezium": "INFO" },
    });
  });

  it("defaults missing logLevels to an empty object", () => {
    const pipeline = {
      id: 1,
      name: "p1",
      description: undefined,
      errorMessage: "fail",
      status: "FAILED" as const,
      source: { id: 1, name: "s" },
      destination: { id: 2, name: "d" },
      transforms: [],
      logLevel: "INFO",
      logLevels: undefined as unknown as Pipeline["logLevels"],
    };

    expect(buildPipelineRestartPayload(pipeline).logLevels).toEqual({});
  });
});
