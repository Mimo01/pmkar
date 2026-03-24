import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverviewTab } from '../tabs/OverviewTab';
import type { JiraTicketDetail } from '../types';

const makeDetail = (overrides: Partial<JiraTicketDetail['fields']> = {}): JiraTicketDetail => ({
  id: 'PROJ-1',
  key: 'PROJ-1',
  fields: {
    summary: 'Test ticket',
    status: { name: 'In Progress' },
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
    render(<OverviewTab detail={makeDetail({ assignee: null })} baseUrl="http://server" />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('renders "Unknown" when reporter is null', () => {
    render(<OverviewTab detail={makeDetail({ reporter: null })} baseUrl="http://server" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('renders labels as comma-separated list', () => {
    render(<OverviewTab detail={makeDetail()} baseUrl="http://server" />);
    expect(screen.getByText('backend, urgent')).toBeInTheDocument();
  });

  it('renders "None" when no labels', () => {
    render(<OverviewTab detail={makeDetail({ labels: [] })} baseUrl="http://server" />);
    // "None" appears for labels, components, and fix versions all
    const noneElements = screen.getAllByText('None');
    expect(noneElements.length).toBeGreaterThan(0);
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
