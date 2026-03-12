import type { RawConnectorSchema } from '../types';

/**
 * Fetches connector schema from API.
 */
export async function fetchConnectorSchema(
  _connectorType: string
): Promise<RawConnectorSchema> {
  console.log('fetchConnectorSchema', _connectorType);
  // Use Oracle schema for all connector types
  const mod = await import('../../../__fixtures__/oracle.json');
  return mod.default as RawConnectorSchema;
}
