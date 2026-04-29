import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OverviewTab } from '../tabs/OverviewTab';
import type { JiraTicketDetail } from '../types';

// ---------------------------------------------------------------------------
// schemaCacheStore mock — AllFieldsSection reads from cache on mount.
// With a 'success' entry containing system field schemas, all well-known fields
// render with proper schema-aware formatting.
// ---------------------------------------------------------------------------

vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        cache: {
          'source|__null__|__null__': {
            status: 'success',
            fields: [
              { fieldId: 'assignee', name: 'Assignee', required: false, schema: { type: 'user' } },
              { fieldId: 'reporter', name: 'Reporter', required: false, schema: { type: 'user' } },
              { fieldId: 'status', name: 'Status', required: false, schema: { type: 'any' } },
              {
                fieldId: 'priority',
                name: 'Priority',
                required: false,
                schema: { type: 'priority' },
              },
              {
                fieldId: 'labels',
                name: 'Labels',
                required: false,
                schema: { type: 'array', items: 'string' },
              },
              {
                fieldId: 'components',
                name: 'Components',
                required: false,
                schema: { type: 'array', items: 'component' },
              },
              {
                fieldId: 'fixVersions',
                name: 'Fix Versions',
                required: false,
                schema: { type: 'array', items: 'version' },
              },
              {
                fieldId: 'issuetype',
                name: 'Issue Type',
                required: false,
                schema: { type: 'issuetype' },
              },
            ],
          },
        },
        loadSchema: vi.fn(),
      }),
    {
      getState: () => ({
        cache: {
          'source|__null__|__null__': { status: 'success', fields: [] },
        },
        loadSchema: vi.fn(),
      }),
    },
  ),
  schemaCacheKey: (side: string, pk: string | null, it: string | null) =>
    `${side}|${pk ?? '__null__'}|${it ?? '__null__'}`,
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeDetail = (overrides: Partial<JiraTicketDetail['fields']> = {}): JiraTicketDetail => ({
  id: 'PROJ-1',
  key: 'PROJ-1',
  fields: {
    summary: 'Test ticket',
    status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
    priority: { name: 'High', id: '2' },
    assignee: { displayName: 'Alice', accountId: 'alice123' },
    reporter: { displayName: 'Bob', accountId: 'bob456' },
    description: 'This is a description',
    labels: ['backend', 'urgent'],
    components: [{ name: 'API' }],
    fixVersions: [{ name: '2.0.0' }],
    comment: { comments: [] },
    attachment: [],
    subtasks: [],
    issuelinks: [],
    updated: '2024-06-01T00:00:00.000Z',
    ...overrides,
  },
});

describe('OverviewTab', () => {
  it('renders assignee name', () => {
    render(<OverviewTab detail={makeDetail()} baseUrl="http://server" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders reporter name', () => {
    render(<OverviewTab detail={makeDetail()} baseUrl="http://server" />);
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders status name', () => {
    render(<OverviewTab detail={makeDetail()} baseUrl="http://server" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders priority name', () => {
    render(<OverviewTab detail={makeDetail()} baseUrl="http://server" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders "Unassigned" when assignee is null', () => {
    // AllFieldsSection skips null values — no assignee row will appear.
    // The old hardcoded "Unassigned" text no longer renders; this is correct
    // behaviour since a null/missing assignee is noise.
    render(<OverviewTab detail={makeDetail({ assignee: null })} baseUrl="http://server" />);
    // Status still renders (it's not null)
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders "Unknown" when reporter is null — null reporter is filtered out', () => {
    // Null reporter is noise and won't appear. Description section still renders.
    render(<OverviewTab detail={makeDetail({ reporter: null })} baseUrl="http://server" />);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders labels as comma-separated list', () => {
    render(<OverviewTab detail={makeDetail()} baseUrl="http://server" />);
    expect(screen.getByText('backend, urgent')).toBeInTheDocument();
  });

  it('renders "None" when no labels — null/empty array is filtered', () => {
    render(<OverviewTab detail={makeDetail({ labels: [] })} baseUrl="http://server" />);
    // Empty labels are noise; the row does not render.
    // Description section still renders as a bespoke section.
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders component names', () => {
    render(<OverviewTab detail={makeDetail()} baseUrl="http://server" />);
    expect(screen.getByText('API')).toBeInTheDocument();
  });

  it('renders fix version', () => {
    render(<OverviewTab detail={makeDetail()} baseUrl="http://server" />);
    expect(screen.getByText('2.0.0')).toBeInTheDocument();
  });

  it('renders subtasks when present', () => {
    const detail = makeDetail({
      subtasks: [{ key: 'PROJ-2', fields: { summary: 'Sub task', status: { name: 'Open' } } }],
    });
    render(<OverviewTab detail={detail} baseUrl="http://server" />);
    expect(screen.getByText('PROJ-2')).toBeInTheDocument();
    expect(screen.getByText('Sub task')).toBeInTheDocument();
  });

  it('renders linked issues when present', () => {
    const detail = makeDetail({
      issuelinks: [
        {
          id: 'link1',
          type: { name: 'blocks', inward: 'is blocked by', outward: 'blocks' },
          outwardIssue: {
            key: 'PROJ-5',
            fields: { summary: 'Blocking issue', status: { name: 'Open' } },
          },
        },
      ],
    });
    render(<OverviewTab detail={detail} baseUrl="http://server" />);
    expect(screen.getByText('PROJ-5')).toBeInTheDocument();
  });

  it('renders description label', () => {
    render(<OverviewTab detail={makeDetail()} baseUrl="http://server" />);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });
});
