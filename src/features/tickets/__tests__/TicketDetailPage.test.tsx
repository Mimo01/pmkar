import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

// AllFieldsSection (via OverviewTab) reads source schema on mount.
vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        cache: {
          'source|__null__|__null__': {
            status: 'success',
            fields: [
              { fieldId: 'status', name: 'Status', required: false, schema: { type: 'any' } },
              {
                fieldId: 'priority',
                name: 'Priority',
                required: false,
                schema: { type: 'priority' },
              },
              { fieldId: 'assignee', name: 'Assignee', required: false, schema: { type: 'user' } },
              { fieldId: 'reporter', name: 'Reporter', required: false, schema: { type: 'user' } },
              {
                fieldId: 'labels',
                name: 'Labels',
                required: false,
                schema: { type: 'array', items: 'string' },
              },
            ],
          },
        },
        loadSchema: vi.fn(),
      }),
    {
      getState: () => ({
        cache: { 'source|__null__|__null__': { status: 'success', fields: [] } },
        loadSchema: vi.fn(),
      }),
    },
  ),
  schemaCacheKey: (side: string, pk: string | null, it: string | null) =>
    `${side}|${pk ?? '__null__'}|${it ?? '__null__'}`,
}));

import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../connections/connectionStore';
import { useGroupStore } from '../../groups/groupStore';
import { useCopyStore } from '../copyStore';
import { TicketDetailPage } from '../TicketDetailPage';
import { useTicketStore } from '../ticketStore';
import type { JiraTicketDetail } from '../types';
import {
  cancelConfirm,
  confirmDeny,
  confirmLink,
  confirmWatch,
  expectNoConfirmDialog,
} from './confirmHelpers';

const mockInvoke = vi.mocked(invoke);

