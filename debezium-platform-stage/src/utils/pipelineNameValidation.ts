import type { ErrorObject } from "ajv";

export const PIPELINE_NAME_MAX_LENGTH = 253;
export const RFC_1123_SUBDOMAIN_PATTERN_SOURCE =
  "^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$";
export const RFC_1123_SUBDOMAIN_PATTERN = new RegExp(
  RFC_1123_SUBDOMAIN_PATTERN_SOURCE
);

export const PIPELINE_NAME_REQUIRED_ERROR_I18N_KEY =
  "pipeline:validation.nameRequired";
export const PIPELINE_NAME_LENGTH_ERROR_I18N_KEY =
  "pipeline:validation.nameMaxLength";
export const PIPELINE_NAME_RFC_1123_ERROR_I18N_KEY =
  "pipeline:validation.nameRfc1123";

export type PipelineNameValidationErrorI18nKey =
  | typeof PIPELINE_NAME_REQUIRED_ERROR_I18N_KEY
  | typeof PIPELINE_NAME_LENGTH_ERROR_I18N_KEY
  | typeof PIPELINE_NAME_RFC_1123_ERROR_I18N_KEY;

const PIPELINE_NAME_INSTANCE_PATH = "/name";

export const getPipelineNameValidationError = (
  value: string | undefined
): PipelineNameValidationErrorI18nKey | undefined => {
  if (!value) {
    return PIPELINE_NAME_REQUIRED_ERROR_I18N_KEY;
  }

  if (value.length > PIPELINE_NAME_MAX_LENGTH) {
    return PIPELINE_NAME_LENGTH_ERROR_I18N_KEY;
  }

  if (!RFC_1123_SUBDOMAIN_PATTERN.test(value)) {
    return PIPELINE_NAME_RFC_1123_ERROR_I18N_KEY;
  }

  return undefined;
};

export const getPipelineSchemaValidationError = (
  errors: ErrorObject[] | null | undefined
): PipelineNameValidationErrorI18nKey | undefined => {
  if (!errors) {
    return undefined;
  }

  for (const error of errors) {
    if (
      error.keyword === "required" &&
      (error.params as { missingProperty?: string }).missingProperty === "name"
    ) {
      return PIPELINE_NAME_REQUIRED_ERROR_I18N_KEY;
    }

    if (error.instancePath !== PIPELINE_NAME_INSTANCE_PATH) {
      continue;
    }

    if (error.keyword === "maxLength") {
      return PIPELINE_NAME_LENGTH_ERROR_I18N_KEY;
    }

    if (error.keyword === "pattern") {
      return PIPELINE_NAME_RFC_1123_ERROR_I18N_KEY;
    }
  }

  return undefined;
};
