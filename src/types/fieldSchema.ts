/**
 * TypeScript mirror of Rust FieldSchemaType / FieldSchema.
 *
 * Source of truth: src-tauri/src/field_discovery.rs
 * Serde output: #[serde(tag = "type", rename_all = "kebab-case")] +
 *               #[serde(rename_all = "camelCase")] on FieldSchema struct.
 *
 * Phase 17 ships these contracts; Phases 20–22 consume them.
 */

export type FieldSide = 'source' | 'target';

export type ArrayItemKind = 'option' | 'string' | 'user' | 'component' | 'version' | 'group';

/** All known Atlassian schema.type discriminants. Unknown values map to `'any'`. */
export type FieldSchemaType =
  | { type: 'string'; system?: string; custom?: string; customId?: number }
  | { type: 'number'; system?: string; custom?: string; customId?: number }
  | { type: 'date'; system?: string; custom?: string; customId?: number }
  | { type: 'datetime'; system?: string; custom?: string; customId?: number }
  | { type: 'user'; system?: string; custom?: string; customId?: number }
  | { type: 'array'; items: ArrayItemKind; system?: string; custom?: string; customId?: number }
  | { type: 'option'; system?: string; custom?: string; customId?: number }
  | { type: 'option-with-child'; system?: string; custom?: string; customId?: number }
  | { type: 'issuetype' }
  | { type: 'priority' }
  | { type: 'any' }; // catch-all for unrecognized schema.type — renderer shows "Unsupported"

const KNOWN_SCHEMA_TYPES: ReadonlyArray<FieldSchemaType['type']> = [
  'string',
  'number',
  'date',
  'datetime',
  'user',
  'array',
  'option',
  'option-with-child',
  'issuetype',
  'priority',
  'any',
];

const KNOWN_ARRAY_ITEMS: ReadonlyArray<ArrayItemKind> = [
  'option',
  'string',
  'user',
  'component',
  'version',
  'group',
];

export interface FieldSchema {
  fieldId: string;
  name: string;
  required: boolean;
  hasDefaultValue?: boolean;
  schema: FieldSchemaType;
  allowedValues?: unknown[];
  operations?: string[];
}

export interface IssueTypeRef {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
}

export interface CreatemetaResponse {
  startAt: number;
  maxResults: number;
  total: number;
  fields: FieldSchema[];
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isOptionField(
  s: FieldSchemaType,
): s is Extract<FieldSchemaType, { type: 'option' }> {
  return s.type === 'option';
}

export function isCascadingField(
  s: FieldSchemaType,
): s is Extract<FieldSchemaType, { type: 'option-with-child' }> {
  return s.type === 'option-with-child';
}

export function isArrayField(s: FieldSchemaType): s is Extract<FieldSchemaType, { type: 'array' }> {
  return s.type === 'array';
}

export function isUserField(s: FieldSchemaType): s is Extract<FieldSchemaType, { type: 'user' }> {
  return s.type === 'user';
}

export function isPriorityField(
  s: FieldSchemaType,
): s is Extract<FieldSchemaType, { type: 'priority' }> {
  return s.type === 'priority';
}

export function isCustomField(field: FieldSchema): boolean {
  return field.fieldId.startsWith('customfield_');
}

export function isUnsupportedField(field: FieldSchema): boolean {
  return field.schema.type === 'any';
}

// ─── Runtime parser ───────────────────────────────────────────────────────────

/**
 * Parse a raw JSON array (e.g. /rest/api/3/issue/createmeta/{key}/issuetypes/{id}
 * `fields` array) into typed FieldSchema[]. Unknown schema.type values are coerced
 * to `{type:'any'}` rather than thrown — mirrors the Rust `#[serde(other)] Any` behavior.
 */
export function parseFieldSchemas(input: unknown): FieldSchema[] {
  if (!Array.isArray(input)) return [];
  const out: FieldSchema[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const fieldId =
      typeof r.fieldId === 'string' ? r.fieldId : typeof r.id === 'string' ? r.id : null;
    const name = typeof r.name === 'string' ? r.name : null;
    if (!fieldId || !name) continue;
    const schema = parseSchemaType(r.schema);
    out.push({
      fieldId,
      name,
      required: r.required === true,
      hasDefaultValue: typeof r.hasDefaultValue === 'boolean' ? r.hasDefaultValue : undefined,
      schema,
      allowedValues: Array.isArray(r.allowedValues) ? r.allowedValues : undefined,
      operations: Array.isArray(r.operations)
        ? r.operations.filter((op): op is string => typeof op === 'string')
        : undefined,
    });
  }
  return out;
}

function parseSchemaType(raw: unknown): FieldSchemaType {
  if (!raw || typeof raw !== 'object') return { type: 'any' };
  const r = raw as Record<string, unknown>;
  const t = typeof r.type === 'string' ? r.type : 'any';
  if (!KNOWN_SCHEMA_TYPES.includes(t as FieldSchemaType['type'])) {
    return { type: 'any' };
  }
  const system = typeof r.system === 'string' ? r.system : undefined;
  const custom = typeof r.custom === 'string' ? r.custom : undefined;
  const customId = typeof r.customId === 'number' ? r.customId : undefined;
  switch (t) {
    case 'array': {
      const items =
        typeof r.items === 'string' && KNOWN_ARRAY_ITEMS.includes(r.items as ArrayItemKind)
          ? (r.items as ArrayItemKind)
          : 'string';
      return { type: 'array', items, system, custom, customId };
    }
    case 'issuetype':
      return { type: 'issuetype' };
    case 'priority':
      return { type: 'priority' };
    case 'any':
      return { type: 'any' };
    case 'string':
    case 'number':
    case 'date':
    case 'datetime':
    case 'user':
    case 'option':
    case 'option-with-child':
      return { type: t, system, custom, customId };
    default:
      return { type: 'any' };
  }
}
