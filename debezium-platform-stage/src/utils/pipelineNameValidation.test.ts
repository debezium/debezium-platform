import { describe, expect, it } from "vitest";

import {
  PIPELINE_NAME_LENGTH_ERROR,
  PIPELINE_NAME_REQUIRED_ERROR,
  PIPELINE_NAME_RFC_1123_ERROR,
  getPipelineNameValidationError,
} from "./pipelineNameValidation";

describe("getPipelineNameValidationError", () => {
  it("rejects empty names", () => {
    expect(getPipelineNameValidationError("")).toBe(
      PIPELINE_NAME_REQUIRED_ERROR
    );
  });

  it("rejects names that are not RFC 1123 compliant", () => {
    expect(getPipelineNameValidationError("Demo")).toBe(
      PIPELINE_NAME_RFC_1123_ERROR
    );
    expect(getPipelineNameValidationError("demo_pipeline")).toBe(
      PIPELINE_NAME_RFC_1123_ERROR
    );
  });

  it("rejects names longer than 253 characters", () => {
    expect(getPipelineNameValidationError("a".repeat(254))).toBe(
      PIPELINE_NAME_LENGTH_ERROR
    );
  });

  it("accepts valid pipeline names", () => {
    expect(getPipelineNameValidationError("test-pipeline")).toBeUndefined();
    expect(getPipelineNameValidationError("test.pipeline-1")).toBeUndefined();
  });
});
