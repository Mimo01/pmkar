---
phase: 17-field-discovery-mock-schema-fidelity
plan: 03
plan_id: 17-03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/fieldSchema.ts
  - src/types/fieldSchema.test.ts
  - src/stores/schemaCacheStore.ts
  - src/stores/schemaCacheStore.test.ts
autonomous: true
requirements:
  - DISC-01
  - DISC-02
tags:
  - typescript
  - zustand
  - field-schema
  - frontend

must_haves:
  truths:
    - "src/types/fieldSchema.ts exports a discriminated union FieldSchemaType with string-literal discriminants on `type` covering all 11 variants present in the Rust enum (string, number, date, datetime, user, array, option, option-with-child, issuetype, priority, any)"
    - "FieldSchema interface mirrors the Rust struct with camelCase property names: fieldId, name, required, hasDefaultValue, schema, allowedValues, operations"
    - "FieldSide type alias is `'source' | 'target'` (matches Rust FieldSide enum lowercase serialization)"
    - "Type-narrowing helpers isOptionField, isArrayField, isCustomField, isUnsupportedField return correctly typed predicates"
    - "JSON parse round-trip from a Bug-createmeta response fixture produces typed FieldSchema[] without runtime errors"
    - "src/stores/schemaCacheStore.ts exports useSchemaCacheStore Zustand hook with: cache state keyed by (side, projectKey, issueTypeId), loadSchema(side, projectKey, issueTypeId) async action that calls invoke('get_target_field_schema_for_issuetype' | 'discover_source_fields'), refresh() action (Phase 21 wiring), preWarm(projectKey) action (calls 'pre_warm_target_issue_types')"
    - "Cache key format used by store: `${side}|${projectKey ?? '__null__'}|${issueTypeId ?? '__null__'}`"
    - "loadSchema sets loading→success on resolve and loading→error on reject (non-fatal; never throws)"
    - "All vitest unit tests pass: type narrowing, JSON parse against fixture, store action transitions"
  artifacts:
    - path: "src/types/fieldSchema.ts"
      provides: "FieldSchemaType, FieldSchema, FieldSide, IssueTypeRef, CreatemetaResponse types + narrowing helpers"
      contains: "FieldSchemaType"
    - path: "src/types/fieldSchema.test.ts"
      provides: "vitest unit tests covering narrowing helpers and JSON parse round-trips"
      contains: "isOptionField"
    - path: "src/stores/schemaCacheStore.ts"
      provides: "Zustand store with cache map, loadSchema/refresh/preWarm/clearCache actions"
      contains: "useSchemaCacheStore"
    - path: "src/stores/schemaCacheStore.test.ts"
      provides: "vitest store tests covering loadSchema success/error transitions"
      contains: "schemaCacheStore"
  key_links:
    - from: "src/types/fieldSchema.ts"
      to: "Rust FieldSchemaType serde tag values"
      via: "string literal discriminant on 'type' property"
      pattern: "type: '(string|number|date|datetime|user|array|option|option-with-child|issuetype|priority|any)'"
    - from: "src/stores/schemaCacheStore.ts"
      to: "Tauri command 'get_target_field_schema_for_issuetype'"
      via: "@tauri-apps/api/core invoke"
      pattern: "invoke<.+>\\('get_target_field_schema_for_issuetype'"
---

<objective>
Define the TypeScript type contract that mirrors the Rust FieldSchema/FieldSchemaType + a Zustand store skeleton for the per-(side, projectKey, issueTypeId) schema cache. Phase 17 Plan 05 wires `loadSchema`/`preWarm` to actual Tauri commands; Phases 20–22 consume these types directly when rendering the mapping editor and copy preview.

Purpose: Front-end can build against a single source of truth that exactly matches the Rust serde output. Eliminates the "shape drift" risk between Rust JSON and TS consumer expectations.

Output: 4 files (2 type/store + 2 vitest test files). All tests pass against the existing vitest config.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-CONTEXT.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-PATTERNS.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-VALIDATION.md

