import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CopyResultModal } from './CopyResultModal';

const mockReset = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }));

vi.mock('./copyStore', () => ({
  useCopyStore: vi.fn(),
}));

vi.mock('./ticketStore', () => ({
  useTicketStore: Object.assign(vi.fn(), {
    getState: () => ({
      hydrateTriageMap: vi.fn(),
    }),
  }),
}));

import { useCopyStore } from './copyStore';

const allSuccessResult = {
  targetKey: 'MYCO-42',
  targetUrl: 'https://company.jira.example.com/browse/MYCO-42',
  steps: [
    { step: 'create_issue', success: true, detail: 'MYCO-42' },
    { step: 'convert_description', success: true, detail: null },
    { step: 'add_remote_link', success: true, detail: null },
  ],
};

function mockStoreState(overrides: Record<string, unknown> = {}) {
  (useCopyStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    phase: 'result',
    result: allSuccessResult,
    reset: mockReset,
    ...overrides,
  });
}

describe('CopyResultModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: resolve get_triage_state immediately
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_triage_state') return Promise.resolve({});
      return Promise.resolve(null);
    });
  });

  it('renders checkmark icon for successful steps', () => {
    mockStoreState();
    render(<CopyResultModal />);

    // All steps succeed — should have emerald-400 SVG checkmarks
    const svgs = document.querySelectorAll('svg.text-emerald-400');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders X icon for failed steps', () => {
    mockStoreState({
      result: {
        ...allSuccessResult,
        steps: [
          { step: 'create_issue', success: true, detail: 'MYCO-42' },
          { step: 'convert_description', success: false, detail: 'Conversion error' },
        ],
      },
    });
    render(<CopyResultModal />);

    const xSvgs = document.querySelectorAll('svg.text-red-400');
    expect(xSvgs.length).toBe(1);
  });

  it('shows "Copy Complete" when all steps pass', () => {
    mockStoreState();
    render(<CopyResultModal />);

    expect(screen.getByText('Copy Complete')).toBeInTheDocument();
  });

  it('shows "Copy Finished with Errors" on partial failure', () => {
    mockStoreState({
      result: {
        ...allSuccessResult,
        steps: [
          { step: 'create_issue', success: true, detail: 'MYCO-42' },
          { step: 'add_remote_link', success: false, detail: 'Could not add link' },
        ],
      },
    });
    render(<CopyResultModal />);

    expect(screen.getByText('Copy Finished with Errors')).toBeInTheDocument();
  });

  it('shows "Open in Company Jira" when create_issue succeeded', () => {
    mockStoreState();
    render(<CopyResultModal />);

    const openBtn = screen.getByText('Open in Company Jira');
    expect(openBtn).toBeInTheDocument();

    fireEvent.click(openBtn);

    expect(mockInvoke).toHaveBeenCalledWith('open_external_url', {
      url: 'https://company.jira.example.com/browse/MYCO-42',
    });
  });

  it('Close button calls reset', async () => {
    mockStoreState();
    render(<CopyResultModal />);

    fireEvent.click(screen.getByText('Close'));

    // reset is called after get_triage_state resolves (in finally)
    await vi.waitFor(() => {
      expect(mockReset).toHaveBeenCalledOnce();
    });
  });
});
