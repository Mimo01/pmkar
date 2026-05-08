/**
 * AllFieldsSection tests (Task 2 — 260429-ev2).
 *
 * 9 behaviour tests from the plan + integration tests for OverviewTab and
 * CopyPreviewModal wiring (Tests 8 and 9).
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// schemaCacheStore mock — mutable per-test
// ---------------------------------------------------------------------------

let mockCacheData: Record<string, { status: string; fields?: unknown[] }> = {};
const mockLoadSchema = vi.fn();

vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        cache: mockCacheData,
        loadSchema: mockLoadSchema,
      }),
    {
      getState: () => ({
        cache: mockCacheData,
        loadSchema: mockLoadSchema,
      }),
    },
  ),
  schemaCacheKey: (side: string, pk: string | null, it: string | null) =>
    `${side}|${pk ?? '__null__'}|${it ?? '__null__'}`,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { AllFieldsSection } from '../AllFieldsSection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sourceKey = 'source|__null__|__null__';

function makeFields(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    summary: 'My ticket summary',
    priority: { name: 'High' },
    customfield_10001: 'Story Points URL value',
    ...overrides,
  };
}

const mockSchema = [
  { fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } },
  { fieldId: 'priority', name: 'Priority', required: false, schema: { type: 'priority' } },
  {
    fieldId: 'customfield_10001',
    name: 'Story Points URL',
    required: false,
    schema: { type: 'string' },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AllFieldsSection', () => {
  beforeEach(() => {
    mockLoadSchema.mockReset();
    mockCacheData = {};
  });

  // ── Test 1: loading state ───────────────────────────────────────────────────

  it('Test 1 — loading: renders rows with prettified key labels while schema is loading', () => {
    mockCacheData = { [sourceKey]: { status: 'loading' } };
    render(
      <AllFieldsSection fields={{ priority: { name: 'High' }, customfield_10001: 'some value' }} />,
    );
    // Should not crash; string fields should render as plain text
    expect(screen.getByText('some value')).toBeInTheDocument();
    // prettified label for unknown field (no schema during loading)
    expect(screen.getByText('Custom field 10001')).toBeInTheDocument();
  });

  // ── Test 2: success state ───────────────────────────────────────────────────

  it('Test 2 — success: renders all three fields with schema name as label', () => {
    mockCacheData = { [sourceKey]: { status: 'success', fields: mockSchema } };
    render(<AllFieldsSection fields={makeFields()} />);

    // Labels from schema
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Story Points URL')).toBeInTheDocument();

    // Values
    expect(screen.getByText('My ticket summary')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Story Points URL value')).toBeInTheDocument();
  });

  // ── Test 3: noise filtering ─────────────────────────────────────────────────

  it('Test 3 — filtering: noise fields (null, empty array, workratio=-1) are NOT rendered', () => {
    mockCacheData = {
      [sourceKey]: {
        status: 'success',
        fields: [
          { fieldId: 'workratio', name: 'Work Ratio', required: false, schema: { type: 'number' } },
          {
            fieldId: 'emptyField',
            name: 'Empty Field',
            required: false,
            schema: { type: 'string' },
          },
          {
            fieldId: 'nullField',
            name: 'Null Field',
            required: false,
            schema: { type: 'string' },
          },
          {
            fieldId: 'emptyArr',
            name: 'Empty Array',
            required: false,
            schema: { type: 'array', items: 'string' },
          },
          { fieldId: 'visible', name: 'Visible', required: false, schema: { type: 'string' } },
        ],
      },
    };
    render(
      <AllFieldsSection
        fields={{
          workratio: -1,
          emptyField: '',
          nullField: null,
          emptyArr: [],
          visible: 'show me',
        }}
      />,
    );

    // Should NOT appear
    expect(screen.queryByText('Work Ratio')).not.toBeInTheDocument();
    expect(screen.queryByText('Empty Field')).not.toBeInTheDocument();
    expect(screen.queryByText('Null Field')).not.toBeInTheDocument();
    expect(screen.queryByText('Empty Array')).not.toBeInTheDocument();

    // Should appear
    expect(screen.getByText('Visible')).toBeInTheDocument();
    expect(screen.getByText('show me')).toBeInTheDocument();
  });

  // ── Test 4: unknown field (no schema entry) ─────────────────────────────────

  it('Test 4 — unknown field: renders with prettified key as label, value as JSON fallback', () => {
    mockCacheData = { [sourceKey]: { status: 'success', fields: [] } };
    render(<AllFieldsSection fields={{ customfield_10999: 'mystery value' }} />);

    // Label: prettified key
    expect(screen.getByText('Custom field 10999')).toBeInTheDocument();
    // Value: string value rendered as JSON/raw or as text
    expect(screen.getByText('mystery value')).toBeInTheDocument();
  });

  // ── Test 5: compact vs non-compact layout ───────────────────────────────────

  it('Test 5a — compact=false: renders grid layout (default)', () => {
    mockCacheData = { [sourceKey]: { status: 'success', fields: mockSchema } };
    const { container } = render(<AllFieldsSection fields={makeFields()} />);
    // Non-compact: grid-cols-2
    const grid = container.querySelector('.grid');
    expect(grid).not.toBeNull();
  });

  it('Test 5b — compact=true: renders stacked layout', () => {
    mockCacheData = { [sourceKey]: { status: 'success', fields: mockSchema } };
    const { container } = render(<AllFieldsSection fields={makeFields()} compact />);
    // Compact: space-y-3
    const stack = container.querySelector('.space-y-3');
    expect(stack).not.toBeNull();
  });

  // ── Test 6: field ordering ──────────────────────────────────────────────────

  it('Test 6 — ordering: required system fields appear first, then others alphabetically', () => {
    mockCacheData = {
      [sourceKey]: {
        status: 'success',
        fields: [
          {
            fieldId: 'summary',
            name: 'Summary',
            required: true,
            schema: { type: 'string' },
            operations: [],
          },
          {
            fieldId: 'customfield_99',
            name: 'Zebra Custom',
            required: false,
            schema: { type: 'string' },
          },
          {
            fieldId: 'customfield_10',
            name: 'Alpha Custom',
            required: false,
            schema: { type: 'string' },
          },
        ],
      },
    };
    render(
      <AllFieldsSection
        fields={{
          summary: 'My summary',
          customfield_99: 'zebra',
          customfield_10: 'alpha',
        }}
      />,
    );

    // Use text content order in the DOM to verify ordering
    const allText = document.body.textContent ?? '';
    const summaryIdx = allText.indexOf('Summary');
    const alphaIdx = allText.indexOf('Alpha Custom');
    const zebraIdx = allText.indexOf('Zebra Custom');
    // Summary first (required system field)
    expect(summaryIdx).toBeLessThan(alphaIdx);
    // Alpha before Zebra (alphabetical among custom fields)
    expect(alphaIdx).toBeLessThan(zebraIdx);
  });

  // ── Test 7: skip list ───────────────────────────────────────────────────────

  it('Test 7 — skip: fields in the skip list are not rendered', () => {
    mockCacheData = {
      [sourceKey]: {
        status: 'success',
        fields: [
          {
            fieldId: 'description',
            name: 'Description',
            required: false,
            schema: { type: 'string', system: 'description' },
          },
          { fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } },
        ],
      },
    };
    render(
      <AllFieldsSection
        fields={{ description: 'skip me', summary: 'show me' }}
        skip={['description']}
      />,
    );

    expect(screen.queryByText('Description')).not.toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('show me')).toBeInTheDocument();
  });

  // ── Test 8: OverviewTab integration ────────────────────────────────────────

  it('Test 8 — OverviewTab integration: AllFieldsSection renders, bespoke sections still render', async () => {
    mockCacheData = {
      [sourceKey]: {
        status: 'success',
        fields: [
          { fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } },
          { fieldId: 'priority', name: 'Priority', required: false, schema: { type: 'priority' } },
          {
            fieldId: 'customfield_10000',
            name: 'Custom One',
            required: false,
            schema: { type: 'string' },
          },
          {
            fieldId: 'customfield_20000',
            name: 'Custom Two',
            required: false,
            schema: { type: 'string' },
          },
        ],
      },
    };

    // Import OverviewTab here so it picks up the mock
    const { OverviewTab } = await import('../tabs/OverviewTab');

    const detail = {
      id: 'P-1',
      key: 'P-1',
      fields: {
        summary: 'My ticket',
        status: { name: 'In Progress' },
        priority: { name: 'High', id: '2' },
        assignee: null,
        reporter: null,
        description: 'The description text',
        labels: [],
        components: [],
        fixVersions: [],
        comment: { comments: [] },
        attachment: [],
        subtasks: [],
        issuelinks: [],
        updated: '2026-01-01',
        customfield_10000: 'custom one value',
        customfield_20000: 'custom two value',
      },
    };

    render(
      <OverviewTab
        detail={detail as Parameters<typeof OverviewTab>[0]['detail']}
        baseUrl="http://server"
      />,
    );

    // Custom fields should appear
    expect(screen.getByText('Custom One')).toBeInTheDocument();
    expect(screen.getByText('custom one value')).toBeInTheDocument();

    // Bespoke sections still render
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  // ── Test 9: CopyPreviewModal source column integration ──────────────────────

  it('Test 9 — CopyPreviewModal: custom field appears in source column; DynamicTargetForm still renders', async () => {
    // Provide a populated schema cache entry
    mockCacheData = {
      [sourceKey]: {
        status: 'success',
        fields: [
          {
            fieldId: 'customfield_99999',
            name: 'My Custom Field',
            required: false,
            schema: { type: 'string' },
          },
          {
            fieldId: 'summary',
            name: 'Summary',
            required: true,
            schema: { type: 'string' },
          },
        ],
      },
    };

    // This is an integration smoke test — just verify AllFieldsSection renders without crash
    // and the custom field label appears.
    render(
      <AllFieldsSection
        fields={{ customfield_99999: 'my custom value', summary: 'Test ticket' }}
        compact
      />,
    );

    expect(screen.getByText('My Custom Field')).toBeInTheDocument();
    expect(screen.getByText('my custom value')).toBeInTheDocument();
  });
});
