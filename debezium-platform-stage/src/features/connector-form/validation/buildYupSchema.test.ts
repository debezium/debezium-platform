import { describe, expect, test } from 'vitest';
import { buildYupSchema } from './buildYupSchema';
import type { NormalizedSchema } from '../types';

const schemaWithRequiredHidden: NormalizedSchema = {
  connectorName: 'Test',
  groups: [
    {
      name: 'G1',
      order: 0,
      description: '',
      fields: [
        {
          name: 'visible.required',
          fieldType: 'text',
          label: 'Visible Required',
          description: '',
          group: 'G1',
          groupOrder: 0,
          width: 'medium',
          importance: 'high',
          required: true,
        },
        {
          name: 'hidden.required',
          fieldType: 'text',
          label: 'Hidden Required',
          description: '',
          group: 'G1',
          groupOrder: 1,
          width: 'medium',
          importance: 'low',
          required: true,
        },
      ],
    },
  ],
  visibilityMap: {
    'hidden.required': [
      { watchField: 'adapter', whenValues: ['xstream'] },
    ],
  },
  triggerFields: ['adapter'],
};

const schemaWithEnum: NormalizedSchema = {
  connectorName: 'Test',
  groups: [
    {
      name: 'G1',
      order: 0,
      description: '',
      fields: [
        {
          name: 'snapshot.mode',
          fieldType: 'select',
          label: 'Snapshot mode',
          description: '',
          group: 'G1',
          groupOrder: 0,
          width: 'short',
          importance: 'low',
          required: false,
          options: [
            { value: 'initial', label: 'initial' },
            { value: 'always', label: 'always' },
            { value: 'custom', label: 'custom' },
          ],
        },
      ],
    },
  ],
  visibilityMap: {},
  triggerFields: [],
};

const schemaWithNumber: NormalizedSchema = {
  connectorName: 'Test',
  groups: [
    {
      name: 'G1',
      order: 0,
      description: '',
      fields: [
        {
          name: 'port',
          fieldType: 'number',
          label: 'Port',
          description: '',
          group: 'G1',
          groupOrder: 0,
          width: 'short',
          importance: 'low',
          required: false,
        },
      ],
    },
  ],
  visibilityMap: {},
  triggerFields: [],
};

describe('buildYupSchema', () => {
  test('hidden field skips required: field required=true but not in visibleSet → no error', async () => {
    const visibleSet = new Set(['visible.required']);
    const yupSchema = buildYupSchema(schemaWithRequiredHidden, visibleSet);

    const valid = await yupSchema.validate({
      'visible.required': 'filled',
      'hidden.required': '',
    });
    expect(valid).toEqual({
      'visible.required': 'filled',
      'hidden.required': '',
    });

    await expect(
      yupSchema.validate({
        'visible.required': '',
        'hidden.required': '',
      })
    ).rejects.toThrow();
  });

  test('enum field rejects invalid value', async () => {
    const visibleSet = new Set(['snapshot.mode']);
    const yupSchema = buildYupSchema(schemaWithEnum, visibleSet);

    await expect(
      yupSchema.validate({ 'snapshot.mode': 'invalid' })
    ).rejects.toThrow(/must be one of the allowed values/);

    const valid = await yupSchema.validate({ 'snapshot.mode': 'initial' });
    expect(valid['snapshot.mode']).toBe('initial');
  });

  test('number field type coercion: string abc in number field → typeError', async () => {
    const visibleSet = new Set(['port']);
    const yupSchema = buildYupSchema(schemaWithNumber, visibleSet);

    await expect(
      yupSchema.validate({ port: 'abc' })
    ).rejects.toThrow(/must be a number/);

    const valid = await yupSchema.validate({ port: 8080 });
    expect(valid.port).toBe(8080);
  });

  test('number field accepts empty when not required', async () => {
    const visibleSet = new Set(['port']);
    const yupSchema = buildYupSchema(schemaWithNumber, visibleSet);

    const valid = await yupSchema.validate({ port: undefined });
    expect(valid.port).toBeUndefined();
  });
});
