import { describe, expect, test } from 'vitest';
import { normalizeSchema } from './normalizeSchema';
import type { RawConnectorSchema } from '../types';
import oracleFixture from '../../../__fixtures__/oracle.json';

const oracleSchema = oracleFixture as RawConnectorSchema;

describe('normalizeSchema', () => {
  describe('field type mapping', () => {
    test('boolean maps to fieldType boolean', () => {
      const raw: RawConnectorSchema = {
        name: 'Test',
        type: 'source',
        version: '1.0',
        metadata: { description: '' },
        groups: [{ name: 'G1', order: 0, description: '' }],
        properties: [
          {
            name: 'flag',
            type: 'boolean',
            display: {
              label: 'Flag',
              description: '',
              group: 'G1',
              groupOrder: 0,
            },
          },
        ],
      };
      const result = normalizeSchema(raw);
      expect(result.groups[0].fields[0].fieldType).toBe('boolean');
    });

    test('number maps to fieldType number', () => {
      const raw: RawConnectorSchema = {
        name: 'Test',
        type: 'source',
        version: '1.0',
        metadata: { description: '' },
        groups: [{ name: 'G1', order: 0, description: '' }],
        properties: [
          {
            name: 'port',
            type: 'number',
            display: {
              label: 'Port',
              description: '',
              group: 'G1',
              groupOrder: 0,
            },
          },
        ],
      };
      const result = normalizeSchema(raw);
      expect(result.groups[0].fields[0].fieldType).toBe('number');
    });

    test('list maps to fieldType multiInput', () => {
      const raw: RawConnectorSchema = {
        name: 'Test',
        type: 'source',
        version: '1.0',
        metadata: { description: '' },
        groups: [{ name: 'G1', order: 0, description: '' }],
        properties: [
          {
            name: 'list',
            type: 'list',
            display: {
              label: 'List',
              description: '',
              group: 'G1',
              groupOrder: 0,
            },
          },
        ],
      };
      const result = normalizeSchema(raw);
      expect(result.groups[0].fields[0].fieldType).toBe('multiInput');
    });

    test('string with enum maps to fieldType select with options', () => {
      const raw: RawConnectorSchema = {
        name: 'Test',
        type: 'source',
        version: '1.0',
        metadata: { description: '' },
        groups: [{ name: 'G1', order: 0, description: '' }],
        properties: [
          {
            name: 'mode',
            type: 'string',
            display: {
              label: 'Mode',
              description: '',
              group: 'G1',
              groupOrder: 0,
            },
            validation: [{ type: 'enum', values: ['a', 'b', 'c'] }],
          },
        ],
      };
      const result = normalizeSchema(raw);
      const field = result.groups[0].fields[0];
      expect(field.fieldType).toBe('select');
      expect(field.options).toEqual([
        { value: 'a', label: 'a' },
        { value: 'b', label: 'b' },
        { value: 'c', label: 'c' },
      ]);
    });

    test('string without enum maps to fieldType text', () => {
      const raw: RawConnectorSchema = {
        name: 'Test',
        type: 'source',
        version: '1.0',
        metadata: { description: '' },
        groups: [{ name: 'G1', order: 0, description: '' }],
        properties: [
          {
            name: 'hostname',
            type: 'string',
            display: {
              label: 'Hostname',
              description: '',
              group: 'G1',
              groupOrder: 0,
            },
          },
        ],
      };
      const result = normalizeSchema(raw);
      expect(result.groups[0].fields[0].fieldType).toBe('text');
    });
  });

  describe('visibility map construction', () => {
    test('adapter→XStream dependants correctly populated', () => {
      const result = normalizeSchema(oracleSchema);
      const rules = result.visibilityMap['xstream.out.server.name'];
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      const xstreamRule = rules.find((r) =>
        r.whenValues.some((v) => v.toLowerCase() === 'xstream')
      );
      expect(xstreamRule).toBeDefined();
      expect(xstreamRule!.watchField).toBe('database.connection.adapter');
    });

    test('adapter→OLR dependants map to openlogreplicator fields', () => {
      const result = normalizeSchema(oracleSchema);
      expect(result.visibilityMap['openlogreplicator.host']).toBeDefined();
      expect(result.visibilityMap['openlogreplicator.port']).toBeDefined();
      expect(result.visibilityMap['openlogreplicator.source']).toBeDefined();
      const rules = result.visibilityMap['openlogreplicator.host'];
      const olrRule = rules.find((r) =>
        r.whenValues.some((v) => v.toLowerCase() === 'olr')
      );
      expect(olrRule).toBeDefined();
    });

    test('triggerFields contains database.connection.adapter', () => {
      const result = normalizeSchema(oracleSchema);
      expect(result.triggerFields).toContain('database.connection.adapter');
    });

    test('fields with no valueDependants entry are not in visibilityMap', () => {
      const result = normalizeSchema(oracleSchema);
      expect(result.visibilityMap['topic.prefix']).toBeUndefined();
      expect(result.visibilityMap['database.hostname']).toBeUndefined();
    });
  });

  describe('group sorting and field ordering', () => {
    test('groups in order sequence', () => {
      const result = normalizeSchema(oracleSchema);
      for (let i = 1; i < result.groups.length; i++) {
        expect(result.groups[i].order).toBeGreaterThanOrEqual(
          result.groups[i - 1].order
        );
      }
    });

    test('fields within group in groupOrder sequence', () => {
      const result = normalizeSchema(oracleSchema);
      for (const group of result.groups) {
        for (let i = 1; i < group.fields.length; i++) {
          expect(group.fields[i].groupOrder).toBeGreaterThanOrEqual(
            group.fields[i - 1].groupOrder
          );
        }
      }
    });
  });

  describe('orphan field handling', () => {
    test('fields whose group is not in groups[] do not crash', () => {
      const raw: RawConnectorSchema = {
        name: 'Test',
        type: 'source',
        version: '1.0',
        metadata: { description: '' },
        groups: [{ name: 'Declared', order: 0, description: '' }],
        properties: [
          {
            name: 'inDeclared',
            type: 'string',
            display: {
              label: 'In Declared',
              description: '',
              group: 'Declared',
              groupOrder: 0,
            },
          },
          {
            name: 'orphan',
            type: 'string',
            display: {
              label: 'Orphan',
              description: '',
              group: 'UndeclaredGroup',
              groupOrder: 0,
            },
          },
        ],
      };
      const result = normalizeSchema(raw);
      expect(result.groups).toHaveLength(2);
      const orphanGroup = result.groups.find(
        (g) => g.name === 'UndeclaredGroup'
      );
      expect(orphanGroup).toBeDefined();
      expect(orphanGroup!.fields).toHaveLength(1);
      expect(orphanGroup!.fields[0].name).toBe('orphan');
      expect(orphanGroup!.order).toBe(999);
    });
  });

  describe('defaults', () => {
    test('required defaults to false when absent', () => {
      const raw: RawConnectorSchema = {
        name: 'Test',
        type: 'source',
        version: '1.0',
        metadata: { description: '' },
        groups: [{ name: 'G1', order: 0, description: '' }],
        properties: [
          {
            name: 'opt',
            type: 'string',
            display: {
              label: 'Optional',
              description: '',
              group: 'G1',
              groupOrder: 0,
            },
          },
        ],
      };
      const result = normalizeSchema(raw);
      expect(result.groups[0].fields[0].required).toBe(false);
    });

    test('width defaults to medium when absent', () => {
      const raw: RawConnectorSchema = {
        name: 'Test',
        type: 'source',
        version: '1.0',
        metadata: { description: '' },
        groups: [{ name: 'G1', order: 0, description: '' }],
        properties: [
          {
            name: 'f',
            type: 'string',
            display: {
              label: 'F',
              description: '',
              group: 'G1',
              groupOrder: 0,
            },
          },
        ],
      };
      const result = normalizeSchema(raw);
      expect(result.groups[0].fields[0].width).toBe('medium');
    });

    test('importance defaults to low when absent', () => {
      const raw: RawConnectorSchema = {
        name: 'Test',
        type: 'source',
        version: '1.0',
        metadata: { description: '' },
        groups: [{ name: 'G1', order: 0, description: '' }],
        properties: [
          {
            name: 'f',
            type: 'string',
            display: {
              label: 'F',
              description: '',
              group: 'G1',
              groupOrder: 0,
            },
          },
        ],
      };
      const result = normalizeSchema(raw);
      expect(result.groups[0].fields[0].importance).toBe('low');
    });
  });
});
