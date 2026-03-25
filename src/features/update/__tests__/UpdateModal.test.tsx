import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { UpdateModal } from '../UpdateModal';
import { useUpdateStore } from '../updateStore';

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

const mockRawUpdate = {
  version: '1.2.3',
  downloadAndInstall: vi.fn(),
};

const mockUpdateInfo = {
  version: '1.2.3',
  body: 'Bug fixes and performance improvements',
  rawUpdate: mockRawUpdate,
};

const initialState = {
  status: 'idle' as const,
  updateInfo: null,
  progress: 0,
  errorMessage: null,
  lastCheckedAt: null,
};

describe('UpdateModal', () => {
  beforeEach(() => {
    useUpdateStore.setState(initialState);
    mockRawUpdate.downloadAndInstall.mockReset();
  });

  it('renders the modal when open=true with store status=available', () => {
    useUpdateStore.setState({ status: 'available', updateInfo: mockUpdateInfo });
    renderWithI18n(<UpdateModal open={true} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/update available/i)).toBeInTheDocument();
  });

  it('shows changelog text from the store', () => {
    useUpdateStore.setState({ status: 'available', updateInfo: mockUpdateInfo });
    renderWithI18n(<UpdateModal open={true} />);
    expect(screen.getByText('Bug fixes and performance improvements')).toBeInTheDocument();
  });

  it('shows Update Now and Later buttons when status is available', () => {
    useUpdateStore.setState({ status: 'available', updateInfo: mockUpdateInfo });
    renderWithI18n(<UpdateModal open={true} />);
    expect(screen.getByRole('button', { name: /update now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /later/i })).toBeInTheDocument();
  });

  it('"Later" button calls dismiss()', async () => {
    useUpdateStore.setState({ status: 'available', updateInfo: mockUpdateInfo });
    const user = userEvent.setup();
    renderWithI18n(<UpdateModal open={true} />);

    const laterBtn = screen.getByRole('button', { name: /later/i });
    await user.click(laterBtn);

    expect(useUpdateStore.getState().status).toBe('idle');
  });

  it('shows progress bar and disables buttons when status is downloading', () => {
    useUpdateStore.setState({ status: 'downloading', updateInfo: mockUpdateInfo, progress: 45 });
    renderWithI18n(<UpdateModal open={true} />);

    // Progress bar should be present
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Buttons should be disabled
    expect(screen.getByRole('button', { name: /update now/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /later/i })).toBeDisabled();
  });

  it('shows "No release notes available" when body is null', () => {
    useUpdateStore.setState({
      status: 'available',
      updateInfo: { ...mockUpdateInfo, body: null },
    });
    renderWithI18n(<UpdateModal open={true} />);
    expect(screen.getByText(/no release notes available/i)).toBeInTheDocument();
  });
});
