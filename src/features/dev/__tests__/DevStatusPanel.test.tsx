import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { DevStatusPanel } from '../DevStatusPanel';

const mockInvoke = vi.mocked(invoke);

describe('DevStatusPanel', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders heading and description', async () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));
    render(<DevStatusPanel />);
    expect(screen.getByText('pmkar')).toBeInTheDocument();
    expect(screen.getByText('Development scaffold')).toBeInTheDocument();
  });

  it('shows loading status for all badges initially', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));
    render(<DevStatusPanel />);
    // Three status badges all start loading
    const statusBadges = screen.getAllByRole('status');
    expect(statusBadges.length).toBe(3);
  });

  it('shows healthy status for both mock servers when ping succeeds', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'ping_mock_servers') {
        return Promise.resolve({ server_v2: true, cloud_v3: true });
      }
      if (cmd === 'ping_keychain') {
        return Promise.resolve(true);
      }
      return Promise.resolve(null);
    });
    render(<DevStatusPanel />);

    await waitFor(() => {
      const runningTexts = screen.getAllByText('Running');
      expect(runningTexts.length).toBe(3);
    });
  });

  it('shows error status when mock servers are unreachable', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'ping_mock_servers') {
        return Promise.resolve({ server_v2: false, cloud_v3: false });
      }
      if (cmd === 'ping_keychain') {
        return Promise.resolve(true);
      }
      return Promise.resolve(null);
    });
    render(<DevStatusPanel />);

    await waitFor(() => {
      expect(screen.getByText('Port 8080 unreachable')).toBeInTheDocument();
      expect(screen.getByText('Port 8081 unreachable')).toBeInTheDocument();
    });
  });

  it('shows keychain error when ping_keychain fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'ping_mock_servers') {
        return Promise.resolve({ server_v2: true, cloud_v3: true });
      }
      if (cmd === 'ping_keychain') {
        return Promise.reject(new Error('Keychain unavailable'));
      }
      return Promise.resolve(null);
    });
    render(<DevStatusPanel />);

    await waitFor(() => {
      expect(screen.getByText('Keychain unavailable')).toBeInTheDocument();
    });
  });

  it('shows error status when ping_mock_servers throws', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'ping_mock_servers') {
        return Promise.reject(new Error('Connection refused'));
      }
      if (cmd === 'ping_keychain') {
        return Promise.resolve(true);
      }
      return Promise.resolve(null);
    });
    render(<DevStatusPanel />);

    await waitFor(() => {
      expect(screen.getByText('Port 8080 unreachable')).toBeInTheDocument();
      expect(screen.getByText('Port 8081 unreachable')).toBeInTheDocument();
    });
  });
});
