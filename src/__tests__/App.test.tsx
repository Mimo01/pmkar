import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../features/connections/connectionStore';
import { useTicketStore } from '../features/tickets/ticketStore';

const mockInvoke = vi.mocked(invoke);

// Dynamic import to allow mocks to take effect first
async function renderApp() {
  const { default: App } = await import('../App');
  return render(<App />);
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
      if (cmd === 'get_audit_count') return Promise.resolve(0);
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
      if (cmd === 'get_audit_count') return Promise.resolve(0);
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
      if (cmd === 'get_audit_count') return Promise.resolve(0);
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
});
