import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConnectionStore } from './connectionStore';
import { SetupWizard } from './SetupWizard';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

const serverSuccessResult = {
  success: true,
  username: 'jdoe',
  serverVersion: '8.20.0',
  errorKind: null,
  retryAfterSecs: null,
};

function fillServerForm() {
  const urlInput = screen.getByLabelText('Base URL');
  fireEvent.change(urlInput, { target: { value: 'https://jira.example.com' } });
  fireEvent.blur(urlInput);

  const patInput = screen.getByLabelText('Personal Access Token');
  fireEvent.change(patInput, { target: { value: 'my-pat-token' } });
}

describe('SetupWizard', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(null);
    // Reset Zustand store state between tests to prevent pollution
    act(() => {
      useConnectionStore.getState().clearConnections();
    });
  });

  it('renders Step 1 (Source Connection) initially', () => {
    render(<SetupWizard />);
    expect(screen.getByText('Source Connection')).toBeInTheDocument();
  });

  it('Next button not visible before test success', () => {
    render(<SetupWizard />);
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('Step progress shows Source as current', () => {
    render(<SetupWizard />);
    const sourceStep = screen.getByRole('listitem', {
      name: /Step 1: Source — current/i,
    });
    expect(sourceStep).toBeInTheDocument();
  });

  it('advances to Step 2 after test success and Next click', async () => {
    // First invoke call (test_jira_server_connection) returns success
    // Subsequent calls (store_credential) return null via mockResolvedValue default in beforeEach
    mockInvoke.mockResolvedValueOnce(serverSuccessResult);

    render(<SetupWizard />);
    fillServerForm();

    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

    // Wait for Next button to appear, then click it
    const nextBtn = await screen.findByRole('button', { name: 'Next' }, { timeout: 5000 });
    fireEvent.click(nextBtn);

    await waitFor(
      () => {
        expect(screen.getByText('Destination Connection')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('renders Summary step after both connections tested', async () => {
    // Pre-populate BOTH connections and start at step 3 directly
    // Testing the full flow (step 1→2, step 2→3) is covered in the individual step tests
    const serverMeta = {
      baseUrl: 'https://jira.example.com',
      username: 'jdoe',
      serverVersion: '8.20.0',
      lastTestedAt: new Date().toISOString(),
      status: 'ok' as const,
    };
    const cloudMeta = {
      baseUrl: 'https://company.atlassian.net',
      username: 'jane.doe',
      serverVersion: '1001.0.0',
      lastTestedAt: new Date().toISOString(),
      status: 'ok' as const,
    };
    act(() => {
      useConnectionStore.getState().setServerConnection(serverMeta);
      useConnectionStore.getState().setCloudConnection(cloudMeta);
    });

    render(<SetupWizard initialStep={3} />);

    await waitFor(() => {
      expect(screen.getByText('All Set')).toBeInTheDocument();
    });
  });

  it('Done button completes wizard on summary step', async () => {
    const serverMeta = {
      baseUrl: 'https://jira.example.com',
      username: 'jdoe',
      serverVersion: '8.20.0',
      lastTestedAt: new Date().toISOString(),
      status: 'ok' as const,
    };
    const cloudMeta = {
      baseUrl: 'https://company.atlassian.net',
      username: 'jane.doe',
      serverVersion: '1001.0.0',
      lastTestedAt: new Date().toISOString(),
      status: 'ok' as const,
    };
    act(() => {
      useConnectionStore.getState().setServerConnection(serverMeta);
      useConnectionStore.getState().setCloudConnection(cloudMeta);
    });

    const onComplete = vi.fn();
    render(<SetupWizard initialStep={3} onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('All Set')).toBeInTheDocument();
    });

    const doneBtn = screen.getByRole('button', { name: 'Done' });
    expect(doneBtn).toBeInTheDocument();
    fireEvent.click(doneBtn);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledOnce();
    });
  });
});
