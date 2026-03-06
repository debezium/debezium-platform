/**
 * Connector Form Types — Shared across Schema Normalizer, Visibility Engine, Field Renderer
 *
 * Visibility path traces (Oracle.json):
 * - adapter=XStream → xstream.out.server.name visible
 * - adapter=OLR → openlogreplicator.host, openlogreplicator.port, openlogreplicator.source visible
 * - adapter=LogMiner | LogMiner_Unbuffered → log.mining.*, database.url, rac.nodes visible
 * - snapshot.mode=custom → snapshot.mode.custom.name (when API adds valueDependants)
 */

export interface RawConnectorSchema {
  name: string;
  type: string;
  version: string;
  metadata: { description: string };
  properties: RawProperty[];
  groups: RawGroup[];
}

export interface RawProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'list';
  required?: boolean;
  display: {
    label: string;
    description: string;
    group: string;
    groupOrder: number;
    width?: 'short' | 'medium' | 'long';
    importance?: 'high' | 'medium' | 'low';
  };
  validation?: Array<{
    type: 'enum';
    values: string[];
  }>;
  valueDependants?: Array<{
    values: string[];
    dependants: string[];
  }>;
}

export interface RawGroup {
  name: string;
  order: number;
  description: string;
}

export interface NormalizedField {
  name: string;
  fieldType: 'text' | 'number' | 'boolean' | 'select' | 'multiInput';
  label: string;
  description: string;
  group: string;
  groupOrder: number;
  width: 'short' | 'medium' | 'long';
  importance: 'high' | 'medium' | 'low';
  required: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface NormalizedGroup {
  name: string;
  order: number;
  description: string;
  fields: NormalizedField[];
}

export interface VisibilityRule {
  watchField: string;
  whenValues: string[];
}

export interface NormalizedSchema {
  connectorName: string;
  groups: NormalizedGroup[];
  visibilityMap: Record<string, VisibilityRule[]>;
  triggerFields: string[];
}