<interfaces>
<!-- Existing connectionStore.ts pattern (src/features/connections/connectionStore.ts) -->
```typescript
import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  // initial state
  // actions
  loadProjectConfig: async () => {
    try {
      const config = await invoke<...>('get_project_config');
      set({ ... });
    } catch {
      // Non-fatal pattern
    }
  },
}));
```

<!-- Rust serde output shape (must match exactly) — from Plan 02 -->
<!-- FieldSchemaType serializes with #[serde(tag = "type", rename_all = "kebab-case")] -->
<!-- FieldSchema serializes with #[serde(rename_all = "camelCase")] -->

<!-- Tauri commands provided by Plan 04 (call these by name from the store) -->
<!--   - 'discover_source_fields'                       → returns FieldSchema[] -->
<!--   - 'get_target_field_schema_for_issuetype'        → args { projectKey, issuetypeId } returns FieldSchema[] -->
<!--   - 'pre_warm_target_issue_types'                  → args { projectKey } returns IssueTypeRef[] -->
<!--   - 'refresh_field_schema_cache'                   → args { side, projectKey, issuetypeId } returns void -->
<!-- Plan 03 ships type contracts that match these signatures; Plan 04 implements them; Plan 05 wires the store -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wave 0 — write failing vitest tests for fieldSchema types and schemaCacheStore</name>
  <files>src/types/fieldSchema.test.ts, src/stores/schemaCacheStore.test.ts</files>
  <read_first>
    - vitest.config.ts (existing config, tsconfig path aliases)
    - src/features/connections/__tests__/SetupWizard.test.tsx (existing vitest+RTL test patterns — only mocking patterns; do not require RTL for these tests)
    - src/features/connections/connectionStore.ts (Zustand store pattern to mirror)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Pattern 4: TypeScript discriminated union mirroring" lines 447-481
    - package.json (vitest + @tauri-apps/api versions)
  </read_first>
  <behavior>
    - fieldSchema.test.ts: parse a JSON fixture mimicking Bug createmeta page-1 response (5 fields: summary string, priority priority, customfield_10006 option, assignee user, customfield_10001 number). Assert each parsed entry's `schema.type` literal narrows correctly via isOptionField/isArrayField/isCustomField helpers
    - fieldSchema.test.ts: assert that an unknown discriminant `{type:"watches"}` parses into the FieldSchemaType union (assignment compiles + at runtime is treated as `any`-variant — narrowing helper isUnsupportedField returns true)
    - fieldSchema.test.ts: assert `isCustomField({fieldId:'customfield_10001', ...})` returns true and `isCustomField({fieldId:'summary', ...})` returns false
    - fieldSchema.test.ts: assert `isOptionField({type:'option',...})` true and `isOptionField({type:'option-with-child',...})` false (cascading is handled by a separate helper isCascadingField)
    - fieldSchema.test.ts: assert `isArrayField` returns true only for `{type:'array', items:...}` and that the narrowed type carries the `items` property
    - schemaCacheStore.test.ts: mock `@tauri-apps/api/core` invoke; call `useSchemaCacheStore.getState().loadSchema('target', 'MYPROJ', '10001')`; assert state transitions loading→success and the mocked Tauri command name was 'get_target_field_schema_for_issuetype'
    - schemaCacheStore.test.ts: when invoke rejects, store sets the per-key entry to error state (no throw); subsequent `loadSchema` retries work
    - schemaCacheStore.test.ts: source-side `loadSchema('source', null, null)` invokes 'discover_source_fields'
    - schemaCacheStore.test.ts: cache key building handles null projectKey/issueTypeId without collision with literal "null" strings
  </behavior>
  <action>
**Step 1 — Create `src/types/fieldSchema.test.ts`:**

