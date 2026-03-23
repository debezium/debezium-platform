import type { ErrorObject } from "ajv";

export const PIPELINE_NAME_MAX_LENGTH = 253;
export const RFC_1123_SUBDOMAIN_PATTERN_SOURCE =
  "^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$";
export const RFC_1123_SUBDOMAIN_PATTERN = new RegExp(
  RFC_1123_SUBDOMAIN_PATTERN_SOURCE
);

export const PIPELINE_NAME_REQUIRED_ERROR = "Pipeline name is required.";
export const PIPELINE_NAME_LENGTH_ERROR =
  "Pipeline name must be 253 characters or fewer.";
export const PIPELINE_NAME_RFC_1123_ERROR =
  "Pipeline name must be lowercase and use only letters, numbers, '-' or '.'.";

const PIPELINE_NAME_INSTANCE_PATH = "/name";

export const getPipelineNameValidationError = (
  value: string | undefined
): string | undefined => {
  if (!value) {
    return PIPELINE_NAME_REQUIRED_ERROR;
  }

  if (value.length > PIPELINE_NAME_MAX_LENGTH) {
    return PIPELINE_NAME_LENGTH_ERROR;
  }

  if (!RFC_1123_SUBDOMAIN_PATTERN.test(value)) {
    return PIPELINE_NAME_RFC_1123_ERROR;
  }

  return undefined;
};

export const getPipelineSchemaValidationError = (
  errors: ErrorObject[] | null | undefined
): string | undefined => {
  if (!errors) {
    return undefined;
  }

  for (const error of errors) {
    if (
      error.keyword === "required" &&
      (error.params as { missingProperty?: string }).missingProperty === "name"
    ) {
      return PIPELINE_NAME_REQUIRED_ERROR;
    }

    if (error.instancePath !== PIPELINE_NAME_INSTANCE_PATH) {
      continue;
    }

    if (error.keyword === "maxLength") {
      return PIPELINE_NAME_LENGTH_ERROR;
    }

    if (error.keyword === "pattern") {
      return PIPELINE_NAME_RFC_1123_ERROR;
    }
  }

  return undefined;
};
