import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    // The shadcn Dialog has a built-in sr-only "Close" text; use getAllByText and pick visible button
    const closeButtons = screen.getAllByText('Close');
    const visibleCloseBtn = closeButtons.find((el) => !el.classList.contains('sr-only'));
    fireEvent.click(visibleCloseBtn!);

    // reset is called after get_triage_state resolves (in finally)
    await vi.waitFor(() => {
      expect(mockReset).toHaveBeenCalledOnce();
    });
  });

  it('shows attachment step label with filename on success (COPY-02)', () => {
    mockStoreState({
      result: {
        ...allSuccessResult,
        steps: [
          ...allSuccessResult.steps,
          { step: 'attach:screenshot.png', success: true, detail: null },
        ],
      },
    });
    render(<CopyResultModal />);
    expect(screen.getByText(/screenshot\.png/)).toBeInTheDocument();
    expect(screen.getByText(/attached/)).toBeInTheDocument();
  });

  it('shows attachment step label with failure reason (COPY-02, D-06)', () => {
    mockStoreState({
      result: {
        ...allSuccessResult,
        steps: [
          ...allSuccessResult.steps,
          { step: 'attach:database-dump.sql', success: false, detail: '413 too large' },
        ],
      },
    });
    render(<CopyResultModal />);
    expect(screen.getByText(/database-dump\.sql/)).toBeInTheDocument();
    // detail text appears in both the stepLabel span and the detail paragraph
    expect(screen.getAllByText(/413 too large/).length).toBeGreaterThan(0);
  });

  it('shows comment step label with number on success (COPY-03)', () => {
    mockStoreState({
      result: {
        ...allSuccessResult,
        steps: [
          ...allSuccessResult.steps,
          { step: 'comment:1', success: true, detail: null },
          { step: 'comment:2', success: true, detail: null },
        ],
      },
    });
    render(<CopyResultModal />);
    expect(screen.getByText('Comment 1 copied')).toBeInTheDocument();
    expect(screen.getByText('Comment 2 copied')).toBeInTheDocument();
  });

  it('shows worklog step label on success (COPY-04)', () => {
    mockStoreState({
      result: {
        ...allSuccessResult,
        steps: [...allSuccessResult.steps, { step: 'worklog:1', success: true, detail: null }],
      },
    });
    render(<CopyResultModal />);
    expect(screen.getByText('Work log entry 1 copied')).toBeInTheDocument();
  });

  it('shows subtask step label with source key on success (COPY-05)', () => {
    mockStoreState({
      result: {
        ...allSuccessResult,
        steps: [
          ...allSuccessResult.steps,
          { step: 'subtask:CUST-101', success: true, detail: 'Created as PROJ-43' },
        ],
      },
    });
    render(<CopyResultModal />);
    expect(screen.getByText(/Sub-task CUST-101/)).toBeInTheDocument();
    expect(screen.getByText(/Created as PROJ-43/)).toBeInTheDocument();
  });

  it('shows subtask step label with failure detail (COPY-05)', () => {
    mockStoreState({
      result: {
        ...allSuccessResult,
        steps: [
          ...allSuccessResult.steps,
          { step: 'subtask:CUST-102', success: false, detail: 'Sub-task creation returned 400' },
        ],
      },
    });
    render(<CopyResultModal />);
    expect(screen.getByText(/Sub-task CUST-102/)).toBeInTheDocument();
    expect(screen.getAllByText(/400/).length).toBeGreaterThan(0);
  });

  it('shows partial failure title when attachment fails but create_issue succeeds (COPY-02)', () => {
    mockStoreState({
      result: {
        targetKey: 'MYCO-42',
        targetUrl: 'https://company.jira.example.com/browse/MYCO-42',
        steps: [
          { step: 'create_issue', success: true, detail: 'MYCO-42' },
          { step: 'attach:big-file.zip', success: false, detail: '413 too large' },
        ],
      },
    });
    render(<CopyResultModal />);
    expect(screen.getByText('Copy Finished with Errors')).toBeInTheDocument();
    // Should still show Open in Company Jira since create_issue succeeded
    expect(screen.getByText('Open in Company Jira')).toBeInTheDocument();
  });
});