```typescript
import { describe, it, expect } from 'vitest';
import {
  type FieldSchema,
  type FieldSchemaType,
  isArrayField,
  isCascadingField,
  isCustomField,
  isOptionField,
  isUnsupportedField,
  parseFieldSchemas,
} from './fieldSchema';

const BUG_PAGE_1: unknown = [
  { fieldId: 'summary', key: 'summary', name: 'Summary', required: true, schema: { type: 'string', system: 'summary' } },
  { fieldId: 'priority', key: 'priority', name: 'Priority', required: true, schema: { type: 'priority', system: 'priority' } },
  { fieldId: 'customfield_10006', key: 'customfield_10006', name: 'Severity', required: true, schema: { type: 'option', custom: '...:select', customId: 10006 } },
  { fieldId: 'assignee', key: 'assignee', name: 'Assignee', required: false, schema: { type: 'user', system: 'assignee' } },
  { fieldId: 'customfield_10001', key: 'customfield_10001', name: 'Story Points', required: false, schema: { type: 'number', custom: '...:float', customId: 10001 } },
];

const CASCADING_FIELD: unknown = {
  fieldId: 'customfield_10005', name: 'Department/Team', required: false,
  schema: { type: 'option-with-child', custom: '...:cascadingselect', customId: 10005 },
};

const ARRAY_OPTION_FIELD: unknown = {
  fieldId: 'customfield_10004', name: 'Team', required: false,
  schema: { type: 'array', items: 'option', custom: '...:multiselect', customId: 10004 },
};

const UNKNOWN_FIELD: unknown = {
  fieldId: 'watcher_field', name: 'Watcher', required: false,
  schema: { type: 'watches' },
};

describe('parseFieldSchemas', () => {
  it('parses a Bug page-1 createmeta response into typed FieldSchema[]', () => {
    const parsed = parseFieldSchemas(BUG_PAGE_1);
    expect(parsed).toHaveLength(5);
    expect(parsed[0].fieldId).toBe('summary');
    expect(parsed[0].schema.type).toBe('string');
  });

  it('handles unknown schema.type by treating it as any-variant (no throw)', () => {
    const parsed = parseFieldSchemas([UNKNOWN_FIELD]);
    expect(parsed).toHaveLength(1);
    expect(isUnsupportedField(parsed[0])).toBe(true);
  });
});

describe('isCustomField', () => {
  it('returns true for customfield_* ids', () => {
    const f = parseFieldSchemas([BUG_PAGE_1[2]])[0];
    expect(isCustomField(f)).toBe(true);
  });
  it('returns false for system fields', () => {
    const f = parseFieldSchemas([BUG_PAGE_1[0]])[0];
    expect(isCustomField(f)).toBe(false);
  });
});

describe('isOptionField', () => {
  it('returns true for plain option', () => {
    const f = parseFieldSchemas([BUG_PAGE_1[2]])[0];
    expect(isOptionField(f.schema)).toBe(true);
  });
  it('returns false for option-with-child (cascading)', () => {
    const f = parseFieldSchemas([CASCADING_FIELD])[0];
    expect(isOptionField(f.schema)).toBe(false);
  });
});

describe('isCascadingField', () => {
  it('returns true for option-with-child', () => {
    const f = parseFieldSchemas([CASCADING_FIELD])[0];
    expect(isCascadingField(f.schema)).toBe(true);
  });
});

describe('isArrayField', () => {
  it('returns true and narrows to provide items property', () => {
    const f = parseFieldSchemas([ARRAY_OPTION_FIELD])[0];
    if (isArrayField(f.schema)) {
      expect(f.schema.items).toBe('option');
    } else {
      throw new Error('expected array variant');
    }
  });
});

describe('isUnsupportedField', () => {
  it('returns true when schema.type is not a known discriminant', () => {
    const f = parseFieldSchemas([UNKNOWN_FIELD])[0];
    expect(isUnsupportedField(f)).toBe(true);
  });
  it('returns false for known types', () => {
    const f = parseFieldSchemas([BUG_PAGE_1[0]])[0];
    expect(isUnsupportedField(f)).toBe(false);
  });
});
```

