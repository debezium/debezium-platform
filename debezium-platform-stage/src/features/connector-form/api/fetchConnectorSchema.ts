import type { RawConnectorSchema } from '../types';

/**
 * Fetches connector schema from API.
 * POC: Uses Oracle fixture for all source connector types.
 * When backend is ready: fetch from `${API_URL}/api/connectors/${connectorType}/schema`
 * and return the schema for that specific connector type.
 */
export async function fetchConnectorSchema(
  connectorType: string
): Promise<RawConnectorSchema> {
  // POC: Use Oracle schema for all connector types
  const mod = await import('../../../__fixtures__/oracle.json');
  return mod.default as RawConnectorSchema;
}
