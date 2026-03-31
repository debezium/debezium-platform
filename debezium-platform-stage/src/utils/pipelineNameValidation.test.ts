import type { ErrorObject } from "ajv";
import { describe, expect, it } from "vitest";

import {
  PIPELINE_NAME_LENGTH_ERROR_I18N_KEY,
  PIPELINE_NAME_REQUIRED_ERROR_I18N_KEY,
  PIPELINE_NAME_RFC_1123_ERROR_I18N_KEY,
  getPipelineSchemaValidationError,
  getPipelineNameValidationError,
} from "./pipelineNameValidation";

const mockAjvError = (error: Partial<ErrorObject>): ErrorObject =>
  error as ErrorObject;

describe("getPipelineNameValidationError", () => {
  it("rejects empty names", () => {
    expect(getPipelineNameValidationError("")).toBe(
      PIPELINE_NAME_REQUIRED_ERROR_I18N_KEY
    );
  });

  it("rejects names that are not RFC 1123 compliant", () => {
    expect(getPipelineNameValidationError("Demo")).toBe(
      PIPELINE_NAME_RFC_1123_ERROR_I18N_KEY
    );
    expect(getPipelineNameValidationError("demo_pipeline")).toBe(
      PIPELINE_NAME_RFC_1123_ERROR_I18N_KEY
    );
  });

  it("rejects names longer than 253 characters", () => {
    expect(getPipelineNameValidationError("a".repeat(254))).toBe(
      PIPELINE_NAME_LENGTH_ERROR_I18N_KEY
    );
  });

  it("accepts valid pipeline names", () => {
    expect(getPipelineNameValidationError("test-pipeline")).toBeUndefined();
    expect(getPipelineNameValidationError("test.pipeline-1")).toBeUndefined();
  });
});

describe("getPipelineSchemaValidationError", () => {
  it("maps missing name errors to the friendly required message", () => {
    expect(
      getPipelineSchemaValidationError([
        mockAjvError({
          keyword: "required",
          instancePath: "",
          params: { missingProperty: "name" },
        }),
      ])
    ).toBe(PIPELINE_NAME_REQUIRED_ERROR_I18N_KEY);
  });

  it("maps name pattern errors to the friendly RFC 1123 message", () => {
    expect(
      getPipelineSchemaValidationError([
        mockAjvError({
          keyword: "pattern",
          instancePath: "/name",
          params: { pattern: "..." },
        }),
      ])
    ).toBe(PIPELINE_NAME_RFC_1123_ERROR_I18N_KEY);
  });

  it("maps name length errors to the friendly max length message", () => {
    expect(
      getPipelineSchemaValidationError([
        mockAjvError({
          keyword: "maxLength",
          instancePath: "/name",
          params: { limit: 253 },
        }),
      ])
    ).toBe(PIPELINE_NAME_LENGTH_ERROR_I18N_KEY);
  });

  it("returns undefined for unrelated schema errors", () => {
    expect(
      getPipelineSchemaValidationError([
        mockAjvError({
          keyword: "type",
          instancePath: "/source",
          params: { type: "object" },
        }),
      ])
    ).toBeUndefined();
  });
});
