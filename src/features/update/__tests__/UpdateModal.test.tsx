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

  it('shows installing state text when status is installing', () => {
    useUpdateStore.setState({ status: 'installing', updateInfo: mockUpdateInfo, progress: 100 });
    renderWithI18n(<UpdateModal open={true} />);
    // Progress bar should exist
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    // Installing text
    expect(screen.getByText(/installing/i)).toBeInTheDocument();
  });

  it('shows "Try Again" button when status is error', () => {
    useUpdateStore.setState({
      status: 'error',
      updateInfo: mockUpdateInfo,
      errorMessage: 'Download failed',
    });
    renderWithI18n(<UpdateModal open={true} />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows error message text when status is error', () => {
    useUpdateStore.setState({
      status: 'error',
      updateInfo: mockUpdateInfo,
      errorMessage: 'Could not download the update',
    });
    renderWithI18n(<UpdateModal open={true} />);
    expect(screen.getByText('Could not download the update')).toBeInTheDocument();
  });

  it('"Try Again" button is enabled when status is error (not downloading/installing)', async () => {
    useUpdateStore.setState({
      status: 'error',
      updateInfo: mockUpdateInfo,
      errorMessage: 'Failed',
    });
    const user = userEvent.setup();
    renderWithI18n(<UpdateModal open={true} />);
    const tryAgainBtn = screen.getByRole('button', { name: /try again/i });
    expect(tryAgainBtn).not.toBeDisabled();
    // Click should not throw
    await user.click(tryAgainBtn);
  });

  it('dialog subtitle shows version number from updateInfo', () => {
    useUpdateStore.setState({ status: 'available', updateInfo: mockUpdateInfo });
    renderWithI18n(<UpdateModal open={true} />);
    expect(screen.getByText(/1\.2\.3/)).toBeInTheDocument();
  });

  it('does not show changelog when status is downloading', () => {
    useUpdateStore.setState({ status: 'downloading', updateInfo: mockUpdateInfo, progress: 30 });
    renderWithI18n(<UpdateModal open={true} />);
    // Changelog ScrollArea not rendered in downloading state
    expect(screen.queryByText('Bug fixes and performance improvements')).not.toBeInTheDocument();
  });

  it('"Later" button is disabled during installing state', () => {
    useUpdateStore.setState({ status: 'installing', updateInfo: mockUpdateInfo, progress: 100 });
    renderWithI18n(<UpdateModal open={true} />);
    const laterBtn = screen.getByRole('button', { name: /later/i });
    expect(laterBtn).toBeDisabled();
  });
});
