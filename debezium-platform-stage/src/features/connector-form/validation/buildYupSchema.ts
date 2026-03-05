import * as yup from 'yup';
import type { NormalizedSchema, NormalizedField } from '../types';

function buildFieldRule(
  field: NormalizedField,
  visibleFieldNames: Set<string>
): yup.AnySchema {
  const isVisible = visibleFieldNames.has(field.name);

  if (!isVisible) {
    return yup.mixed().optional();
  }

  let rule: yup.AnySchema;

  switch (field.fieldType) {
    case 'number':
      rule = yup
        .number()
        .transform((val) => (val === '' || val == null ? undefined : val))
        .typeError(`${field.label} must be a number`);
      break;
    case 'boolean':
      rule = yup.boolean();
      break;
    case 'select':
      rule = yup.string();
      if (field.options && field.options.length > 0) {
        const validValues = ['', ...field.options.map((o) => o.value)];
        rule = (rule as yup.StringSchema).oneOf(
          validValues,
          `${field.label} must be one of the allowed values`
        );
      }
      break;
    case 'multiInput':
    case 'text':
    default:
      rule = yup.string();
      break;
  }

  if (field.required && isVisible) {
    rule = rule.required(`${field.label} is required`);
  } else {
    rule = rule.optional().nullable();
  }

  return rule;
}

/**
 * Builds a Yup schema from NormalizedSchema and visible field names.
 * Hidden fields always pass validation. Required visible fields fail when empty.
 * Call with useMemo([normalizedSchema, visibleFields]) — schema rebuilds on visibility change.
 */
export function buildYupSchema(
  schema: NormalizedSchema,
  visibleFieldNames: Set<string>
): yup.ObjectSchema<Record<string, unknown>> {
  const shape: Record<string, yup.AnySchema> = {};

  for (const group of schema.groups) {
    for (const field of group.fields) {
      shape[field.name] = buildFieldRule(field, visibleFieldNames);
    }
  }

  return yup.object().shape(shape) as yup.ObjectSchema<Record<string, unknown>>;
}
