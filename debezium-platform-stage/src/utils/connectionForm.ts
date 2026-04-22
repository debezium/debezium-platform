import get from "lodash/get";
import set from "lodash/set";
import * as yup from "yup";
import type { ConnectionSchema } from "../apis/apis";

/**
 * API config uses flat keys (e.g. `bootstrap.servers`). RHF Controllers with `name="bootstrap.servers"` read/write
 * nested state (`bootstrap.servers` as a path). Passing flat keys into `reset()` can leave nested state stale so
 * submits still see the old value — convert dotted keys to nested objects before `reset`/`defaultValues`.
 */
export const flatConnectionConfigToRhfShape = (fields: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k.includes(".")) {
      set(out, k, v);
    } else {
      out[k] = v;
    }
  }
  return out;
};

/**
 * React Hook Form treats dots in field names as nested paths (e.g. bootstrap.servers → data.bootstrap.servers).
 * Connection APIs expect flat string keys. This maps form values back to flat config using the same path semantics as lodash get.
 * For dotted keys, falls back to a literal `data[key]` when the nested path is missing (mixed flat/nested state).
 */
export const buildFlatConfigFromFormData = (
  data: Record<string, unknown>,
  propertyKeys: string[]
): Record<string, string | number> =>
  propertyKeys.reduce((acc, key) => {
    let value = get(data, key) as string | number | undefined;
    if (key.includes(".") && value === undefined && Object.prototype.hasOwnProperty.call(data, key)) {
      value = data[key] as string | number | undefined;
    }
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string | number>);

/**
 * Yup shape nested the same way RHF stores dotted field names, so validation matches Controller `name` values.
 */
export const buildNestedConnectionYupFields = (
  connectionSchema: ConnectionSchema | undefined
): Record<string, yup.AnySchema> => {
  if (!connectionSchema?.properties) return {};

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const schemaObj: any = {};

  Object.entries(connectionSchema.properties).forEach(([field, propSchema]) => {
    const isRequired = connectionSchema.required?.includes(field);
    const isNumeric = propSchema.type === "integer";
    const validator = isNumeric
      ? yup
          .number()
          .transform((currentValue, originalValue) => (originalValue === "" ? undefined : currentValue))
          .typeError("Must be a integer")
      : yup.string();

    const finalValidator = isRequired ? validator.required() : validator.notRequired();

    if (field.includes(".")) {
      const parts = field.split(".");
      let current = schemaObj;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }

      current[parts[parts.length - 1]] = finalValidator;
    } else {
      schemaObj[field] = finalValidator;
    }
  });

  const convertToYupObjects = (obj: any): any => {
    const result: any = {};
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === "object" && !obj[key]._type) {
        result[key] = yup.object(convertToYupObjects(obj[key]));
      } else {
        result[key] = obj[key];
      }
    }
    return result;
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return convertToYupObjects(schemaObj);
};