**Step 2 — Create `src/stores/schemaCacheStore.test.ts`:**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @tauri-apps/api/core BEFORE importing the store
const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useSchemaCacheStore, schemaCacheKey } from './schemaCacheStore';

describe('schemaCacheStore', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    // Reset Zustand store to initial state
    useSchemaCacheStore.setState({ cache: {}, prewarmedIssueTypes: {} });
  });

  it('loadSchema(target, MYPROJ, 10001) calls get_target_field_schema_for_issuetype', async () => {
    invokeMock.mockResolvedValueOnce([
      { fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } },
    ]);
    await useSchemaCacheStore.getState().loadSchema('target', 'MYPROJ', '10001');
    expect(invokeMock).toHaveBeenCalledWith('get_target_field_schema_for_issuetype', {
      projectKey: 'MYPROJ',
      issuetypeId: '10001',
    });
    const key = schemaCacheKey('target', 'MYPROJ', '10001');
    const entry = useSchemaCacheStore.getState().cache[key];
    expect(entry?.status).toBe('success');
    expect(entry?.fields).toHaveLength(1);
  });

  it('loadSchema(source, null, null) calls discover_source_fields', async () => {
    invokeMock.mockResolvedValueOnce([
      { fieldId: 'description', name: 'Description', required: false, schema: { type: 'string' } },
    ]);
    await useSchemaCacheStore.getState().loadSchema('source', null, null);
    expect(invokeMock).toHaveBeenCalledWith('discover_source_fields', {});
  });

  it('records error state without throwing when invoke rejects', async () => {
    invokeMock.mockRejectedValueOnce(new Error('HTTP 500'));
    await useSchemaCacheStore.getState().loadSchema('target', 'MYPROJ', '10001');
    const key = schemaCacheKey('target', 'MYPROJ', '10001');
    const entry = useSchemaCacheStore.getState().cache[key];
    expect(entry?.status).toBe('error');
    expect(entry?.error).toContain('HTTP 500');
  });

  it('schemaCacheKey distinguishes null projectKey from literal "null" string', () => {
    expect(schemaCacheKey('target', null, '10001')).not.toBe(
      schemaCacheKey('target', 'null', '10001'),
    );
  });

  it('preWarm calls pre_warm_target_issue_types and stores result', async () => {
    invokeMock.mockResolvedValueOnce([
      { id: '10001', name: 'Bug' },
      { id: '10002', name: 'Task' },
    ]);
    await useSchemaCacheStore.getState().preWarm('MYPROJ');
    expect(invokeMock).toHaveBeenCalledWith('pre_warm_target_issue_types', { projectKey: 'MYPROJ' });
    expect(useSchemaCacheStore.getState().prewarmedIssueTypes['MYPROJ']).toHaveLength(2);
  });

  it('refresh clears the cache entry then calls refresh_field_schema_cache', async () => {
    // Seed an existing entry
    const key = schemaCacheKey('target', 'MYPROJ', '10001');
    useSchemaCacheStore.setState({
      cache: { [key]: { status: 'success', fields: [] } },
      prewarmedIssueTypes: {},
    });
    invokeMock.mockResolvedValueOnce(undefined);
    await useSchemaCacheStore.getState().refresh('target', 'MYPROJ', '10001');
    expect(invokeMock).toHaveBeenCalledWith('refresh_field_schema_cache', {
      side: 'target',
      projectKey: 'MYPROJ',
      issuetypeId: '10001',
    });
    expect(useSchemaCacheStore.getState().cache[key]).toBeUndefined();
  });
});
```

**Step 3 — Run tests; they MUST FAIL (no source files exist yet):**

```bash
npx vitest run src/types/fieldSchema.test.ts src/stores/schemaCacheStore.test.ts
```

Expected output: errors like "Failed to resolve import './fieldSchema'" or similar — confirming Wave 0 RED state.
  </action>
  <verify>
    <automated>npx vitest run --no-coverage src/types/fieldSchema.test.ts src/stores/schemaCacheStore.test.ts 2>&1 | tail -20 || true</automated>
  </verify>
  <acceptance_criteria>
    - File `src/types/fieldSchema.test.ts` exists
    - File `src/stores/schemaCacheStore.test.ts` exists
    - `grep -c "describe('parseFieldSchemas'" src/types/fieldSchema.test.ts` returns 1
    - `grep -c "describe('isCascadingField'" src/types/fieldSchema.test.ts` returns 1
    - `grep -c "describe('isArrayField'" src/types/fieldSchema.test.ts` returns 1
    - `grep -c "describe('schemaCacheStore'" src/stores/schemaCacheStore.test.ts` returns 1
    - `grep -c "get_target_field_schema_for_issuetype" src/stores/schemaCacheStore.test.ts` returns at least 1
    - `grep -c "pre_warm_target_issue_types" src/stores/schemaCacheStore.test.ts` returns at least 1
    - `grep -c "discover_source_fields" src/stores/schemaCacheStore.test.ts` returns at least 1
    - Running vitest on these files shows test failures or import errors (RED state — Tasks 2 + 3 will turn them green)
  </acceptance_criteria>
  <done>Both test files committed, contain the test bodies above, and currently fail because the type/store source files do not yet exist.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create src/types/fieldSchema.ts with discriminated union, narrowing helpers, and parser</name>
  <files>src/types/fieldSchema.ts</files>
  <read_first>
    - src/types/fieldSchema.test.ts (after Task 1 — defines required exports)
    - src/features/connections/types.ts (existing TS type-file convention — exported interfaces, no runtime code beyond type guards)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Pattern 4: TypeScript discriminated union mirroring" lines 447-481
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-PATTERNS.md §"src/features/mapping/fields/types.ts" (note: planner final placement is `src/types/fieldSchema.ts` per VALIDATION.md, supersedes PATTERNS.md path)
  </read_first>
  <behavior>
    - File exports types: FieldSide, FieldSchemaType (discriminated union), FieldSchema, IssueTypeRef, CreatemetaResponse
    - File exports type guards: isOptionField (only plain `option`), isCascadingField (`option-with-child`), isArrayField, isCustomField, isUnsupportedField, isUserField, isPriorityField
    - File exports `parseFieldSchemas(unknown[]): FieldSchema[]` that maps each entry through a per-row parser, mapping unknown `schema.type` strings to `{type:'any'}`
    - All Wave 0 fieldSchema tests pass
  </behavior>
  <action>
**Step 1 — Create directory + file `src/types/fieldSchema.ts`:**

```typescript
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

