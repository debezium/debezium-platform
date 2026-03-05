import { describe, expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { useFieldVisibility } from './useFieldVisibility';
import { normalizeSchema } from '../utils/normalizeSchema';
import type { NormalizedSchema } from '../types';
import oracleFixture from '../../../__fixtures__/oracle.json';
import type { RawConnectorSchema } from '../types';

const oracleSchema = oracleFixture as RawConnectorSchema;
const normalizedSchema = normalizeSchema(oracleSchema);

/** Wrapper that provides form context. Child hook receives control via useFormContext. */
function createFormWrapper(defaultValues: Record<string, string> = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const methods = useForm({
      defaultValues: {
        'database.connection.adapter': '',
        'snapshot.mode': '',
        ...defaultValues,
      },
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
}

/** Hook that uses form context + useFieldVisibility. Must be used inside FormProvider. */
function useVisibilityInForm(schema: NormalizedSchema) {
  const { control } = useFormContext();
  return useFieldVisibility({ schema, control });
}

describe('useFieldVisibility', () => {
  const minimalSchema: NormalizedSchema = {
    connectorName: 'Test',
    groups: [
      {
        name: 'G1',
        order: 0,
        description: '',
        fields: [
          {
            name: 'always.visible',
            fieldType: 'text',
            label: 'Always',
            description: '',
            group: 'G1',
            groupOrder: 0,
            width: 'medium',
            importance: 'low',
            required: false,
          },
          {
            name: 'adapter.gated',
            fieldType: 'text',
            label: 'Gated',
            description: '',
            group: 'G1',
            groupOrder: 1,
            width: 'medium',
            importance: 'low',
            required: false,
          },
        ],
      },
    ],
    visibilityMap: {
      'adapter.gated': [
        {
          watchField: 'database.connection.adapter',
          whenValues: ['LogMiner', 'LogMiner_Unbuffered'],
        },
      ],
    },
    triggerFields: ['database.connection.adapter'],
  };

  test('always-visible fields: fields with no visibility rules always in set', () => {
    const Wrapper = createFormWrapper();
    const { result } = renderHook(() => useVisibilityInForm(minimalSchema), {
      wrapper: Wrapper,
    });
    expect(result.current.has('always.visible')).toBe(true);
  });

  test('hidden when no value: all adapter-gated fields hidden when adapter is empty', () => {
    const Wrapper = createFormWrapper();
    const { result } = renderHook(() => useVisibilityInForm(minimalSchema), {
      wrapper: Wrapper,
    });
    expect(result.current.has('adapter.gated')).toBe(false);
  });

  test('casing edge case: LogMiner in whenValues matches logminer form value', () => {
    const Wrapper = createFormWrapper({
      'database.connection.adapter': 'logminer',
    });
    const { result } = renderHook(() => useVisibilityInForm(minimalSchema), {
      wrapper: Wrapper,
    });
    expect(result.current.has('adapter.gated')).toBe(true);
  });

  test('adapter switching: switching adapter=xstream hides LogMiner fields, shows xstream fields', () => {
    const Wrapper = createFormWrapper({
      'database.connection.adapter': 'xstream',
    });
    const { result } = renderHook(() => useVisibilityInForm(normalizedSchema), {
      wrapper: Wrapper,
    });
    expect(result.current.has('xstream.out.server.name')).toBe(true);
    expect(result.current.has('log.mining.strategy')).toBe(false);
    expect(result.current.has('openlogreplicator.host')).toBe(false);
  });

  test('multi-rule OR logic: field visible under LogMiner AND LogMiner_Unbuffered', () => {
    const schemaWithMultiRule: NormalizedSchema = {
      ...minimalSchema,
      visibilityMap: {
        'adapter.gated': [
          {
            watchField: 'database.connection.adapter',
            whenValues: ['LogMiner'],
          },
          {
            watchField: 'database.connection.adapter',
            whenValues: ['LogMiner_Unbuffered'],
          },
        ],
      },
    };

    const WrapperLogMiner = createFormWrapper({
      'database.connection.adapter': 'logminer',
    });
    const { result: r1 } = renderHook(
      () => useVisibilityInForm(schemaWithMultiRule),
      { wrapper: WrapperLogMiner }
    );
    expect(r1.current.has('adapter.gated')).toBe(true);

    const WrapperUnbuffered = createFormWrapper({
      'database.connection.adapter': 'logminer_unbuffered',
    });
    const { result: r2 } = renderHook(
      () => useVisibilityInForm(schemaWithMultiRule),
      { wrapper: WrapperUnbuffered }
    );
    expect(r2.current.has('adapter.gated')).toBe(true);

    const WrapperXstream = createFormWrapper({
      'database.connection.adapter': 'xstream',
    });
    const { result: r3 } = renderHook(
      () => useVisibilityInForm(schemaWithMultiRule),
      { wrapper: WrapperXstream }
    );
    expect(r3.current.has('adapter.gated')).toBe(false);
  });

  test('Oracle fixture: adapter=logminer shows LogMiner dependants', () => {
    const Wrapper = createFormWrapper({
      'database.connection.adapter': 'logminer',
    });
    const { result } = renderHook(() => useVisibilityInForm(normalizedSchema), {
      wrapper: Wrapper,
    });
    expect(result.current.has('database.url')).toBe(true);
    expect(result.current.has('log.mining.strategy')).toBe(true);
    expect(result.current.has('xstream.out.server.name')).toBe(false);
  });

  test('Oracle fixture: adapter=olr shows openlogreplicator fields', () => {
    const Wrapper = createFormWrapper({
      'database.connection.adapter': 'olr',
    });
    const { result } = renderHook(() => useVisibilityInForm(normalizedSchema), {
      wrapper: Wrapper,
    });
    expect(result.current.has('openlogreplicator.host')).toBe(true);
    expect(result.current.has('openlogreplicator.port')).toBe(true);
    expect(result.current.has('openlogreplicator.source')).toBe(true);
    expect(result.current.has('log.mining.strategy')).toBe(false);
  });
});
