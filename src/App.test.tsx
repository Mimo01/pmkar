import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { useConnectionStore } from './features/connections/connectionStore';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === 'ping_mock_servers') return Promise.resolve({ server_v2: true, cloud_v3: true });
    if (cmd === 'ping_keychain') return Promise.resolve(true);
    if (cmd === 'get_triage_state') return Promise.resolve({});
    if (cmd === 'get_fetch_config')
      return Promise.resolve({
        jqlPreset: 'assigned',
        jqlCustom: null,
        watchedUsers: [],
        lastFetchedAt: null,
      });
    if (cmd === 'get_all_connection_meta') return Promise.resolve([]);
    return Promise.resolve(null);
  }),
}));

function setupConnections() {
  useConnectionStore.setState({
    serverConnection: {
      baseUrl: 'http://localhost:8080',
      username: 'admin',
      serverVersion: '8.0',
      lastTestedAt: new Date().toISOString(),
      status: 'ok' as const,
    },
    cloudConnection: {
      baseUrl: 'http://localhost:8081',
      username: 'admin',
      serverVersion: '1000',
      lastTestedAt: new Date().toISOString(),
      status: 'ok' as const,
    },
  });
}

describe('App', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      serverConnection: null,
      cloudConnection: null,
    });
  });

  it('renders main view when setup is complete', async () => {
    setupConnections();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Fetch Tickets')).toBeInTheDocument();
    });
  });

  it('renders Fetch Tickets button when setup is complete', async () => {
    setupConnections();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Fetch Tickets')).toBeInTheDocument();
    });
    expect(screen.getByText('Not yet fetched')).toBeInTheDocument();
  });

  it('renders error boundary fallback text', async () => {
    setupConnections();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Fetch Tickets')).toBeInTheDocument();
    });
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
