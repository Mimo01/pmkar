import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LinkedTicketsPage } from '../LinkedTicketsPage';
import { useTicketStore } from '../ticketStore';
import type { JiraTicket, TriageEntry } from '../types';

const makeTicket = (key: string, updated = '2024-01-01T00:00:00.000Z'): JiraTicket => ({
  id: key,
  key,
  fields: {
    summary: `Summary for ${key}`,
    status: { name: 'Done' },
    priority: { name: 'Medium', id: '3' },
    assignee: null,
    updated,
  },
});

describe('LinkedTicketsPage', () => {
  beforeEach(() => {
    useTicketStore.setState({
      tickets: [],
      triageMap: {},
      selectedTicketKey: null,
      fetchStatus: 'idle',
      fetchError: null,
      lastFetchedAt: null,
      totalCount: 0,
      newCount: 0,
      jqlPreset: 'assigned',
      jqlCustom: null,
      watchedUsers: [],
    });
  });

  it('shows empty state when no copied tickets', () => {
    render(<LinkedTicketsPage />);
    // Should show the empty heading from i18n (key: linked.empty.heading)
    expect(screen.getByText(/linked\.empty\.heading|No linked tickets/i)).toBeInTheDocument();
  });

  it('shows ticket cards for copied tickets', () => {
    const ticket = makeTicket('PROJ-1');
    const triageMap: Record<string, TriageEntry> = {
      'PROJ-1': { state: 'copied', copiedKey: 'CLOUD-5' },
    };
    useTicketStore.setState({ tickets: [ticket], triageMap });

    render(<LinkedTicketsPage />);

    expect(screen.getByText('Summary for PROJ-1')).toBeInTheDocument();
  });

  it('does not show non-copied tickets', () => {
    const tickets = [makeTicket('PROJ-1'), makeTicket('PROJ-2')];
    const triageMap: Record<string, TriageEntry> = {
      'PROJ-1': { state: 'new', copiedKey: null },
      'PROJ-2': { state: 'copied', copiedKey: 'CLOUD-5' },
    };
    useTicketStore.setState({ tickets, triageMap });

    render(<LinkedTicketsPage />);

    expect(screen.queryByText('Summary for PROJ-1')).toBeNull();
    expect(screen.getByText('Summary for PROJ-2')).toBeInTheDocument();
  });

  it('sorts copied tickets by updated descending', () => {
    const tickets = [
      makeTicket('PROJ-1', '2024-01-01T00:00:00.000Z'),
      makeTicket('PROJ-2', '2024-06-01T00:00:00.000Z'),
    ];
    const triageMap: Record<string, TriageEntry> = {
      'PROJ-1': { state: 'copied', copiedKey: 'CLOUD-1' },
      'PROJ-2': { state: 'copied', copiedKey: 'CLOUD-2' },
    };
    useTicketStore.setState({ tickets, triageMap });

    render(<LinkedTicketsPage />);

    const summaries = screen.getAllByText(/Summary for PROJ-/);
    // PROJ-2 (newer) should appear before PROJ-1 (older)
    expect(summaries[0].textContent).toBe('Summary for PROJ-2');
    expect(summaries[1].textContent).toBe('Summary for PROJ-1');
  });
});
