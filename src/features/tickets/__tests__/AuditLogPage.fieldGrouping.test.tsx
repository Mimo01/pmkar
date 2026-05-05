/**
 * AuditLogPage — Field Transformations grouping tests (quick task 260430-26i).
 *
 * Covers: per-copy-id grouping, header counts, per-group Copy button,
 * value-vs-hash rendering, and collapsed-by-default behaviour.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MappingAuditEntry } from '../types';

// ---------------------------------------------------------------------------
// Tauri invoke mock
// ---------------------------------------------------------------------------

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(
  partial: Partial<MappingAuditEntry> & Pick<MappingAuditEntry, 'id' | 'copyId' | 'fieldId'>,
): MappingAuditEntry {
  return {
    sourceValueHash: 'src-hash',
    targetValueHash: 'tgt-hash',
    wasOverridden: false,
    gapKind: null,
    transformerKind: 'identity',
    outcome: 'ok',
    failureReason: null,
    timestamp: '2026-04-30T10:00:00Z',
    sourceValueJson: null,
    targetValueJson: null,
    ...partial,
  } as MappingAuditEntry;
}

// Five rows split across 2 copy operations. Most-recent operation first
// (rows arrive newest-first from get_mapping_audit_log_page).
const rowsTwoGroups: MappingAuditEntry[] = [
  // Group A — newest copy, 3 rows, last 2 are failed/skipped
  makeEntry({
    id: 5,
    copyId: 'aaaaaaaa-1111-2222-3333-444444444444',
    fieldId: 'summary',
    timestamp: '2026-04-30T12:00:03Z',
    sourceValueJson: '"Hello world"',
    targetValueJson: '"Hello world"',
  }),
  makeEntry({
    id: 4,
    copyId: 'aaaaaaaa-1111-2222-3333-444444444444',
    fieldId: 'priority',
    timestamp: '2026-04-30T12:00:02Z',
    outcome: 'failed',
    failureReason: 'No matching priority on target',
    sourceValueJson: '{"name":"High"}',
    targetValueJson: 'null',
  }),
  makeEntry({
    id: 3,
    copyId: 'aaaaaaaa-1111-2222-3333-444444444444',
    fieldId: 'labels',
    timestamp: '2026-04-30T12:00:01Z',
    outcome: 'skipped',
    failureReason: 'source value missing',
    sourceValueJson: null,
    targetValueJson: null,
    sourceValueHash: 'abc123def456hash',
    targetValueHash: 'abc123def456hash',
  }),
  // Group B — older copy, 2 rows
  makeEntry({
    id: 2,
    copyId: 'bbbbbbbb-9999-8888-7777-666666666666',
    fieldId: 'description',
    timestamp: '2026-04-30T08:00:01Z',
    sourceValueJson: '"Some description"',
    targetValueJson: '"Some description"',
  }),
  makeEntry({
    id: 1,
    copyId: 'bbbbbbbb-9999-8888-7777-666666666666',
    fieldId: 'assignee',
    timestamp: '2026-04-30T08:00:00Z',
    sourceValueJson: '{"displayName":"Alice"}',
    targetValueJson: '{"displayName":"Alice"}',
  }),
];

beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'get_mapping_audit_log_page') {
      return Promise.resolve(rowsTwoGroups);
    }
    if (cmd === 'get_audit_logs_page') {
      return Promise.resolve([]);
    }
    return Promise.resolve(null);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

async function openFieldsTab() {
  // Lazy import after mocks are set up.
  const { AuditLogPage } = await import('../AuditLogPage');
  render(<AuditLogPage onClose={() => {}} />);
  // Click the Field Transformations tab.
  const tabBtn = await screen.findByRole('tab', { name: /Field Transformations/i });
  fireEvent.click(tabBtn);
  // Wait for the mock invoke to land. Group headers are role=button with 'Copy ' prefix in aria-label.
  await waitFor(() => {
    expect(mockInvoke).toHaveBeenCalledWith('get_mapping_audit_log_page', expect.anything());
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditLogPage — Field Transformations grouping (quick task 260430-26i)', () => {
  it('renders one card per copyId, ordered most-recent group first', async () => {
    await openFieldsTab();
    // Each group exposes a header button labeled with the short copy id.
    const aShort = 'aaaaaaaa';
    const bShort = 'bbbbbbbb';

    const aHeader = await screen.findByRole('button', {
      name: new RegExp(aShort, 'i'),
    });
    const bHeader = await screen.findByRole('button', {
      name: new RegExp(bShort, 'i'),
    });

    expect(aHeader).toBeInTheDocument();
    expect(bHeader).toBeInTheDocument();

    // Ordering: A (newest, 12:00) before B (08:00) in DOM order.
    // compareDocumentPosition returns DOCUMENT_POSITION_FOLLOWING (4) when
    // the second node is positioned AFTER the first.
    const order = aHeader.compareDocumentPosition(bHeader);
    // DOCUMENT_POSITION_FOLLOWING = 4
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('group header shows total/failed/skipped counts (omitting zeros)', async () => {
    await openFieldsTab();
    const aShort = 'aaaaaaaa';
    const aHeader = await screen.findByRole('button', {
      name: new RegExp(aShort, 'i'),
    });
    // Group A has 3 fields, 1 failed, 1 skipped.
    expect(aHeader.textContent).toMatch(/3 fields/i);
    expect(aHeader.textContent).toMatch(/1 failed/i);
    expect(aHeader.textContent).toMatch(/1 skipped/i);

    const bShort = 'bbbbbbbb';
    const bHeader = await screen.findByRole('button', {
      name: new RegExp(bShort, 'i'),
    });
    // Group B has 2 fields, 0 failed, 0 skipped — only "2 fields" should show.
    expect(bHeader.textContent).toMatch(/2 fields/i);
    expect(bHeader.textContent).not.toMatch(/failed/i);
    expect(bHeader.textContent).not.toMatch(/skipped/i);
  });

  it('Copy button copies plain-text payload and shows Copied feedback that reverts', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { AuditLogPage } = await import('../AuditLogPage');
    render(<AuditLogPage onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('tab', { name: /Field Transformations/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_mapping_audit_log_page', expect.anything());
    });

    // Copy buttons (one per group). Pick the first.
    const copyButtons = await screen.findAllByRole('button', {
      name: /Copy this transformation group/i,
    });
    expect(copyButtons.length).toBe(2);

    // Switch to fake timers AFTER the data has loaded so the async setup
    // (Tauri invoke + clipboard polyfill) ran on real timers. The 1500ms
    // setTimeout in handleCopyGroup runs under fake timers below.
    vi.useFakeTimers({ shouldAdvanceTime: true });

    fireEvent.click(copyButtons[0]);

    // Wait for the async clipboard.writeText call (uses real-ish time because
    // shouldAdvanceTime: true keeps microtasks unblocked).
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    const text = writeText.mock.calls[0][0] as string;
    // Includes copy id, all field ids of group A, source/target lines.
    expect(text).toContain('aaaaaaaa');
    expect(text).toContain('summary');
    expect(text).toContain('priority');
    expect(text).toContain('labels');
    expect(text).toMatch(/source:/i);
    expect(text).toMatch(/target:/i);
    // failed reason for priority must appear
    expect(text).toContain('No matching priority on target');

    // Button now reads "Copied ✓".
    await waitFor(() => {
      expect(copyButtons[0].textContent).toMatch(/Copied/i);
    });

    // Advance time past the 1500ms timer and flush React state updates.
    await vi.advanceTimersByTimeAsync(1600);

    // Switch back to real timers for the final waitFor since waitFor itself uses setTimeout.
    vi.useRealTimers();
    await waitFor(() => {
      expect(copyButtons[0].textContent).not.toMatch(/Copied/i);
      expect(copyButtons[0].textContent).toMatch(/Copy/);
    });
  });

  it('renders source/target JSON when present and falls back to hash when JSON is null', async () => {
    await openFieldsTab();

    // Expand group A so its rows are in the DOM.
    const aHeader = await screen.findByRole('button', {
      name: /aaaaaaaa/i,
    });
    fireEvent.click(aHeader);

    // Row with sourceValueJson = '"Hello world"' must render the JSON text.
    // Both source and target columns show the same JSON, so multiple matches are expected.
    await waitFor(() => {
      const matches = screen.getAllByText(/Hello world/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    // Row "labels" has both JSON nulls and a hash 'abc123def456hash'. Hash should appear.
    const hashMatches = screen.getAllByText(/abc123/);
    expect(hashMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('group bodies are collapsed by default and expand on header click', async () => {
    await openFieldsTab();

    // Before expansion: row content (e.g. 'summary' field id from group A body)
    // should NOT be present in the DOM.
    expect(screen.queryByText('summary')).not.toBeInTheDocument();

    const aHeader = await screen.findByRole('button', { name: /aaaaaaaa/i });
    expect(aHeader).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(aHeader);

    await waitFor(() => {
      expect(aHeader).toHaveAttribute('aria-expanded', 'true');
    });
    expect(await screen.findByText('summary')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 'copied' outcome — Phase 24 Plan 02
// ---------------------------------------------------------------------------

describe("groupByCopyId — 'copied' outcome handling (Phase 24-02)", () => {
  it("counts 'copied' rows in total but not failed or skipped", async () => {
    const { groupByCopyId } = await import('../AuditLogPage');
    const rows: MappingAuditEntry[] = [
      makeEntry({ id: 10, copyId: 'test-copy-id', fieldId: 'description', outcome: 'copied' }),
      makeEntry({ id: 11, copyId: 'test-copy-id', fieldId: 'summary', outcome: 'ok' }),
    ];
    const groups = groupByCopyId(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].total).toBe(2);
    expect(groups[0].failed).toBe(0);
    expect(groups[0].skipped).toBe(0);
  });

  it("renders 'copied' outcome badge text via i18n key", async () => {
    // copyId first 8 chars = 'cccccccc'; group header aria-label = 'Copy cccccccc — …'
    const COPY_UUID = 'cccccccc-dead-beef-feed-000000000001';
    const copiedEntry = makeEntry({
      id: 20,
      copyId: COPY_UUID,
      fieldId: 'description',
      outcome: 'copied',
      sourceValueJson: '"Some wiki markup"',
      targetValueJson: '{"type":"doc","version":1,"content":[]}',
    });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_mapping_audit_log_page') return Promise.resolve([copiedEntry]);
      if (cmd === 'get_audit_logs_page') return Promise.resolve([]);
      return Promise.resolve(null);
    });
    await openFieldsTab();
    // Expand the group — aria-label uses shortId = first 8 chars of copyId
    const groupHeader = await screen.findByRole('button', { name: /cccccccc/i });
    fireEvent.click(groupHeader);
    // Badge text resolves to the en.json value "copied" (real i18n loaded in test-setup.ts)
    await waitFor(() => {
      expect(screen.getByText('copied')).toBeTruthy();
    });
  });

  it("'copied' outcome does not appear in failed or skipped group summary text", async () => {
    // copyId first 8 chars = 'dddddddd'
    const COPY_UUID = 'dddddddd-dead-beef-feed-000000000002';
    const copiedEntry = makeEntry({
      id: 30,
      copyId: COPY_UUID,
      fieldId: 'description',
      outcome: 'copied',
    });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_mapping_audit_log_page') return Promise.resolve([copiedEntry]);
      if (cmd === 'get_audit_logs_page') return Promise.resolve([]);
      return Promise.resolve(null);
    });
    await openFieldsTab();
    const groupHeader = await screen.findByRole('button', { name: /dddddddd/i });
    // Header shows total count but not failed or skipped (both are 0)
    expect(groupHeader.textContent).toMatch(/1 field/i);
    expect(groupHeader.textContent).not.toMatch(/failed/i);
    expect(groupHeader.textContent).not.toMatch(/skipped/i);
  });
});

// ---------------------------------------------------------------------------
// Helper unit tests (groupByCopyId, buildGroupCopyText)
// ---------------------------------------------------------------------------

describe('groupByCopyId helper (quick task 260430-26i)', () => {
  it('groups rows by copyId preserving newest-first input order', async () => {
    const { groupByCopyId } = await import('../AuditLogPage');
    const groups = groupByCopyId(rowsTwoGroups);
    expect(groups).toHaveLength(2);
    expect(groups[0].copyId).toBe('aaaaaaaa-1111-2222-3333-444444444444');
    expect(groups[0].rows).toHaveLength(3);
    expect(groups[0].total).toBe(3);
    expect(groups[0].failed).toBe(1);
    expect(groups[0].skipped).toBe(1);
    expect(groups[0].latestTimestamp).toBe('2026-04-30T12:00:03Z');

    expect(groups[1].copyId).toBe('bbbbbbbb-9999-8888-7777-666666666666');
    expect(groups[1].rows).toHaveLength(2);
    expect(groups[1].failed).toBe(0);
    expect(groups[1].skipped).toBe(0);
  });
});

describe('buildGroupCopyText helper (quick task 260430-26i)', () => {
  it('produces a plain-text payload with copy id, counts, fields, source, target, reason', async () => {
    const { groupByCopyId, buildGroupCopyText } = await import('../AuditLogPage');
    const groups = groupByCopyId(rowsTwoGroups);
    const text = buildGroupCopyText(groups[0]);

    // Header: copy id + counts.
    expect(text).toContain('aaaaaaaa-1111-2222-3333-444444444444');
    expect(text).toMatch(/3 fields/);
    expect(text).toMatch(/1 failed/);
    expect(text).toMatch(/1 skipped/);

    // Each field appears with source: / target: lines.
    expect(text).toContain('summary');
    expect(text).toContain('priority');
    expect(text).toContain('labels');
    expect(text).toMatch(/source:/);
    expect(text).toMatch(/target:/);

    // failureReason for priority is included.
    expect(text).toContain('No matching priority on target');

    // For 'labels' (json null), the hash should appear in the body somewhere.
    expect(text).toContain('abc123');
  });
});
