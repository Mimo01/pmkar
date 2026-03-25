import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../connections/connectionStore';
import { useCopyStore } from '../copyStore';
import { TicketDetailPage } from '../TicketDetailPage';
import { useTicketStore } from '../ticketStore';
import type { JiraTicketDetail } from '../types';

const mockInvoke = vi.mocked(invoke);

const makeDetail = (): JiraTicketDetail => ({
  id: 'PROJ-1',
  key: 'PROJ-1',
  fields: {
    summary: 'Fix the login bug',
    status: { name: 'In Progress', id: '3' },
    priority: { name: 'High', id: '2' },
    assignee: { displayName: 'Alice', accountId: 'alice123' },
    reporter: { displayName: 'Bob', accountId: 'bob456' },
    description: 'Steps to reproduce...',
    labels: ['backend'],
    components: [],
    fixVersions: [],
    comment: { comments: [] },
    attachment: [],
    subtasks: [],
    issuelinks: [],
    updated: '2024-06-01T00:00:00.000Z',
  },
});

describe('TicketDetailPage', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    useConnectionStore.setState({
      serverConnection: {
        baseUrl: 'http://server.example.com',
        username: 'testuser',
        serverVersion: '9.0.0',
        lastTestedAt: '2024-01-01T00:00:00.000Z',
        status: 'ok',
      },
      cloudConnection: {
        baseUrl: 'https://company.atlassian.net',
        username: 'clouduser',
        serverVersion: '1000.0.0',
        lastTestedAt: '2024-01-01T00:00:00.000Z',
        status: 'ok',
      },
    });
    useCopyStore.setState({
      phase: 'idle',
      sourceTicket: null,
      sourceKey: null,
      targetSummary: '',
      targetDescription: '',
      targetStatus: '',
      targetPriorityId: '',
      targetLabels: [],
      selectedLabels: [],
      cloudMeta: null,
      result: null,
      error: null,
      progressStep: '',
    });
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

  it('shows loading state initially', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
    // Back button should be visible even during loading
    expect(screen.getByText('PROJ-1')).toBeInTheDocument();
  });

  it('shows back button during loading', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
    expect(screen.getByText(/back|detail\.back/i)).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked during loading', async () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));
    const onBack = vi.fn();
    render(<TicketDetailPage issueKey="PROJ-1" onBack={onBack} />);

    const backButton = screen.getAllByText(/back|detail\.back/i)[0];
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows ticket details after successful fetch', async () => {
    mockInvoke.mockResolvedValue(makeDetail());
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Fix the login bug')).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Network timeout'));
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/failed|detail\.failedToLoad/i)).toBeInTheDocument();
    });
  });

  it('shows ticket summary as heading', async () => {
    mockInvoke.mockResolvedValue(makeDetail());
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fix the login bug');
    });
  });

  it('shows status badge', async () => {
    mockInvoke.mockResolvedValue(makeDetail());
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
    });
  });

  it('shows priority', async () => {
    mockInvoke.mockResolvedValue(makeDetail());
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    });
  });

  it('shows Copy button when ticket is not copied', async () => {
    mockInvoke.mockResolvedValue(makeDetail());
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/copy|detail\.copy/i)).toBeInTheDocument();
    });
  });

  it('shows ignore button when ticket is not copied', async () => {
    mockInvoke.mockResolvedValue(makeDetail());
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);

    await waitFor(() => {
      // "Not for me" is the en translation for detail.ignore
      expect(screen.getByText(/not for me|detail\.ignore/i)).toBeInTheDocument();
    });
  });

  it('shows tab navigation after successful fetch', async () => {
    mockInvoke.mockResolvedValue(makeDetail());
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });

  it('shows ignored state button when ticket is ignored', async () => {
    useTicketStore.setState({
      triageMap: { 'PROJ-1': { state: 'ignored', copiedKey: null } },
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);
    mockInvoke.mockResolvedValue(makeDetail());
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);

    await waitFor(() => {
      // Shows 'Ignored' button with option to unignore
      expect(screen.getByText(/ignored|detail\.ignored/i)).toBeInTheDocument();
    });
  });

  it('calls invoke with fetch_ticket_detail on mount', async () => {
    mockInvoke.mockResolvedValue(makeDetail());
    render(<TicketDetailPage issueKey="PROJ-42" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('fetch_ticket_detail', {
        baseUrl: 'http://server.example.com',
        issueKey: 'PROJ-42',
      });
    });
  });

  it('calls onBack when Escape key is pressed', async () => {
    mockInvoke.mockResolvedValue(makeDetail());
    const onBack = vi.fn();
    render(<TicketDetailPage issueKey="PROJ-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText('Fix the login bug')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
