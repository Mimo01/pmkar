/**
 * Tests for renderSourceFieldValue and isNoiseValue (Task 1 — 260429-ev2).
 *
 * All 19 behaviour tests from the plan are covered here.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FieldSchemaType } from '@/types/fieldSchema';
import { isNoiseValue, renderSourceFieldValue } from '../sourceValueDisplay';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderNode(schema: FieldSchemaType, value: unknown, opts?: { fieldId?: string }) {
  const node = renderSourceFieldValue(schema, value, opts);
  if (node === null) return null;
  const { container } = render(<div>{node}</div>);
  return container;
}

// ---------------------------------------------------------------------------
// Test 1: string + non-empty value
// ---------------------------------------------------------------------------

describe('renderSourceFieldValue', () => {
  it('Test 1 — string: renders text content in a span', () => {
    const container = renderNode({ type: 'string' }, 'hello')!;
    expect(container.textContent).toContain('hello');
  });

  // -------------------------------------------------------------------------
  // Test 2: string + null returns null
  // -------------------------------------------------------------------------

  it('Test 2 — string: returns null for null value', () => {
    expect(renderSourceFieldValue({ type: 'string' }, null)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 3: datetime format
  // -------------------------------------------------------------------------

  it('Test 3 — datetime: returns formatted date+time for ISO string', () => {
    const node = renderSourceFieldValue({ type: 'datetime' }, '2026-04-29T10:00:00Z');
    expect(node).not.toBeNull();
    const { container } = render(<div>{node}</div>);
    // Should contain a year digit, confirming formatDate ran
    expect(container.textContent).toMatch(/2026/);
  });

  // -------------------------------------------------------------------------
  // Test 4: date format
  // -------------------------------------------------------------------------

  it('Test 4 — date: returns formatted date for date string', () => {
    const node = renderSourceFieldValue({ type: 'date' }, '2026-04-29');
    expect(node).not.toBeNull();
    const { container } = render(<div>{node}</div>);
    expect(container.textContent).toMatch(/2026/);
  });

  // -------------------------------------------------------------------------
  // Test 5: number — 42 renders "42"; 0 renders "0" (not null)
  // -------------------------------------------------------------------------

  it('Test 5a — number: renders "42"', () => {
    const container = renderNode({ type: 'number' }, 42)!;
    expect(container.textContent).toContain('42');
  });

  it('Test 5b — number: renders "0" (zero is not empty)', () => {
    const container = renderNode({ type: 'number' }, 0)!;
    expect(container.textContent).toContain('0');
  });

  // -------------------------------------------------------------------------
  // Test 6: user — renders UserAvatar + displayName
  // -------------------------------------------------------------------------

  it('Test 6 — user: renders displayName "Alice"', () => {
    const container = renderNode(
      { type: 'user' },
      {
        displayName: 'Alice',
        emailAddress: 'a@x',
      },
    )!;
    expect(container.textContent).toContain('Alice');
  });

  // -------------------------------------------------------------------------
  // Test 7: priority — renders PriorityIcon (span with priority text)
  // -------------------------------------------------------------------------

  it('Test 7 — priority: renders priority label "High"', () => {
    const container = renderNode({ type: 'priority' }, { name: 'High' })!;
    expect(container.textContent).toContain('High');
  });

  // -------------------------------------------------------------------------
  // Test 8: option — extract value.value / value.name / plain string
  // -------------------------------------------------------------------------

  it('Test 8a — option: renders value.value', () => {
    const container = renderNode({ type: 'option' }, { value: 'Foo' })!;
    expect(container.textContent).toContain('Foo');
  });

  it('Test 8b — option: renders value.name when no value property', () => {
    const container = renderNode({ type: 'option' }, { name: 'Bar' })!;
    expect(container.textContent).toContain('Bar');
  });

  it('Test 8c — option: renders plain string "Baz"', () => {
    const container = renderNode({ type: 'option' }, 'Baz')!;
    expect(container.textContent).toContain('Baz');
  });

  // -------------------------------------------------------------------------
  // Test 9: array of strings
  // -------------------------------------------------------------------------

  it('Test 9 — array/string: joins with ", "', () => {
    const container = renderNode({ type: 'array', items: 'string' }, ['a', 'b', 'c'])!;
    expect(container.textContent).toContain('a, b, c');
  });

  // -------------------------------------------------------------------------
  // Test 10: array of users
  // -------------------------------------------------------------------------

  it('Test 10 — array/user: renders displayNames for each user', () => {
    const container = renderNode({ type: 'array', items: 'user' }, [
      { displayName: 'Alice' },
      { displayName: 'Bob' },
    ])!;
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Bob');
  });

  // -------------------------------------------------------------------------
  // Test 11: array of options
  // -------------------------------------------------------------------------

  it('Test 11 — array/option: comma-joins value property', () => {
    const container = renderNode({ type: 'array', items: 'option' }, [
      { value: 'X' },
      { value: 'Y' },
    ])!;
    expect(container.textContent).toContain('X, Y');
  });

  // -------------------------------------------------------------------------
  // Test 12: array of components
  // -------------------------------------------------------------------------

  it('Test 12 — array/component: comma-joins name property', () => {
    const container = renderNode({ type: 'array', items: 'component' }, [
      { name: 'API' },
      { name: 'DB' },
    ])!;
    expect(container.textContent).toContain('API, DB');
  });

  // -------------------------------------------------------------------------
  // Test 13: array of versions
  // -------------------------------------------------------------------------

  it('Test 13 — array/version: comma-joins name property', () => {
    const container = renderNode({ type: 'array', items: 'version' }, [{ name: 'v1.0' }])!;
    expect(container.textContent).toContain('v1.0');
  });

  // -------------------------------------------------------------------------
  // Test 14: empty array returns null
  // -------------------------------------------------------------------------

  it('Test 14 — array/string: empty array returns null', () => {
    expect(renderSourceFieldValue({ type: 'array', items: 'string' }, [])).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 15: any — renders truncated JSON with "raw" tag
  // -------------------------------------------------------------------------

  it('Test 15 — any: renders <code> block with JSON and "raw" tag', () => {
    const container = renderNode({ type: 'any' }, { nested: { deep: 1 } })!;
    // Should contain code element
    const codeEl = container.querySelector('code');
    expect(codeEl).not.toBeNull();
    // Should have "raw" text somewhere
    expect(container.textContent?.toLowerCase()).toContain('raw');
  });

  it('Test 15b — any: truncates JSON at 200 chars with ellipsis', () => {
    const longObj: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      longObj[`key${i}`] = `value${i}longer`;
    }
    const container = renderNode({ type: 'any' }, longObj)!;
    const codeEl = container.querySelector('code')!;
    // The code content should not exceed 203 chars (200 + "...")
    expect(codeEl.textContent!.length).toBeLessThanOrEqual(203);
    // Should end with "..."
    expect(codeEl.textContent).toMatch(/\.\.\.$/);
  });

  // -------------------------------------------------------------------------
  // Test 16: option-with-child
  // -------------------------------------------------------------------------

  it('Test 16 — option-with-child: renders "Parent / Child"', () => {
    const container = renderNode(
      { type: 'option-with-child' },
      {
        value: 'Parent',
        child: { value: 'Child' },
      },
    )!;
    expect(container.textContent).toContain('Parent');
    expect(container.textContent).toContain('Child');
    expect(container.textContent).toContain('/');
  });

  // -------------------------------------------------------------------------
  // Test 17: issuetype — renders icon + name
  // -------------------------------------------------------------------------

  it('Test 17 — issuetype: renders issue type name "Bug"', () => {
    const container = renderNode({ type: 'issuetype' }, { name: 'Bug', iconUrl: 'http://x' })!;
    expect(container.textContent).toContain('Bug');
  });

  it('Test 17b — issuetype: renders without crash when iconUrl absent', () => {
    const container = renderNode({ type: 'issuetype' }, { name: 'Story' })!;
    expect(container.textContent).toContain('Story');
  });

  // -------------------------------------------------------------------------
  // Test 18: empty-value contract — isNoiseValue
  // -------------------------------------------------------------------------

  it('Test 18a — isNoiseValue: null is noise', () => {
    expect(isNoiseValue('anything', null)).toBe(true);
  });

  it('Test 18b — isNoiseValue: undefined is noise', () => {
    expect(isNoiseValue('anything', undefined)).toBe(true);
  });

  it('Test 18c — isNoiseValue: empty string is noise', () => {
    expect(isNoiseValue('anything', '')).toBe(true);
  });

  it('Test 18d — isNoiseValue: empty array is noise', () => {
    expect(isNoiseValue('anything', [])).toBe(true);
  });

  it('Test 18e — isNoiseValue: empty plain object is noise', () => {
    expect(isNoiseValue('anything', {})).toBe(true);
  });

  it('Test 18f — isNoiseValue: workratio=-1 is noise', () => {
    expect(isNoiseValue('workratio', -1)).toBe(true);
  });

  it('Test 18g — isNoiseValue: workratio=0 is NOT noise', () => {
    expect(isNoiseValue('workratio', 0)).toBe(false);
  });

  it('Test 18h — isNoiseValue: progress {progress:0,total:0} is noise', () => {
    expect(isNoiseValue('progress', { progress: 0, total: 0 })).toBe(true);
  });

  it('Test 18i — isNoiseValue: progress {progress:5,total:10} is NOT noise', () => {
    expect(isNoiseValue('progress', { progress: 5, total: 10 })).toBe(false);
  });

  it('Test 18j — renderSourceFieldValue returns null for all noise values', () => {
    expect(renderSourceFieldValue({ type: 'string' }, null)).toBeNull();
    expect(renderSourceFieldValue({ type: 'string' }, '')).toBeNull();
    expect(renderSourceFieldValue({ type: 'array', items: 'string' }, [])).toBeNull();
    expect(renderSourceFieldValue({ type: 'any' }, {})).toBeNull();
    expect(renderSourceFieldValue({ type: 'number' }, -1, { fieldId: 'workratio' })).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 19: STATUS — status-shaped objects in 'any' branch use StatusBadge
  // -------------------------------------------------------------------------

  it('Test 19 — any: status-shaped value (has statusCategory) renders via StatusBadge text', () => {
    const container = renderNode(
      { type: 'any' },
      {
        name: 'Open',
        statusCategory: { key: 'new' },
      },
    )!;
    // Should render status name as text (from StatusBadge)
    expect(container.textContent).toContain('Open');
    // Should NOT render as raw JSON code block
    expect(container.querySelector('code')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 20: fieldId-based dispatch when schema.type is 'any'
  // (Jira's /field endpoint returns schema.type="status" which deserializes
  // to FieldSchemaType::Any since our enum has no Status variant.)
  // -------------------------------------------------------------------------

  it('Test 20a — any + fieldId="status" with bare {name,id}: StatusBadge', () => {
    const container = renderNode(
      { type: 'any' },
      { name: 'Open', id: '1' },
      { fieldId: 'status' },
    )!;
    expect(container.textContent).toContain('Open');
    expect(container.querySelector('code')).toBeNull();
  });

  it('Test 20b — any + fieldId="issuetype" with bare {id,name,subtask}: icon-less name', () => {
    const container = renderNode(
      { type: 'any' },
      { id: '10001', name: 'Bug', subtask: false },
      { fieldId: 'issuetype' },
    )!;
    expect(container.textContent).toContain('Bug');
    expect(container.querySelector('code')).toBeNull();
  });

  it('Test 20c — any + fieldId="priority" with bare {name}: PriorityIcon', () => {
    const container = renderNode({ type: 'any' }, { name: 'High' }, { fieldId: 'priority' })!;
    expect(container.textContent).toContain('High');
    expect(container.querySelector('code')).toBeNull();
  });

  it('Test 20d — any + fieldId="resolution" with {name}: plain text', () => {
    const container = renderNode({ type: 'any' }, { name: "Won't Do" }, { fieldId: 'resolution' })!;
    expect(container.textContent).toContain("Won't Do");
    expect(container.querySelector('code')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 21: generic object-with-name fallback
  // -------------------------------------------------------------------------

  it('Test 21a — any: generic object with `name` renders the name as text', () => {
    const container = renderNode(
      { type: 'any' },
      { id: '10000', name: 'Platform Team', self: 'http://x' },
    )!;
    expect(container.textContent).toBe('Platform Team');
    expect(container.querySelector('code')).toBeNull();
  });

  it('Test 21b — any: array of {name} objects renders comma-joined names', () => {
    const container = renderNode({ type: 'any' }, [{ name: 'frontend' }, { name: 'backend' }])!;
    expect(container.textContent).toBe('frontend, backend');
    expect(container.querySelector('code')).toBeNull();
  });

  it('Test 21c — any: boolean renders as Yes/No', () => {
    const trueNode = renderNode({ type: 'any' }, true)!;
    expect(trueNode.textContent).toBe('Yes');
    const falseNode = renderNode({ type: 'any' }, false)!;
    expect(falseNode.textContent).toBe('No');
  });

  it('Test 21d — any: nameless object still falls back to JSON', () => {
    const container = renderNode({ type: 'any' }, { foo: 'bar', baz: 1 })!;
    expect(container.querySelector('code')).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 22: object with `value` string property
  // -------------------------------------------------------------------------

  it('Test 22a — any: object with `value` string renders the value text', () => {
    const container = renderNode({ type: 'any' }, { id: '10', value: 'Medium' })!;
    expect(container.textContent).toBe('Medium');
    expect(container.querySelector('code')).toBeNull();
  });

  it('Test 22b — any: array of {value} objects renders comma-joined values', () => {
    const container = renderNode(
      { type: 'any' },
      [{ id: '1', value: 'Alpha' }, { id: '2', value: 'Beta' }],
    )!;
    expect(container.textContent).toBe('Alpha, Beta');
    expect(container.querySelector('code')).toBeNull();
  });

  it('Test 22c — any: array mixing {name} and {value} objects renders all labels', () => {
    const container = renderNode(
      { type: 'any' },
      [{ name: 'Frontend' }, { value: 'Backend' }],
    )!;
    expect(container.textContent).toBe('Frontend, Backend');
    expect(container.querySelector('code')).toBeNull();
  });
});
