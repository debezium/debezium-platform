import { atom } from 'jotai';
import type { RawConnectorSchema } from '../types';

/** Raw API response — set once when data arrives */
export const rawConnectorSchemaAtom = atom<RawConnectorSchema | null>(null);

/** Saved connector config after successful submit — for reset/edit mode */
export const savedConnectorConfigAtom = atom<Record<string, unknown>>({});