export type ArrayItemKind =
  | 'option'
  | 'string'
  | 'user'
  | 'component'
  | 'version'
  | 'group';

/** All known Atlassian schema.type discriminants. Unknown values map to `'any'`. */
export type FieldSchemaType =
  | { type: 'string';            system?: string; custom?: string; customId?: number }
  | { type: 'number';            system?: string; custom?: string; customId?: number }
  | { type: 'date';              system?: string; custom?: string; customId?: number }
  | { type: 'datetime';          system?: string; custom?: string; customId?: number }
  | { type: 'user';              system?: string; custom?: string; customId?: number }
  | { type: 'array';             items: ArrayItemKind; system?: string; custom?: string; customId?: number }
  | { type: 'option';            system?: string; custom?: string; customId?: number }
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

export function isOptionField(s: FieldSchemaType): s is Extract<FieldSchemaType, { type: 'option' }> {
  return s.type === 'option';
}

export function isCascadingField(
  s: FieldSchemaType,
): s is Extract<FieldSchemaType, { type: 'option-with-child' }> {
  return s.type === 'option-with-child';
}

export function isArrayField(
  s: FieldSchemaType,
): s is Extract<FieldSchemaType, { type: 'array' }> {
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
    const fieldId = typeof r.fieldId === 'string' ? r.fieldId : (typeof r.id === 'string' ? r.id : null);
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
      operations: Array.isArray(r.operations) ? r.operations.filter((op): op is string => typeof op === 'string') : undefined,
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
      const items = typeof r.items === 'string' && KNOWN_ARRAY_ITEMS.includes(r.items as ArrayItemKind)
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
```

**Step 2 — Run tests:**

```bash
npx vitest run --no-coverage src/types/fieldSchema.test.ts
```

All fieldSchema.test.ts tests must pass.
  </action>
  <verify>
    <automated>npx vitest run --no-coverage src/types/fieldSchema.test.ts 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - File `src/types/fieldSchema.ts` exists
    - `grep -c "export type FieldSide" src/types/fieldSchema.ts` returns 1
    - `grep -c "export type FieldSchemaType" src/types/fieldSchema.ts` returns 1
    - `grep -c "type: 'option-with-child'" src/types/fieldSchema.ts` returns at least 1
    - `grep -c "type: 'priority'" src/types/fieldSchema.ts` returns at least 1
    - `grep -c "type: 'any'" src/types/fieldSchema.ts` returns at least 2
    - `grep -c "export function isOptionField" src/types/fieldSchema.ts` returns 1
    - `grep -c "export function isCascadingField" src/types/fieldSchema.ts` returns 1
    - `grep -c "export function isArrayField" src/types/fieldSchema.ts` returns 1
    - `grep -c "export function isCustomField" src/types/fieldSchema.ts` returns 1
    - `grep -c "export function isUnsupportedField" src/types/fieldSchema.ts` returns 1
    - `grep -c "export function parseFieldSchemas" src/types/fieldSchema.ts` returns 1
    - `npx vitest run --no-coverage src/types/fieldSchema.test.ts` exits 0 (all tests green)
    - `npx tsc --noEmit` exits 0 (no type errors anywhere in the project)
  </acceptance_criteria>
  <done>fieldSchema.ts exports the discriminated union, narrowing helpers, and parser; all Wave 0 tests pass; project type-checks clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create src/stores/schemaCacheStore.ts (Zustand) with cache map, loadSchema/preWarm/refresh/clearCache actions</name>
  <files>src/stores/schemaCacheStore.ts</files>
  <read_first>
    - src/stores/schemaCacheStore.test.ts (after Task 1 — defines required exports + behavior)
    - src/features/connections/connectionStore.ts (Zustand+invoke pattern — non-fatal try/catch)
    - src/types/fieldSchema.ts (after Task 2 — types to import)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Pattern 5: Connection-time probe + pre-warm wiring" (for Tauri command names)
  </read_first>
  <behavior>
    - Exports `useSchemaCacheStore` Zustand hook
    - Exports `schemaCacheKey(side, projectKey, issuetypeId)` helper that returns a unique string distinguishable from any user-supplied "null" string (uses delimiter `|` and sentinel `__null__`)
    - State shape: `{ cache: Record<string, CacheEntry>, prewarmedIssueTypes: Record<string, IssueTypeRef[]> }`
    - CacheEntry = `{ status: 'loading' | 'success' | 'error', fields?: FieldSchema[], error?: string }`
    - Actions:
      - `loadSchema(side, projectKey, issuetypeId)`: sets entry to loading; calls 'discover_source_fields' (no args) for source side or 'get_target_field_schema_for_issuetype' (with `{projectKey, issuetypeId}`) for target side; on resolve sets status:'success' with fields; on reject sets status:'error' with error message — never throws
      - `preWarm(projectKey)`: calls 'pre_warm_target_issue_types' with `{projectKey}`; on resolve stores IssueTypeRef[] in prewarmedIssueTypes[projectKey]; on reject stores empty array (silent fail per Open Question 3)
      - `refresh(side, projectKey, issuetypeId)`: deletes cache entry then calls 'refresh_field_schema_cache' with `{side, projectKey, issuetypeId}`; on success the next loadSchema will fetch fresh
      - `clearCache()`: resets state to initial
    - All Wave 0 schemaCacheStore tests pass
  </behavior>
  <action>
**Step 1 — Create directory + file `src/stores/schemaCacheStore.ts`:**

```typescript
import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import type { FieldSchema, FieldSide, IssueTypeRef } from '@/types/fieldSchema';

export type CacheEntryStatus = 'loading' | 'success' | 'error';

export interface SchemaCacheEntry {
  status: CacheEntryStatus;
  fields?: FieldSchema[];
  error?: string;
}

interface SchemaCacheState {
  cache: Record<string, SchemaCacheEntry>;
  prewarmedIssueTypes: Record<string, IssueTypeRef[]>;
  loadSchema: (side: FieldSide, projectKey: string | null, issuetypeId: string | null) => Promise<void>;
  preWarm: (projectKey: string) => Promise<void>;
  refresh: (side: FieldSide, projectKey: string | null, issuetypeId: string | null) => Promise<void>;
  clearCache: () => void;
}

const NULL_SENTINEL = '__null__';

export function schemaCacheKey(
  side: FieldSide,
  projectKey: string | null,
  issuetypeId: string | null,
): string {
  return `${side}|${projectKey ?? NULL_SENTINEL}|${issuetypeId ?? NULL_SENTINEL}`;
}

export const useSchemaCacheStore = create<SchemaCacheState>((set, get) => ({
  cache: {},
  prewarmedIssueTypes: {},

  loadSchema: async (side, projectKey, issuetypeId) => {
    const key = schemaCacheKey(side, projectKey, issuetypeId);
    set({ cache: { ...get().cache, [key]: { status: 'loading' } } });
    try {
      const fields = await (side === 'source'
        ? invoke<FieldSchema[]>('discover_source_fields', {})
        : invoke<FieldSchema[]>('get_target_field_schema_for_issuetype', {
            projectKey,
            issuetypeId,
          }));
      set({
        cache: {
          ...get().cache,
          [key]: { status: 'success', fields: Array.isArray(fields) ? fields : [] },
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
      set({
        cache: { ...get().cache, [key]: { status: 'error', error: msg } },
      });
    }
  },

  preWarm: async (projectKey) => {
    try {
      const list = await invoke<IssueTypeRef[]>('pre_warm_target_issue_types', { projectKey });
      set({
        prewarmedIssueTypes: {
          ...get().prewarmedIssueTypes,
          [projectKey]: Array.isArray(list) ? list : [],
        },
      });
    } catch {
      // Silent fail per Open Question 3 — probe already verified endpoint reachable.
      set({
        prewarmedIssueTypes: { ...get().prewarmedIssueTypes, [projectKey]: [] },
      });
    }
  },

  refresh: async (side, projectKey, issuetypeId) => {
    const key = schemaCacheKey(side, projectKey, issuetypeId);
    const next = { ...get().cache };
    delete next[key];
    set({ cache: next });
    try {
      await invoke('refresh_field_schema_cache', { side, projectKey, issuetypeId });
    } catch {
      // Non-fatal: caller can re-trigger loadSchema regardless.
    }
  },

  clearCache: () => set({ cache: {}, prewarmedIssueTypes: {} }),
}));
```

**Step 2 — Run tests:**

```bash
npx vitest run --no-coverage src/stores/schemaCacheStore.test.ts
```

All schemaCacheStore.test.ts tests must pass.

**Step 3 — Run type-check:**

```bash
npx tsc --noEmit
```

Must exit 0 — verifies the `@/types/fieldSchema` import alias resolves and that the store types align with FieldSchema.
  </action>
  <verify>
    <automated>npx vitest run --no-coverage src/stores/schemaCacheStore.test.ts src/types/fieldSchema.test.ts 2>&1 | tail -10 && npx tsc --noEmit 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - File `src/stores/schemaCacheStore.ts` exists
    - `grep -c "export const useSchemaCacheStore" src/stores/schemaCacheStore.ts` returns 1
    - `grep -c "export function schemaCacheKey" src/stores/schemaCacheStore.ts` returns 1
    - `grep -c "'discover_source_fields'" src/stores/schemaCacheStore.ts` returns at least 1
    - `grep -c "'get_target_field_schema_for_issuetype'" src/stores/schemaCacheStore.ts` returns at least 1
    - `grep -c "'pre_warm_target_issue_types'" src/stores/schemaCacheStore.ts` returns at least 1
    - `grep -c "'refresh_field_schema_cache'" src/stores/schemaCacheStore.ts` returns at least 1
    - `grep -c "@tauri-apps/api/core" src/stores/schemaCacheStore.ts` returns 1
    - `grep -c "from 'zustand'" src/stores/schemaCacheStore.ts` returns 1
    - `npx vitest run --no-coverage src/stores/schemaCacheStore.test.ts` exits 0
    - `npx vitest run --no-coverage src/types/fieldSchema.test.ts src/stores/schemaCacheStore.test.ts` exits 0
    - `npx tsc --noEmit` exits 0
    - `npx eslint src/types/fieldSchema.ts src/stores/schemaCacheStore.ts` exits 0
  </acceptance_criteria>
  <done>schemaCacheStore.ts exports the Zustand hook + cache-key helper; all Wave 0 tests green; project type-checks clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Tauri invoke response → Zustand state | Untrusted JSON from backend; assigned without runtime re-validation (Rust types already validate) |
| Zustand state → React renderers (Phases 20–22) | TS-typed; no `any` leakage from this plan |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-10 | Tampering | `parseFieldSchemas` runtime parser | mitigate | Per-field defensive checks: rejects rows missing `fieldId` or `name`; coerces unknown `schema.type` to `'any'`; coerces unknown `array.items` to `'string'`; never executes nor evals incoming strings |
| T-17-11 | Information Disclosure | Error messages stored in cache entry | mitigate | Error stringification uses `e.message` only; no headers, no request body, no credentials (the Rust side per T-17-03 already redacts before returning) |
| T-17-12 | Denial of Service | Unbounded `cache` and `prewarmedIssueTypes` records | accept | Practical bounds: at most ~10 issue types × 2 sides × 1 active project; total memory negligible. clearCache() available for manual reset. |
| T-17-13 | Repudiation | preWarm silent failure | accept | Decision per RESEARCH.md Open Question 3 — probe already validated endpoint; transient pre-warm failure is non-blocking. Audit middleware on the Rust side still records the HTTP attempt. |
</threat_model>

<verification>
- `npx vitest run --no-coverage src/types/fieldSchema.test.ts src/stores/schemaCacheStore.test.ts` passes (≥11 tests total)
- `npx tsc --noEmit` exits 0
- `npx eslint src/types/fieldSchema.ts src/stores/schemaCacheStore.ts` exits 0
- Existing `npx vitest run --no-coverage` full suite passes (no regressions)
- Tauri command names called by the store match exactly the names that Plan 04 will register: `discover_source_fields`, `get_target_field_schema_for_issuetype`, `pre_warm_target_issue_types`, `refresh_field_schema_cache`
</verification>

<success_criteria>
- TypeScript discriminated union mirrors Rust enum 1:1 (DISC-01, DISC-02 type contract on the front-end)
- Cache key shape encodes (side, projectKey, issuetypeId) per D-13
- Store actions name-match the Tauri commands Plan 04 will create — no later renaming required
- All vitest tests green; project type-checks and lints clean
</success_criteria>

<output>
After completion, create `.planning/phases/17-field-discovery-mock-schema-fidelity/17-03-SUMMARY.md`
</output>
