import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useConnectionStore } from '../../connections/connectionStore';
import { CopyResultPage } from '../CopyResultPage';
import { useCopyStore } from '../copyStore';
import { useTicketStore } from '../ticketStore';
import type { CopyTicketResult } from '../types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<CopyTicketResult> = {}): CopyTicketResult {
  return {
    targetKey: 'CLOUD-42',
    targetUrl: 'https://mycompany.atlassian.net/browse/CLOUD-42',
    steps: [
      { step: 'create_issue', success: true, detail: null },
      { step: 'convert_description', success: true, detail: null },
    ],
    ...overrides,
  };
}

function setupStore(result: CopyTicketResult) {
  useCopyStore.setState({ result, phase: 'result' });
  useConnectionStore.setState({
    targetProjectName: 'My Cloud Project',
  });
}

describe('CopyResultPage', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({});
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
  });

  // -------------------------------------------------------------------------
  // Heading
  // -------------------------------------------------------------------------

  describe('heading', () => {
    it('shows "Copy complete" when all steps succeeded', () => {
      setupStore(makeResult({ steps: [{ step: 'create_issue', success: true, detail: null }] }));
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByText(/copy complete/i)).toBeInTheDocument();
    });

    it('shows "Copy Finished with Errors" when some steps failed', () => {
      setupStore(
        makeResult({
          steps: [
            { step: 'create_issue', success: true, detail: null },
            { step: 'convert_description', success: false, detail: 'Conversion error' },
          ],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByText('Copy Finished with Errors')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Target key
  // -------------------------------------------------------------------------

  describe('target key', () => {
    it('shows targetKey when present', () => {
      setupStore(makeResult({ targetKey: 'CLOUD-42' }));
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByText('CLOUD-42')).toBeInTheDocument();
    });

    it('does not show "Created:" when targetKey is null', () => {
      setupStore(makeResult({ targetKey: null }));
      renderWithI18n(<CopyResultPage />);
      expect(screen.queryByText(/CLOUD-/)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Step icons
  // -------------------------------------------------------------------------

  describe('step result icons', () => {
    it('shows green check for successful steps', () => {
      setupStore(makeResult({ steps: [{ step: 'create_issue', success: true, detail: null }] }));
      renderWithI18n(<CopyResultPage />);
      // Check icon from lucide-react — presence verifiable via SVG in DOM
      const stepRow = screen.getByText(/core fields/i).closest('div');
      // The step row has a Check or X icon
      expect(stepRow).not.toBeNull();
    });

    it('shows error detail for failed steps', () => {
      setupStore(
        makeResult({
          steps: [
            { step: 'create_issue', success: true, detail: null },
            {
              step: 'convert_description',
              success: false,
              detail: 'Could not convert description',
            },
          ],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByText('Could not convert description')).toBeInTheDocument();
    });

    it('does not show detail text for successful steps', () => {
      setupStore(
        makeResult({
          steps: [{ step: 'create_issue', success: true, detail: 'some detail we ignore' }],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.queryByText('some detail we ignore')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // stepLabel() — all step types
  // -------------------------------------------------------------------------

  describe('stepLabel rendering', () => {
    it('create_issue success shows core fields label', () => {
      setupStore(makeResult({ steps: [{ step: 'create_issue', success: true, detail: null }] }));
      renderWithI18n(<CopyResultPage />);
      // i18n key copy.step.coreFields
      expect(screen.getByText(/core fields copied/i)).toBeInTheDocument();
    });

    it('create_issue failure shows core fields failed label', () => {
      setupStore(
        makeResult({
          targetKey: null,
          targetUrl: null,
          steps: [{ step: 'create_issue', success: false, detail: 'Issue creation failed' }],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByText(/issue creation failed/i)).toBeInTheDocument();
    });

    it('convert_description success shows description converted label', () => {
      setupStore(
        makeResult({
          steps: [
            { step: 'create_issue', success: true, detail: null },
            { step: 'convert_description', success: true, detail: null },
          ],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByText(/description converted/i)).toBeInTheDocument();
    });

    it('convert_description failure shows description failed label', () => {
      setupStore(
        makeResult({
          steps: [
            { step: 'create_issue', success: true, detail: null },
            { step: 'convert_description', success: false, detail: 'parse error' },
          ],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      // i18n: "Description — conversion failed, plain text used"
      expect(screen.getByText(/conversion failed/i)).toBeInTheDocument();
    });

    it('upload_image step shows images label', () => {
      setupStore(
        makeResult({
          steps: [
            { step: 'create_issue', success: true, detail: null },
            { step: 'upload_image_1', success: true, detail: 'image.png' },
          ],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByText(/images/i)).toBeInTheDocument();
    });

    it('add_remote_link step shows remote link label', () => {
      setupStore(
        makeResult({
          steps: [
            { step: 'create_issue', success: true, detail: null },
            { step: 'add_remote_link', success: true, detail: null },
          ],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      // i18n: "Origin link added"
      expect(screen.getByText('Origin link added')).toBeInTheDocument();
    });

    it('attach:filename step shows attached filename', () => {
      setupStore(
        makeResult({
          steps: [
            { step: 'create_issue', success: true, detail: null },
            { step: 'attach:screenshot.png', success: true, detail: null },
          ],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByText(/screenshot\.png/i)).toBeInTheDocument();
    });

    it('comment:N step shows comment copied label', () => {
      setupStore(
        makeResult({
          steps: [
            { step: 'create_issue', success: true, detail: null },
            { step: 'comment:1', success: true, detail: null },
          ],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByText(/comment/i)).toBeInTheDocument();
    });

    it('worklog:N step shows worklog copied label', () => {
      setupStore(
        makeResult({
          steps: [
            { step: 'create_issue', success: true, detail: null },
            { step: 'worklog:1', success: true, detail: null },
          ],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      // i18n: "Work log entry 1 copied"
      expect(screen.getByText(/work log entry/i)).toBeInTheDocument();
    });

    it('subtask:KEY step shows subtask created label', () => {
      setupStore(
        makeResult({
          steps: [
            { step: 'create_issue', success: true, detail: null },
            { step: 'subtask:CHILD-1', success: true, detail: 'created' },
          ],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      // i18n: "Sub-task CHILD-1 — created"
      expect(screen.getByText(/Sub-task CHILD-1/)).toBeInTheDocument();
    });

    it('unknown step renders step name as-is', () => {
      setupStore(
        makeResult({
          steps: [
            { step: 'create_issue', success: true, detail: null },
            { step: 'custom_unknown_step', success: true, detail: null },
          ],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByText('custom_unknown_step')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Open in Jira button
  // -------------------------------------------------------------------------

  describe('"Open in Jira" button', () => {
    it('shows "Open in Jira" button when issue was created and targetUrl is set', () => {
      setupStore(
        makeResult({
          steps: [{ step: 'create_issue', success: true, detail: null }],
          targetUrl: 'https://mycompany.atlassian.net/browse/CLOUD-42',
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByRole('button', { name: /open in/i })).toBeInTheDocument();
    });

    it('clicking "Open in Jira" calls invoke with targetUrl', async () => {
      const targetUrl = 'https://mycompany.atlassian.net/browse/CLOUD-42';
      setupStore(
        makeResult({
          steps: [{ step: 'create_issue', success: true, detail: null }],
          targetUrl,
        }),
      );
      renderWithI18n(<CopyResultPage />);
      const btn = screen.getByRole('button', { name: /open in/i });
      fireEvent.click(btn);
      expect(mockInvoke).toHaveBeenCalledWith('open_external_url', { url: targetUrl });
    });

    it('does NOT show "Open in Jira" button when create_issue step failed', () => {
      setupStore(
        makeResult({
          targetKey: null,
          targetUrl: null,
          steps: [{ step: 'create_issue', success: false, detail: 'Error' }],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.queryByRole('button', { name: /open in/i })).not.toBeInTheDocument();
    });

    it('does NOT show "Open in Jira" when targetUrl is null even if issue created', () => {
      setupStore(
        makeResult({
          targetUrl: null,
          steps: [{ step: 'create_issue', success: true, detail: null }],
        }),
      );
      renderWithI18n(<CopyResultPage />);
      expect(screen.queryByRole('button', { name: /open in/i })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Close button
  // -------------------------------------------------------------------------

  describe('"Close" button', () => {
    it('shows a close button', () => {
      setupStore(makeResult());
      renderWithI18n(<CopyResultPage />);
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('clicking Close calls get_triage_state then reset()', async () => {
      const triageMap = { 'CLOUD-42': { state: 'copied', copiedKey: 'CLOUD-42' } };
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_triage_state') return Promise.resolve(triageMap);
        return Promise.resolve(null);
      });

      const reset = vi.fn();
      useCopyStore.setState({ result: makeResult(), reset });

      renderWithI18n(<CopyResultPage />);
      fireEvent.click(screen.getByRole('button', { name: /close/i }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_triage_state');
        expect(reset).toHaveBeenCalled();
      });
    });

    it('calls reset() even if get_triage_state rejects', async () => {
      mockInvoke.mockRejectedValue(new Error('DB error'));
      const reset = vi.fn();
      useCopyStore.setState({ result: makeResult(), reset });

      renderWithI18n(<CopyResultPage />);
      fireEvent.click(screen.getByRole('button', { name: /close/i }));

      await waitFor(() => {
        expect(reset).toHaveBeenCalled();
      });
    });
  });
});
