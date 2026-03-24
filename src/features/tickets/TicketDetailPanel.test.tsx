import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketDetailPanel } from './TicketDetailPanel';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

const mockDetail = {
  id: '10001',
  key: 'PROJ-1',
  fields: {
    summary: 'Test ticket summary',
    status: { name: 'In Progress', id: '3' },
    priority: { name: 'High', id: '2' },
    assignee: { name: 'jdoe', displayName: 'Jane Doe' },
    reporter: { name: 'csmith', displayName: 'Chris Smith' },
    description: 'Test description text',
    labels: ['bug'],
    components: [{ name: 'Backend' }],
    fixVersions: [{ name: '4.3.0' }],
    comment: {
      comments: [
        {
          id: '20001',
          author: { name: 'jdoe', displayName: 'Jane Doe' },
          body: 'Test comment',
          created: '2026-01-15T10:30:00.000+0000',
        },
      ],
    },
    attachment: [
      {
        id: '10100',
        filename: 'screenshot.png',
        size: 45231,
        mimeType: 'image/png',
        content: 'http://localhost/attachment',
      },
    ],
    subtasks: [
      {
        key: 'PROJ-7',
        fields: {
          summary: 'Sub-task one',
          status: { name: 'Open', id: '1' },
        },
      },
    ],
    issuelinks: [],
    updated: '2026-02-28T10:00:00.000+0000',
  },
  renderedFields: { description: '<p>Test description text</p>' },
  changelog: { histories: [] },
};

describe('TicketDetailPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    mockInvoke.mockReset();
    onClose.mockReset();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'fetch_ticket_detail') return Promise.resolve(mockDetail);
      return Promise.resolve(undefined);
    });
  });

  it('renders ticket summary in panel header', async () => {
    render(
      <TicketDetailPanel issueKey="PROJ-1" baseUrl="http://127.0.0.1:8080" onClose={onClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Test ticket summary')).toBeInTheDocument();
    });
  });

  it('renders Overview tab by default', async () => {
    render(
      <TicketDetailPanel issueKey="PROJ-1" baseUrl="http://127.0.0.1:8080" onClose={onClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Description')).toBeInTheDocument();
    });
  });

  it('renders Comments tab when clicked', async () => {
    render(
      <TicketDetailPanel issueKey="PROJ-1" baseUrl="http://127.0.0.1:8080" onClose={onClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Comments (1)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Comments (1)'));

    await waitFor(() => {
      expect(screen.getByText('Test comment')).toBeInTheDocument();
    });
  });

  it('renders Attachments tab with filename', async () => {
    render(
      <TicketDetailPanel issueKey="PROJ-1" baseUrl="http://127.0.0.1:8080" onClose={onClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Attachments (1)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Attachments (1)'));

    await waitFor(() => {
      expect(screen.getByText('screenshot.png')).toBeInTheDocument();
    });
  });

  it('renders sub-tasks in Overview tab', async () => {
    render(
      <TicketDetailPanel issueKey="PROJ-1" baseUrl="http://127.0.0.1:8080" onClose={onClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('PROJ-7')).toBeInTheDocument();
      expect(screen.getByText('Sub-task one')).toBeInTheDocument();
    });
  });

  it('calls fetch_ticket_detail on mount', async () => {
    render(
      <TicketDetailPanel issueKey="PROJ-1" baseUrl="http://127.0.0.1:8080" onClose={onClose} />,
    );

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('fetch_ticket_detail', {
        baseUrl: 'http://127.0.0.1:8080',
        issueKey: 'PROJ-1',
      });
    });
  });
});
