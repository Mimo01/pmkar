import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { HistoryTab } from '../tabs/HistoryTab';
import type { ChangelogEntry } from '../types';

const mockInvoke = vi.mocked(invoke);

const makeHistories = (): ChangelogEntry[] => [
  {
    id: 'h1',
    author: { displayName: 'Alice' },
    created: '2024-06-01T10:00:00.000Z',
    items: [
      { field: 'status', fromString: 'Open', toString: 'In Progress' },
    ],
  },
  {
    id: 'h2',
    author: { displayName: 'Bob' },
    created: '2024-06-02T09:00:00.000Z',
    items: [
      { field: 'priority', fromString: 'Low', toString: 'High' },
    ],
  },
];

describe('HistoryTab', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('shows loading state initially', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // never resolves
    const { container } = render(<HistoryTab issueKey="PROJ-1" baseUrl="http://server" />);
    // aria-busy loading indicator should be present
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('shows history entries after successful fetch', async () => {
    mockInvoke.mockResolvedValue({ histories: makeHistories() });
    render(<HistoryTab issueKey="PROJ-1" baseUrl="http://server" />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows field name and change values', async () => {
    mockInvoke.mockResolvedValue({ histories: makeHistories() });
    render(<HistoryTab issueKey="PROJ-1" baseUrl="http://server" />);

    await waitFor(() => {
      expect(screen.getByText('status')).toBeInTheDocument();
      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });
  });

  it('shows error message when fetch fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));
    render(<HistoryTab issueKey="PROJ-1" baseUrl="http://server" />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows empty state when no history entries', async () => {
    mockInvoke.mockResolvedValue({ histories: [] });
    render(<HistoryTab issueKey="PROJ-1" baseUrl="http://server" />);

    await waitFor(() => {
      // Should not show any author names
      expect(screen.queryByText('Alice')).toBeNull();
    });
  });

  it('calls invoke with fetch_changelog and correct params', async () => {
    mockInvoke.mockResolvedValue({ histories: [] });
    render(<HistoryTab issueKey="PROJ-42" baseUrl="http://jira.example.com" />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('fetch_changelog', {
        baseUrl: 'http://jira.example.com',
        issueKey: 'PROJ-42',
      });
    });
  });
});
