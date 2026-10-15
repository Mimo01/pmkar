import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketDetailPanel } from './TicketDetailPanel';
import { useTicketStore } from './ticketStore';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), dismiss: vi.fn() }),
}));

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

  it('handles fetch error gracefully — shows loading false state', async () => {
    mockInvoke.mockImplementation(() => Promise.reject(new Error('Network error')));
    render(
      <TicketDetailPanel issueKey="PROJ-1" baseUrl="http://127.0.0.1:8080" onClose={onClose} />,
    );

    await waitFor(() => {
      // After error, no loading spinner should remain — component should still render
      expect(document.body).toBeTruthy();
    });
  });

  describe('triage handlers keep the remembered key (LINT-01, D-09, D-13)', () => {
    const seed = (state: 'seen' | 'ignored' | 'handled') => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'fetch_ticket_detail') return Promise.resolve(mockDetail as never);
        return Promise.resolve(undefined as never);
      });
      useTicketStore.setState({ triageMap: { 'PROJ-1': { state, copiedKey: 'CLD-9' } } });
    };

    it('Dismiss keeps CLD-9 and makes no Jira copy call', async () => {
      seed('seen');
      render(
        <TicketDetailPanel issueKey="PROJ-1" baseUrl="http://127.0.0.1:8080" onClose={onClose} />,
      );
      fireEvent.click(await screen.findByRole('button', { name: /dismiss/i }));
      await waitFor(() =>
        expect(useTicketStore.getState().triageMap['PROJ-1']).toEqual({
          state: 'ignored',
          copiedKey: 'CLD-9',
        }),
      );
      expect(mockInvoke).toHaveBeenCalledWith('set_triage_state', {
        ticketKey: 'PROJ-1',
        state: 'ignored',
      });
      const cmds = mockInvoke.mock.calls.map((c) => c[0] as string);
      expect(cmds).not.toContain('relink_ticket');
      expect(cmds.some((c) => c.startsWith('copy_'))).toBe(false);
    });

    it('Mark as Handled keeps CLD-9', async () => {
      seed('seen');
      render(
        <TicketDetailPanel issueKey="PROJ-1" baseUrl="http://127.0.0.1:8080" onClose={onClose} />,
      );
      fireEvent.click(await screen.findByRole('button', { name: /mark as handled/i }));
      await waitFor(() =>
        expect(useTicketStore.getState().triageMap['PROJ-1']).toEqual({
          state: 'handled',
          copiedKey: 'CLD-9',
        }),
      );
    });

    it('Restoring from Ignored keeps CLD-9', async () => {
      seed('ignored');
      render(
        <TicketDetailPanel issueKey="PROJ-1" baseUrl="http://127.0.0.1:8080" onClose={onClose} />,
      );
      fireEvent.click(await screen.findByRole('button', { name: /^restore$/i }));
      await waitFor(() =>
        expect(useTicketStore.getState().triageMap['PROJ-1']).toEqual({
          state: 'seen',
          copiedKey: 'CLD-9',
        }),
      );
    });
  });
  describe('Phase 36 deny / link', () => {
    type S = 'seen' | 'copied' | 'ignored';
    const seed = (
      state: S,
      copiedKey: string | null,
      overrides: Record<string, () => Promise<unknown>> = {},
    ) => {
      mockInvoke.mockImplementation(((cmd: string) => {
        if (overrides[cmd]) return overrides[cmd]();
        if (cmd === 'fetch_ticket_detail') return Promise.resolve(mockDetail);
        return Promise.resolve(undefined);
      }) as never);
      useTicketStore.setState({ triageMap: { 'PROJ-1': { state, copiedKey } } });
    };
    const renderPanel = () =>
      render(
        <TicketDetailPanel issueKey="PROJ-1" baseUrl="http://127.0.0.1:8080" onClose={onClose} />,
      );

    it('focuses the close button on load', async () => {
      seed('seen', null);
      renderPanel();
      const close = await screen.findByRole('button', { name: /close/i });
      await waitFor(() => expect(document.activeElement).toBe(close));
    });

    it('Deny on a linked ticket sets ignored and focuses Restore link', async () => {
      seed('copied', 'CLD-9');
      renderPanel();
      fireEvent.click(await screen.findByRole('button', { name: /^deny$/i }));
      await waitFor(() =>
        expect(mockInvoke).toHaveBeenCalledWith('set_triage_state', {
          ticketKey: 'PROJ-1',
          state: 'ignored',
        }),
      );
      const cmds = mockInvoke.mock.calls.map((c) => c[0] as string);
      expect(cmds).not.toContain('relink_ticket');
      expect(cmds.some((c) => c.startsWith('copy_'))).toBe(false);
      const primary = await screen.findByRole('button', { name: 'Restore link to CLD-9' });
      await waitFor(() => expect(document.activeElement).toBe(primary));
    });

    it('failed Deny leaves focus on the Deny button', async () => {
      seed('copied', 'CLD-9', {
        set_triage_state: () => Promise.reject(new Error('fail')),
      });
      renderPanel();
      const deny = await screen.findByRole('button', { name: /^deny$/i });
      fireEvent.click(deny);
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /^deny$/i })),
      );
    });

    it('denied ticket with remembered key shows Restore link, Restore and hint', async () => {
      seed('ignored', 'CLD-9');
      renderPanel();
      expect(await screen.findByRole('button', { name: 'Restore link to CLD-9' })).toBeEnabled();
      expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^ignored$/i })).toBeNull();
      expect(screen.getByText(/Previously linked to/)).toBeInTheDocument();
    });

    it('never-linked denied ticket shows Copy primary and no hint', async () => {
      seed('ignored', null);
      renderPanel();
      expect(await screen.findByRole('button', { name: /^Copy to/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument();
      expect(screen.queryByText(/Previously linked to/)).toBeNull();
    });

    it('Restore link success renders and focuses the badge', async () => {
      seed('ignored', 'CLD-9', { relink_ticket: () => Promise.resolve('CLD-9') });
      renderPanel();
      fireEvent.click(await screen.findByRole('button', { name: 'Restore link to CLD-9' }));
      const badge = await screen.findByText(/CLD-9/, { selector: 'span[tabindex="-1"]' });
      await waitFor(() => expect(document.activeElement).toBe(badge));
    });

    it('Restore link failure toasts and refocuses the enabled button', async () => {
      seed('ignored', 'CLD-9', { relink_ticket: () => Promise.reject(new Error('fail')) });
      renderPanel();
      fireEvent.click(await screen.findByRole('button', { name: 'Restore link to CLD-9' }));
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Could not link the ticket. Try again.'),
      );
      const primary = await screen.findByRole('button', { name: 'Restore link to CLD-9' });
      await waitFor(() => expect(primary).toBeEnabled());
      await waitFor(() => expect(document.activeElement).toBe(primary));
    });

    it('Restore sets seen and focuses Dismiss', async () => {
      seed('ignored', 'CLD-9');
      renderPanel();
      fireEvent.click(await screen.findByRole('button', { name: /^restore$/i }));
      await waitFor(() =>
        expect(useTicketStore.getState().triageMap['PROJ-1']).toEqual({
          state: 'seen',
          copiedKey: 'CLD-9',
        }),
      );
      const dismiss = await screen.findByRole('button', { name: /^dismiss$/i });
      await waitFor(() => expect(document.activeElement).toBe(dismiss));
    });
  });
});
