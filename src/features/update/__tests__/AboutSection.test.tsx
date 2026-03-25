import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { AboutSection } from '../AboutSection';
import { useUpdateStore } from '../updateStore';

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('0.1.0'),
}));

import { check } from '@tauri-apps/plugin-updater';

const mockCheck = vi.mocked(check);

const initialState = {
  status: 'idle' as const,
  updateInfo: null,
  progress: 0,
  errorMessage: null,
  lastCheckedAt: null,
};

describe('AboutSection', () => {
  beforeEach(() => {
    useUpdateStore.setState(initialState);
    mockCheck.mockReset();
  });

  it('renders the app version', async () => {
    renderWithI18n(<AboutSection />);
    await waitFor(() => {
      expect(screen.getByText('0.1.0')).toBeInTheDocument();
    });
  });

  it('renders the "Check for updates" button', () => {
    renderWithI18n(<AboutSection />);
    expect(screen.getByRole('button', { name: /check for updates/i })).toBeInTheDocument();
  });

  it('clicking "Check for updates" calls check() and shows loading state', async () => {
    // check returns a promise that never resolves in this test so we can check the intermediate state
    mockCheck.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    renderWithI18n(<AboutSection />);

    const button = screen.getByRole('button', { name: /check for updates/i });
    await user.click(button);

    await waitFor(() => {
      // Button should be disabled and have aria-busy during checking
      const checkingButton = screen.getByRole('button', { name: /checking/i });
      expect(checkingButton).toHaveAttribute('aria-busy', 'true');
      expect(checkingButton).toBeDisabled();
    });
  });

  it('shows "up to date" message when store status is up-to-date', () => {
    useUpdateStore.setState({ status: 'up-to-date', lastCheckedAt: new Date().toISOString() });
    renderWithI18n(<AboutSection />);
    expect(screen.getByText(/latest version/i)).toBeInTheDocument();
  });

  it('shows error message when store status is error', () => {
    useUpdateStore.setState({
      status: 'error',
      errorMessage: 'Could not check for updates. Check your connection and try again.',
    });
    renderWithI18n(<AboutSection />);
    expect(screen.getByText(/could not check for updates/i)).toBeInTheDocument();
  });

  it('shows "update available" badge when status is available', () => {
    useUpdateStore.setState({ status: 'available', updateInfo: null });
    renderWithI18n(<AboutSection />);
    expect(screen.getByText(/update available/i)).toBeInTheDocument();
  });

  it('does NOT show "Check for updates" button when status is available', () => {
    useUpdateStore.setState({ status: 'available', updateInfo: null });
    renderWithI18n(<AboutSection />);
    expect(screen.queryByRole('button', { name: /check for updates/i })).not.toBeInTheDocument();
  });

  it('shows last checked time when lastCheckedAt is set', () => {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    useUpdateStore.setState({ status: 'idle', lastCheckedAt: oneHourAgo });
    renderWithI18n(<AboutSection />);
    // formatRelativeTime should show "1 hour ago" or similar
    expect(screen.getByText(/hour/i)).toBeInTheDocument();
  });

  it('shows "Never" when lastCheckedAt is null', () => {
    useUpdateStore.setState({ status: 'idle', lastCheckedAt: null });
    renderWithI18n(<AboutSection />);
    expect(screen.getByText(/never/i)).toBeInTheDocument();
  });

  it('shows version history link button', async () => {
    renderWithI18n(<AboutSection />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /version history/i })).toBeInTheDocument();
    });
  });

  it('clicking "Version History" opens the version history modal', async () => {
    const user = userEvent.setup();
    renderWithI18n(<AboutSection />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /version history/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /version history/i }));
    // VersionHistoryModal should open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('check for updates sets up-to-date when no update available', async () => {
    mockCheck.mockResolvedValue(null);
    const user = userEvent.setup();
    renderWithI18n(<AboutSection />);
    await user.click(screen.getByRole('button', { name: /check for updates/i }));
    await waitFor(() => {
      expect(useUpdateStore.getState().status).toBe('up-to-date');
    });
  });

  it('check for updates sets available when update found', async () => {
    // Provide a minimal mock shaped as the Update type (only fields AboutSection reads)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCheck.mockResolvedValue({
      version: '2.0.0',
      body: 'Major release',
      downloadAndInstall: vi.fn(),
    } as any);
    const user = userEvent.setup();
    renderWithI18n(<AboutSection />);
    await user.click(screen.getByRole('button', { name: /check for updates/i }));
    await waitFor(() => {
      expect(useUpdateStore.getState().status).toBe('available');
    });
  });

  it('check for updates handles "Could not fetch" error as up-to-date', async () => {
    mockCheck.mockRejectedValue(new Error('Could not fetch the release info'));
    const user = userEvent.setup();
    renderWithI18n(<AboutSection />);
    await user.click(screen.getByRole('button', { name: /check for updates/i }));
    await waitFor(() => {
      expect(useUpdateStore.getState().status).toBe('up-to-date');
    });
  });

  it('check for updates handles 404 error as up-to-date', async () => {
    mockCheck.mockRejectedValue(new Error('Request failed with status 404'));
    const user = userEvent.setup();
    renderWithI18n(<AboutSection />);
    await user.click(screen.getByRole('button', { name: /check for updates/i }));
    await waitFor(() => {
      expect(useUpdateStore.getState().status).toBe('up-to-date');
    });
  });

  it('check for updates handles Network error as up-to-date', async () => {
    mockCheck.mockRejectedValue(new Error('Network error occurred'));
    const user = userEvent.setup();
    renderWithI18n(<AboutSection />);
    await user.click(screen.getByRole('button', { name: /check for updates/i }));
    await waitFor(() => {
      expect(useUpdateStore.getState().status).toBe('up-to-date');
    });
  });

  it('check for updates handles unexpected error as error state', async () => {
    mockCheck.mockRejectedValue(new Error('Something unexpected went wrong'));
    const user = userEvent.setup();
    renderWithI18n(<AboutSection />);
    await user.click(screen.getByRole('button', { name: /check for updates/i }));
    await waitFor(() => {
      expect(useUpdateStore.getState().status).toBe('error');
    });
  });
});
