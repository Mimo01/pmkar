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
});
