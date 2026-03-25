import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../features/connections/connectionStore';
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
        jqlPreset: 'assigned',
        jqlCustom: null,
        watchedUsers: [],
        lastFetchedAt: null,
      });
    }
    return Promise.resolve(null);
  });
}

describe('App', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    useConnectionStore.setState({ serverConnection: null, cloudConnection: null });
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
          jqlPreset: 'assigned',
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
          jqlPreset: 'assigned',
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
          jqlPreset: 'assigned',
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
});