const makeDetail = (): JiraTicketDetail => ({
  id: 'PROJ-1',
  key: 'PROJ-1',
  fields: {
    summary: 'Fix the login bug',
    status: { name: 'In Progress', id: '3', statusCategory: { key: 'indeterminate' } },
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
      jqlPreset: 'mine',
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
      // "Dismiss" is the en translation for detail.ignore
      expect(screen.getByText(/dismiss|detail\.ignore/i)).toBeInTheDocument();
    });
  });

  it('shows tab navigation after successful fetch', async () => {
    mockInvoke.mockResolvedValue(makeDetail());
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });

  it('shows Restore and Copy actions when ticket is denied', async () => {
    useTicketStore.setState({
      triageMap: { 'PROJ-1': { state: 'ignored', copiedKey: null } },
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);
    mockInvoke.mockResolvedValue(makeDetail());
    render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Copy to/ })).toBeInTheDocument();
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
  describe('Groups row', () => {
    const groups = [
      { id: 1, name: 'Sprint', color: 'blue', position: 0, createdAt: 't', memberCount: 1 },
      { id: 2, name: 'QA', color: 'red', position: 1, createdAt: 't', memberCount: 0 },
    ];

    beforeEach(() => {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
      Element.prototype.scrollIntoView = vi.fn();
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'list_groups') return groups;
        if (cmd === 'list_group_memberships') return [{ groupId: 1, issueKey: 'PROJ-1' }];
        if (cmd === 'get_issue') return makeDetail();
        return makeDetail();
      });
      useGroupStore.setState({
        groups: groups as never,
        memberKeysByGroup: {},
        groupIdsByIssue: { 'PROJ-1': [1] },
        hydrated: true,
        hydrateError: false,
      });
    });

    it('renders the Groups button before the action buttons', async () => {
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      const groupsBtn = await screen.findByRole('button', {
        name: /^groups$|groups\.picker\.button/i,
      });
      const action = screen.getByText(/dismiss|detail\.ignore/i);
      expect(
        groupsBtn.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('Escape with no popover open calls onBack once', async () => {
      const onBack = vi.fn();
      render(<TicketDetailPage issueKey="PROJ-1" onBack={onBack} />);
      await screen.findByRole('button', { name: /^groups$|groups\.picker\.button/i });
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('Escape inside the open picker closes it without calling onBack', async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();
      render(<TicketDetailPage issueKey="PROJ-1" onBack={onBack} />);
      await user.click(
        await screen.findByRole('button', { name: /^groups$|groups\.picker\.button/i }),
      );
      const input = await screen.findByRole('combobox');
      expect(input).toBeInTheDocument();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
      expect(onBack).not.toHaveBeenCalled();
    });

    it('Escape inside a chip remove confirm closes it without calling onBack', async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();
      render(<TicketDetailPage issueKey="PROJ-1" onBack={onBack} />);
      await user.click(await screen.findByRole('button', { name: /Remove from .Sprint./ }));
      await screen.findByText(/Remove from .Sprint.\?/);
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByText(/Remove from .Sprint.\?/)).toBeNull());
      expect(onBack).not.toHaveBeenCalled();
    });
  });

  describe('triage handlers keep the remembered key (LINT-01, D-09, D-13)', () => {
    const seed = (state: 'seen' | 'ignored' | 'handled') => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'fetch_ticket_detail') return Promise.resolve(makeDetail() as never);
        return Promise.resolve(undefined as never);
      });
      useTicketStore.setState({ triageMap: { 'PROJ-1': { state, copiedKey: 'CLD-9' } } });
    };

    it('Dismiss keeps CLD-9 and makes no Jira copy call', async () => {
      seed('seen');
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
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
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
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
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
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
    const seed = (state: 'copied' | 'ignored', copiedKey: string | null) => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'fetch_ticket_detail') return Promise.resolve(makeDetail() as never);
        return Promise.resolve(undefined as never);
      });
      useTicketStore.setState({ triageMap: { 'PROJ-1': { state, copiedKey } } });
    };

    it('Linked: Deny writes ignored and focuses Restore link', async () => {
      seed('copied', 'CLD-9');
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Deny' }));
      await confirmDeny();
      const restoreLink = await screen.findByRole('button', { name: 'Restore link to CLD-9' });
      await waitFor(() => expect(document.activeElement).toBe(restoreLink));
      expect(mockInvoke).toHaveBeenCalledWith('set_triage_state', {
        ticketKey: 'PROJ-1',
        state: 'ignored',
      });
      const cmds = mockInvoke.mock.calls.map((c) => c[0] as string);
      expect(cmds).not.toContain('relink_ticket');
      expect(cmds.some((c) => c.startsWith('copy_'))).toBe(false);
    });

    it('Linked: failed Deny returns focus to Deny', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'fetch_ticket_detail') return Promise.resolve(makeDetail() as never);
        if (cmd === 'set_triage_state') return Promise.reject(new Error('boom'));
        return Promise.resolve(undefined as never);
      });
      useTicketStore.setState({ triageMap: { 'PROJ-1': { state: 'copied', copiedKey: 'CLD-9' } } });
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      const deny = await screen.findByRole('button', { name: 'Deny' });
      fireEvent.click(deny);
      await confirmDeny();
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Deny' })),
      );
    });

    it('Denied with remembered key shows Restore link, Restore and hint', async () => {
      seed('ignored', 'CLD-9');
      const { container } = render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      expect(await screen.findByRole('button', { name: 'Restore link to CLD-9' })).toBeVisible();
      expect(screen.getByRole('button', { name: /^restore$/i })).toBeVisible();
      expect(screen.queryByRole('button', { name: /^ignored$/i })).toBeNull();
      expect(container.textContent).toContain('Previously linked to CLD-9');
    });

    it('Denied never linked shows Copy to primary and no hint', async () => {
      seed('ignored', null);
      const { container } = render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      expect(await screen.findByRole('button', { name: /^Copy to/ })).toBeVisible();
      expect(screen.getByRole('button', { name: /^restore$/i })).toBeVisible();
      expect(container.textContent).not.toContain('Previously linked');
    });

    it('Restore link relinks, shows Linked badge focused and Deny', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'fetch_ticket_detail') return Promise.resolve(makeDetail() as never);
        if (cmd === 'relink_ticket') return Promise.resolve('CLD-9' as never);
        return Promise.resolve(undefined as never);
      });
      useTicketStore.setState({
        triageMap: { 'PROJ-1': { state: 'ignored', copiedKey: 'CLD-9' } },
      });
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Restore link to CLD-9' }));
      await confirmLink();
      const badge = await screen.findByText(/→ CLD-9/);
      await waitFor(() => expect(document.activeElement).toBe(badge));
      expect(screen.getByRole('button', { name: 'Deny' })).toBeVisible();
    });

    it('Restore link with no key hands off to the copy preview', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'fetch_ticket_detail') return Promise.resolve(makeDetail() as never);
        if (cmd === 'relink_ticket') return Promise.resolve(null as never);
        return Promise.resolve(undefined as never);
      });
      const startPreview = vi.fn();
      useCopyStore.setState({ startPreview } as never);
      useTicketStore.setState({
        triageMap: { 'PROJ-1': { state: 'ignored', copiedKey: 'CLD-9' } },
      });
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Restore link to CLD-9' }));
      await confirmLink();
      await waitFor(() => expect(startPreview).toHaveBeenCalled());
      expect(screen.queryByText(/→ CLD-9/)).toBeNull();
    });

    it('Linked: Deny shows dialog, writes nothing until confirmed; Cancel returns focus to Deny', async () => {
      seed('copied', 'CLD-9');
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Deny' }));
      expect(await screen.findByRole('alertdialog')).toBeVisible();
      expect(mockInvoke.mock.calls.map((c) => c[0])).not.toContain('set_triage_state');
      await cancelConfirm();
      expect(mockInvoke.mock.calls.map((c) => c[0])).not.toContain('set_triage_state');
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Deny' })),
      );
    });

    it('Esc in the dialog closes only the dialog, not the page', async () => {
      seed('copied', 'CLD-9');
      const onBack = vi.fn();
      render(<TicketDetailPage issueKey="PROJ-1" onBack={onBack} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Deny' }));
      const dlg = await screen.findByRole('alertdialog');
      fireEvent.keyDown(dlg, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(onBack).not.toHaveBeenCalled();
    });

    it('Restore link requires confirmation before relink', async () => {
      seed('ignored', 'CLD-9');
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Restore link to CLD-9' }));
      expect(await screen.findByRole('alertdialog')).toBeVisible();
      expect(mockInvoke.mock.calls.map((c) => c[0])).not.toContain('relink_ticket');
      await cancelConfirm();
    });

    it('Never linked: Copy opens preview without a confirmation dialog', async () => {
      seed('ignored', null);
      const startPreview = vi.fn();
      useCopyStore.setState({ startPreview } as never);
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      fireEvent.click(await screen.findByRole('button', { name: /^Copy to/ }));
      await waitFor(() => expect(startPreview).toHaveBeenCalled());
      expectNoConfirmDialog();
    });

    it('Linked ticket shows no Handled button', async () => {
      seed('copied', 'CLD-9');
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      await screen.findByRole('button', { name: 'Deny' });
      expect(screen.queryByRole('button', { name: /handled/i })).toBeNull();
    });

    it('Restore from denied focuses Dismiss', async () => {
      seed('ignored', 'CLD-9');
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      fireEvent.click(await screen.findByRole('button', { name: /^restore$/i }));
      const dismiss = await screen.findByRole('button', { name: /dismiss/i });
      await waitFor(() => expect(document.activeElement).toBe(dismiss));
      expect(useTicketStore.getState().triageMap['PROJ-1']).toEqual({
        state: 'seen',
        copiedKey: 'CLD-9',
      });
    });
  });

  describe('Phase 37.2 watch', () => {
    const seed = (
      state: 'copied' | 'ignored' | 'watched' | 'seen' | 'handled',
      key: string | null,
    ) => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'fetch_ticket_detail') return Promise.resolve(makeDetail() as never);
        return Promise.resolve(undefined as never);
      });
      useTicketStore.setState({ triageMap: { 'PROJ-1': { state, copiedKey: key } } });
    };
    const names = () =>
      screen
        .getAllByRole('button')
        .map((b) => b.textContent ?? '')
        .filter((n) => /^(Deny|Watch|Restore|Restore link to .*)$/.test(n));

    it('Linked shows Deny then Watch; Watch confirms and moves to Watched', async () => {
      seed('copied', 'C-1');
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      await screen.findByRole('button', { name: 'Watch' });
      expect(names()).toEqual(['Deny', 'Watch']);
      fireEvent.click(screen.getByRole('button', { name: 'Watch' }));
      expect(await screen.findByRole('alertdialog')).toBeVisible();
      await confirmWatch();
      const primary = await screen.findByRole('button', { name: 'Restore link to C-1' });
      await waitFor(() => expect(document.activeElement).toBe(primary));
      expect(mockInvoke).toHaveBeenCalledWith('set_triage_state', {
        ticketKey: 'PROJ-1',
        state: 'watched',
      });
      expect(names()).toEqual(['Restore link to C-1', 'Deny', 'Restore']);
    });

    it('Dismissed shows Restore link, Watch, Restore; Watch is instant', async () => {
      seed('ignored', 'C-1');
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      await screen.findByRole('button', { name: 'Watch' });
      expect(names()).toEqual(['Restore link to C-1', 'Watch', 'Restore']);
      fireEvent.click(screen.getByRole('button', { name: 'Watch' }));
      await waitFor(() =>
        expect(mockInvoke).toHaveBeenCalledWith('set_triage_state', {
          ticketKey: 'PROJ-1',
          state: 'watched',
        }),
      );
      expectNoConfirmDialog();
    });

    it('Watched with key: no Copy, no Watch, hint visible, Deny is instant', async () => {
      seed('watched', 'C-1');
      const { container } = render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      await screen.findByRole('button', { name: 'Restore link to C-1' });
      expect(names()).toEqual(['Restore link to C-1', 'Deny', 'Restore']);
      expect(screen.queryByRole('button', { name: /^Copy to/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Watch' })).toBeNull();
      expect(container.textContent).toContain('Previously linked to C-1');
      fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
      await waitFor(() =>
        expect(mockInvoke).toHaveBeenCalledWith('set_triage_state', {
          ticketKey: 'PROJ-1',
          state: 'ignored',
        }),
      );
      expectNoConfirmDialog();
    });

    it('Watched without key: primary is Copy, no hint', async () => {
      seed('watched', null);
      const { container } = render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      expect(await screen.findByRole('button', { name: /^Copy to/ })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Deny' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Restore' })).toBeVisible();
      expect(container.textContent).not.toContain('Previously linked');
    });

    it('New and Handled never show Watch', async () => {
      seed('seen', null);
      const first = render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      await screen.findByRole('button', { name: /dismiss/i });
      expect(screen.queryByRole('button', { name: 'Watch' })).toBeNull();
      first.unmount();
      seed('handled', null);
      render(<TicketDetailPage issueKey="PROJ-1" onBack={vi.fn()} />);
      await screen.findByRole('button', { name: /handled/i });
      expect(screen.queryByRole('button', { name: 'Watch' })).toBeNull();
    });
  });
});
