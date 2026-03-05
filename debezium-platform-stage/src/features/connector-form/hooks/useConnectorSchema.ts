import { useQuery } from 'react-query';
import { useSetAtom } from 'jotai';
import { useEffect, useMemo } from 'react';
import { rawConnectorSchemaAtom } from '../store/connectorAtoms';
import { fetchConnectorSchema } from '../api/fetchConnectorSchema';
import { normalizeSchema } from '../utils/normalizeSchema';
import type { NormalizedSchema } from '../types';

export function useConnectorSchema(connectorType: string): {
  normalizedSchema: NormalizedSchema | null;
  isLoading: boolean;
  error: unknown;
} {
  const setRawSchema = useSetAtom(rawConnectorSchemaAtom);

  const { data: rawSchema, isLoading, error } = useQuery(
    ['connector-schema', connectorType],
    () => fetchConnectorSchema(connectorType),
    {
      staleTime: Infinity,
      cacheTime: 1000 * 60 * 5,
      enabled: connectorType.length > 0,
    }
  );

  useEffect(() => {
    if (rawSchema) setRawSchema(rawSchema);
  }, [rawSchema, setRawSchema]);

  const normalizedSchema = useMemo(
    () => (rawSchema ? normalizeSchema(rawSchema) : null),
    [rawSchema]
  );

  return { normalizedSchema, isLoading, error };
}
