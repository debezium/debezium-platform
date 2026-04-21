import { describe, it, expect } from "vitest";
import { pipelineAction } from "./pipelineActions";

describe("pipelineActions", () => {
  it("exports snapshot and log action definitions", () => {
    const types = pipelineAction.map((a) => a.type);
    expect(types).toContain("execute-snapshot");
    expect(types).toContain("stop-snapshot");
    expect(types).toContain("pause-snapshot");
    expect(types).toContain("resume-snapshot");
    expect(types).toContain("log");
    expect(pipelineAction.find((a) => a.type === "log")?.data).toEqual({
      message: "",
    });
  });
});
