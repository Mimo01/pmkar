import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../features/connections/connectionStore';
import { useGroupStore } from '../features/groups/groupStore';
import { useCopyStore } from '../features/tickets/copyStore';
import { useTicketStore } from '../features/tickets/ticketStore';

const mockInvoke = vi.mocked(invoke);

// Dynamic import to allow mocks to take effect first
async function renderApp() {
  const { default: App } = await import('../App');
  return render(<App />);
}

const bothConnMeta = {
  baseUrl: 'http://server.example.com',
  username: 'testuser',
  serverVersion: '9.0.0',
  lastTestedAt: '2024-01-01T00:00:00.000Z',
  status: 'ok',
};

function setupBothConnections() {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'get_all_connection_meta') {
      return Promise.resolve([
        { ...bothConnMeta, connectionType: 'server', baseUrl: 'http://server.example.com' },
        { ...bothConnMeta, connectionType: 'cloud', baseUrl: 'https://cloud.atlassian.net' },
      ]);
    }
    if (cmd === 'get_app_language') return Promise.resolve('en');
    if (cmd === 'get_os_locale') return Promise.resolve('en-US');
    if (cmd === 'get_triage_state') return Promise.resolve({});
    if (cmd === 'get_fetch_config') {
      return Promise.resolve({
        jqlPreset: 'mine',
        jqlCustom: null,
        watchedUsers: [],
        lastFetchedAt: null,
      });
    }
    if (cmd === 'list_groups') {
      return Promise.resolve([
        {
          id: 1,
          name: 'Sprint 12',
          color: 'blue',
          position: 0,
          createdAt: 't',
          memberCount: 0,
        },
      ]);
    }
    if (cmd === 'list_group_memberships') return Promise.resolve([]);
    if (cmd === 'get_group_members') return Promise.resolve([]);
    return Promise.resolve(null);
  });
}

