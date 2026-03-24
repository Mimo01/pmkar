import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { WorkLogTab } from '../tabs/WorkLogTab';
import type { JiraWorklog } from '../types';

const mockInvoke = vi.mocked(invoke);

const makeWorklogs = (): JiraWorklog[] => [
  {
    id: 'wl1',
    author: { displayName: 'Alice' },
    comment: 'Fixed the bug',
    started: '2024-06-01T09:00:00.000Z',
    timeSpent: '2h',
    timeSpentSeconds: 7200,
  },
  {
    id: 'wl2',
    author: { displayName: 'Bob' },
    comment: '',
    started: '2024-06-02T10:00:00.000Z',
    timeSpent: '30m',
    timeSpentSeconds: 1800,
  },
];

describe('WorkLogTab', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('shows loading state initially', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<WorkLogTab issueKey="PROJ-1" baseUrl="http://server" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('shows worklog entries after successful fetch', async () => {
    mockInvoke.mockResolvedValue({ worklogs: makeWorklogs() });
    render(<WorkLogTab issueKey="PROJ-1" baseUrl="http://server" />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows time spent for each entry', async () => {
    mockInvoke.mockResolvedValue({ worklogs: makeWorklogs() });
    render(<WorkLogTab issueKey="PROJ-1" baseUrl="http://server" />);

    await waitFor(() => {
      expect(screen.getByText('2h')).toBeInTheDocument();
      expect(screen.getByText('30m')).toBeInTheDocument();
    });
  });

  it('shows comment when present', async () => {
    mockInvoke.mockResolvedValue({ worklogs: makeWorklogs() });
    render(<WorkLogTab issueKey="PROJ-1" baseUrl="http://server" />);

    await waitFor(() => {
      expect(screen.getByText('Fixed the bug')).toBeInTheDocument();
    });
  });

  it('shows error message when fetch fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Server unavailable'));
    render(<WorkLogTab issueKey="PROJ-1" baseUrl="http://server" />);

    await waitFor(() => {
      expect(screen.getByText('Server unavailable')).toBeInTheDocument();
    });
  });

  it('shows empty state when no worklogs', async () => {
    mockInvoke.mockResolvedValue({ worklogs: [] });
    render(<WorkLogTab issueKey="PROJ-1" baseUrl="http://server" />);

    await waitFor(() => {
      expect(screen.queryByText('Alice')).toBeNull();
    });
  });

  it('calls invoke with fetch_worklog and correct params', async () => {
    mockInvoke.mockResolvedValue({ worklogs: [] });
    render(<WorkLogTab issueKey="PROJ-42" baseUrl="http://jira.example.com" />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('fetch_worklog', {
        baseUrl: 'http://jira.example.com',
        issueKey: 'PROJ-42',
      });
    });
  });
});