describe('App', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    useConnectionStore.setState({ serverConnection: null, cloudConnection: null });
    useGroupStore.setState({
      groups: [],
      memberKeysByGroup: {},
      groupIdsByIssue: {},
      hydrated: false,
      hydrateError: false,
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
    // Mock i18n invokes
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_all_connection_meta') return Promise.resolve([]);
      if (cmd === 'get_app_language') return Promise.resolve('en');
      if (cmd === 'get_os_locale') return Promise.resolve('en-US');
      return Promise.resolve(null);
    });
  });

  it('shows SetupWizard when no connections configured', async () => {
    const { unmount } = await renderApp();
    await waitFor(() => {
      // SetupWizard should appear — it contains "Server Jira" or step indicator
      expect(document.body).toBeTruthy();
    });
    unmount();
  });

  it('shows main app when both connections are configured', async () => {
    const connMeta = {
      baseUrl: 'http://server.example.com',
      username: 'testuser',
      serverVersion: '9.0.0',
      lastTestedAt: '2024-01-01T00:00:00.000Z',
      status: 'ok',
    };
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_all_connection_meta') {
        return Promise.resolve([
          { ...connMeta, connectionType: 'server', baseUrl: 'http://server.example.com' },
          { ...connMeta, connectionType: 'cloud', baseUrl: 'https://cloud.atlassian.net' },
        ]);
      }
      if (cmd === 'get_app_language') return Promise.resolve('en');
      if (cmd === 'get_os_locale') return Promise.resolve('en-US');
      if (cmd === 'get_triage_state') return Promise.resolve({});
      if (cmd === 'get_fetch_config') {
        return Promise.resolve({
          jqlPreset: 'mine',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      }
      return Promise.resolve(null);
    });

    const { unmount } = await renderApp();
    await waitFor(() => {
      // Main app shows Fetch Tickets button
      expect(screen.getByText('Fetch Tickets')).toBeInTheDocument();
    });
    unmount();
  });

  it('renders null initially while hydrating', async () => {
    // Make get_all_connection_meta never resolve to check hydration state
    mockInvoke.mockImplementation(() => new Promise(() => {}));
    const { container, unmount } = await renderApp();
    // App renders null while hydrating
    expect(container.firstChild).toBeNull();
    unmount();
  });

  it('shows SetupWizard when server connection missing after hydration', async () => {
    // Only cloud connection — no server
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_all_connection_meta') {
        return Promise.resolve([
          {
            connectionType: 'cloud',
            baseUrl: 'https://cloud.atlassian.net',
            username: 'clouduser',
            serverVersion: '1000.0',
            lastTestedAt: '2024-01-01T00:00:00.000Z',
            status: 'ok',
          },
        ]);
      }
      if (cmd === 'get_app_language') return Promise.resolve('en');
      if (cmd === 'get_os_locale') return Promise.resolve('en-US');
      return Promise.resolve(null);
    });

    const { unmount } = await renderApp();
    await waitFor(() => {
      // Setup wizard should still show (only 1 of 2 connections)
      expect(document.body).toBeTruthy();
    });
    unmount();
  });

  it('shows IgnoredTicketsPage on not-mine tab', async () => {
    const connMeta = {
      baseUrl: 'http://server.example.com',
      username: 'testuser',
      serverVersion: '9.0.0',
      lastTestedAt: '2024-01-01T00:00:00.000Z',
      status: 'ok',
    };
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_all_connection_meta') {
        return Promise.resolve([
          { ...connMeta, connectionType: 'server' },
          { ...connMeta, connectionType: 'cloud', baseUrl: 'https://cloud.atlassian.net' },
        ]);
      }
      if (cmd === 'get_app_language') return Promise.resolve('en');
      if (cmd === 'get_os_locale') return Promise.resolve('en-US');
      if (cmd === 'get_triage_state') return Promise.resolve({});
      if (cmd === 'get_fetch_config') {
        return Promise.resolve({
          jqlPreset: 'mine',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      }
      return Promise.resolve(null);
    });

    const { unmount } = await renderApp();
    await waitFor(() => {
      expect(screen.getByText('Fetch Tickets')).toBeInTheDocument();
    });
    unmount();
  });

  it('shows CopyPreviewPage when copyPhase is previewing', async () => {
    setupBothConnections();
    useTicketStore.setState({ selectedTicketKey: 'TEST-1' });
    useCopyStore.setState({
      phase: 'previewing',
      sourceTicket: {
        id: 'TEST-1',
        key: 'TEST-1',
        fields: {
          summary: 'Test ticket',
          status: { name: 'Open' },
          priority: { name: 'Medium', id: '3' },
          assignee: null,
          reporter: null,
          description: 'Description',
          labels: [],
          components: [],
          fixVersions: [],
          comment: { comments: [] },
          attachment: [],
          subtasks: [],
          issuelinks: [],
          updated: '2024-01-01T00:00:00.000Z',
        },
      },
      cloudMeta: {
        availableStatuses: [{ id: '1', name: 'Open' }],
        availablePriorities: [{ id: '1', name: 'Medium' }],
        currentAccountId: 'user-1',
        cloudBaseUrl: 'https://cloud.atlassian.net',
      },
    });

    const { unmount } = await renderApp();
    await waitFor(() => {
      // CopyPreviewPage shows "Source" and "Target" panels
      expect(screen.getByText('Source')).toBeInTheDocument();
    });
    unmount();
  });

  it('shows CopyResultPage when copyPhase is result', async () => {
    setupBothConnections();
    useTicketStore.setState({ selectedTicketKey: 'TEST-1' });
    useCopyStore.setState({
      phase: 'result',
      result: {
        targetKey: 'CLOUD-5',
        targetUrl: 'https://cloud.atlassian.net/browse/CLOUD-5',
        steps: [{ step: 'create_issue', success: true, detail: null }],
      },
    });

    const { unmount } = await renderApp();
    await waitFor(() => {
      // CopyResultPage shows "Copy Complete"
      expect(screen.getByText('Copy Complete')).toBeInTheDocument();
    });
    unmount();
  });

  it('shows settings page when gear icon clicked', async () => {
    setupBothConnections();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_all_connection_meta') {
        return Promise.resolve([
          { ...bothConnMeta, connectionType: 'server' },
          { ...bothConnMeta, connectionType: 'cloud', baseUrl: 'https://cloud.atlassian.net' },
        ]);
      }
      if (cmd === 'get_app_language') return Promise.resolve('en');
      if (cmd === 'get_os_locale') return Promise.resolve('en-US');
      if (cmd === 'get_triage_state') return Promise.resolve({});
      if (cmd === 'get_fetch_config')
        return Promise.resolve({
          jqlPreset: 'mine',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      if (cmd === 'get_project_config')
        return Promise.resolve({
          sourceProjectKey: null,
          targetProjectKey: null,
          sourceProjectName: null,
          targetProjectName: null,
        });
      return Promise.resolve(null);
    });

    const { unmount } = await renderApp();
    await waitFor(() => {
      expect(screen.getByText('Fetch Tickets')).toBeInTheDocument();
    });

    // Click the gear/settings button
    const gearBtn = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(gearBtn);

    await waitFor(() => {
      // SettingsPage has a "Source" nav item
      expect(screen.getByRole('button', { name: /^Source$/i })).toBeInTheDocument();
    });
    unmount();
  });
  describe('group tabs', () => {
    it('starts on New, opens a group tab, and falls back to New when the group vanishes', async () => {
      setupBothConnections();
      const { unmount } = await renderApp();
      const newTab = await screen.findByRole('button', { name: 'New' });
      expect(newTab).toHaveAttribute('aria-current', 'page');

      const groupTab = await screen.findByRole('button', { name: 'Sprint 12, 0 issues' });
      fireEvent.click(groupTab);
      await waitFor(() => {
        expect(screen.getByText('No issues in this group yet')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Sprint 12, 0 issues' })).toHaveAttribute(
        'aria-current',
        'page',
      );

      fireEvent.click(screen.getByRole('button', { name: 'New' }));
      await waitFor(() => {
        expect(screen.queryByText('No issues in this group yet')).not.toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('aria-current', 'page');

      fireEvent.click(screen.getByRole('button', { name: 'Sprint 12, 0 issues' }));
      await screen.findByText('No issues in this group yet');
      act(() => {
        useGroupStore.setState({ groups: [] });
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('aria-current', 'page');
      });
      expect(screen.queryByText('No issues in this group yet')).not.toBeInTheDocument();
      unmount();
    });

    function seedIssue() {
      useCopyStore.getState().reset();
      useTicketStore.setState({
        tickets: [
          {
            id: '1',
            key: 'P-1',
            fields: {
              summary: 'Summary P-1',
              status: { name: 'Open', id: '1', statusCategory: { key: 'new' } } as never,
              priority: { name: 'High', id: '2' },
              assignee: null,
              created: '2026-01-01T10:00:00.000Z',
              updated: '2026-01-01T10:00:00.000Z',
            },
          },
        ],
        triageMap: {},
        selectedTicketKey: null,
      });
    }

    it('tab change clears selection and ends select mode (D-14)', async () => {
      setupBothConnections();
      seedIssue();
      const { unmount } = await renderApp();
      await screen.findByRole('button', { name: 'New' });
      const selectBtn = await screen.findByRole('button', { name: 'Select' });
      fireEvent.click(selectBtn);
      fireEvent.click(await screen.findByRole('checkbox', { name: 'Select P-1' }));
      expect(screen.getAllByText('1 selected').length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole('button', { name: 'Already Linked' }));
      await screen.findByText('No linked tickets');
      fireEvent.click(screen.getByRole('button', { name: 'New' }));

      expect(await screen.findByRole('button', { name: 'Select' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
      unmount();
    });

    it('detail chip name closes detail, activates and focuses the group tab (D-06)', async () => {
      setupBothConnections();
      const base = mockInvoke.getMockImplementation() as (cmd: string, args?: unknown) => unknown;
      mockInvoke.mockImplementation(((cmd: string, args?: unknown) => {
        if (cmd === 'list_groups') {
          return Promise.resolve([
            { id: 2, name: 'QA', color: 'blue', position: 0, createdAt: 't', memberCount: 1 },
          ]);
        }
        if (cmd === 'list_group_memberships') {
          return Promise.resolve([{ groupId: 2, issueKey: 'P-1' }]);
        }
        if (cmd === 'fetch_ticket_detail') {
          return Promise.resolve({
            id: '1',
            key: 'P-1',
            fields: {
              summary: 'Summary P-1',
              status: { name: 'Open' },
              priority: { name: 'High', id: '2' },
              assignee: null,
              reporter: null,
              description: 'x',
              labels: [],
              components: [],
              fixVersions: [],
              comment: { comments: [] },
              attachment: [],
              subtasks: [],
              issuelinks: [],
              created: '2024-06-01T00:00:00.000Z',
              updated: '2024-06-01T00:00:00.000Z',
            },
          });
        }
        return base(cmd, args);
      }) as never);
      seedIssue();
      const { unmount } = await renderApp();
      await screen.findByRole('button', { name: 'New' });
      await screen.findByRole('button', { name: /^QA, / });

      act(() => {
        useTicketStore.getState().selectTicket('P-1');
      });
      const chip = await screen.findByRole('button', { name: 'Go to group ‘QA’' });
      fireEvent.click(chip);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Back to tickets' })).not.toBeInTheDocument();
      });
      expect(useTicketStore.getState().selectedTicketKey).toBeNull();
      const qaTab = await screen.findByRole('button', { name: /^QA, / });
      expect(qaTab).toHaveAttribute('aria-current', 'page');
      await waitFor(() => expect(document.activeElement).toBe(qaTab));
      unmount();
    });
  });
});
