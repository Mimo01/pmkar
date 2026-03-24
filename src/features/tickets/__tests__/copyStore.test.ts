import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { useCopyStore } from '../copyStore';
import type { CloudMeta, JiraTicketDetail } from '../types';

const mockInvoke = vi.mocked(invoke);

const makeTicketDetail = (key: string): JiraTicketDetail => ({
  id: key,
  key,
  fields: {
    summary: `Summary for ${key}`,
    status: { name: 'In Progress', id: '3' },
    priority: { name: 'High', id: '2' },
    assignee: null,
    reporter: null,
    description: 'Test description',
    labels: ['backend', 'critical'],
    components: [],
    fixVersions: [],
    comment: { comments: [] },
    attachment: [],
    subtasks: [],
    issuelinks: [],
    updated: '2024-01-01T00:00:00.000Z',
  },
});

const makeCloudMeta = (): CloudMeta => ({
  availableStatuses: [
    { id: '1', name: 'To Do' },
    { id: '3', name: 'In Progress' },
    { id: '6', name: 'Done' },
  ],
  availablePriorities: [
    { id: '1', name: 'Highest' },
    { id: '2', name: 'High' },
    { id: '3', name: 'Medium' },
  ],
  currentAccountId: 'account-123',
  cloudBaseUrl: 'https://mycompany.atlassian.net',
});

const initialState = {
  phase: 'idle' as const,
  sourceTicket: null,
  sourceKey: null,
  targetSummary: '',
  targetDescription: '',
  targetStatus: '',
  targetPriorityId: '',
  targetLabels: [],
  selectedLabels: [],
  cloudMeta: null,
  result: null,
  error: null,
  progressStep: '',
};

describe('copyStore', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    useCopyStore.setState(initialState);
  });

  describe('initial state', () => {
    it('has idle phase', () => {
      expect(useCopyStore.getState().phase).toBe('idle');
    });

    it('has null sourceTicket and sourceKey', () => {
      expect(useCopyStore.getState().sourceTicket).toBeNull();
      expect(useCopyStore.getState().sourceKey).toBeNull();
    });

    it('has null cloudMeta', () => {
      expect(useCopyStore.getState().cloudMeta).toBeNull();
    });

    it('has null result and error', () => {
      expect(useCopyStore.getState().result).toBeNull();
      expect(useCopyStore.getState().error).toBeNull();
    });
  });

  describe('startPreview (fetch_cloud_meta)', () => {
    it('transitions to loading_preview immediately', async () => {
      mockInvoke.mockResolvedValue(makeCloudMeta());
      const ticket = makeTicketDetail('PROJ-1');

      const promise = useCopyStore.getState().startPreview(ticket, 'http://server', 'https://cloud');
      expect(useCopyStore.getState().phase).toBe('loading_preview');
      await promise;
    });

    it('sets sourceTicket and sourceKey when starting preview', async () => {
      mockInvoke.mockResolvedValue(makeCloudMeta());
      const ticket = makeTicketDetail('PROJ-1');
      await useCopyStore.getState().startPreview(ticket, 'http://server', 'https://cloud');

      expect(useCopyStore.getState().sourceTicket).toEqual(ticket);
      expect(useCopyStore.getState().sourceKey).toBe('PROJ-1');
    });

    it('prefills targetSummary from ticket summary', async () => {
      mockInvoke.mockResolvedValue(makeCloudMeta());
      const ticket = makeTicketDetail('PROJ-1');
      await useCopyStore.getState().startPreview(ticket, 'http://server', 'https://cloud');

      expect(useCopyStore.getState().targetSummary).toBe('Summary for PROJ-1');
    });

    it('sets phase to previewing on success', async () => {
      mockInvoke.mockResolvedValue(makeCloudMeta());
      const ticket = makeTicketDetail('PROJ-1');
      await useCopyStore.getState().startPreview(ticket, 'http://server', 'https://cloud');

      expect(useCopyStore.getState().phase).toBe('previewing');
    });

    it('populates cloudMeta on success', async () => {
      const meta = makeCloudMeta();
      mockInvoke.mockResolvedValue(meta);
      const ticket = makeTicketDetail('PROJ-1');
      await useCopyStore.getState().startPreview(ticket, 'http://server', 'https://cloud');

      expect(useCopyStore.getState().cloudMeta).toEqual(meta);
    });

    it('matches source status name to target status', async () => {
      mockInvoke.mockResolvedValue(makeCloudMeta());
      const ticket = makeTicketDetail('PROJ-1'); // status: 'In Progress'
      await useCopyStore.getState().startPreview(ticket, 'http://server', 'https://cloud');

      // 'In Progress' is case-insensitive matched in cloud meta
      expect(useCopyStore.getState().targetStatus).toBe('In Progress');
    });

    it('copies source labels to selectedLabels', async () => {
      mockInvoke.mockResolvedValue(makeCloudMeta());
      const ticket = makeTicketDetail('PROJ-1'); // labels: ['backend', 'critical']
      await useCopyStore.getState().startPreview(ticket, 'http://server', 'https://cloud');

      expect(useCopyStore.getState().targetLabels).toEqual(['backend', 'critical']);
      expect(useCopyStore.getState().selectedLabels).toEqual(['backend', 'critical']);
    });

    it('sets phase to idle and error message on failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Connection refused'));
      const ticket = makeTicketDetail('PROJ-1');
      await useCopyStore.getState().startPreview(ticket, 'http://server', 'https://cloud');

      const state = useCopyStore.getState();
      expect(state.phase).toBe('idle');
      expect(state.error).toBe(
        'Could not load target fields. Check your Company Jira connection in Settings.',
      );
    });
  });

  describe('setTargetSummary / setTargetDescription / setTargetStatus / setTargetPriorityId', () => {
    it('setTargetSummary updates targetSummary', () => {
      useCopyStore.getState().setTargetSummary('New summary');
      expect(useCopyStore.getState().targetSummary).toBe('New summary');
    });

    it('setTargetDescription updates targetDescription', () => {
      useCopyStore.getState().setTargetDescription('New description');
      expect(useCopyStore.getState().targetDescription).toBe('New description');
    });

    it('setTargetStatus updates targetStatus', () => {
      useCopyStore.getState().setTargetStatus('In Progress');
      expect(useCopyStore.getState().targetStatus).toBe('In Progress');
    });

    it('setTargetPriorityId updates targetPriorityId', () => {
      useCopyStore.getState().setTargetPriorityId('2');
      expect(useCopyStore.getState().targetPriorityId).toBe('2');
    });
  });

  describe('toggleLabel', () => {
    it('adds label when not in selectedLabels', () => {
      useCopyStore.setState({ selectedLabels: ['existing'] });
      useCopyStore.getState().toggleLabel('new-label');
      expect(useCopyStore.getState().selectedLabels).toContain('new-label');
    });

    it('removes label when already in selectedLabels', () => {
      useCopyStore.setState({ selectedLabels: ['backend', 'critical'] });
      useCopyStore.getState().toggleLabel('backend');
      expect(useCopyStore.getState().selectedLabels).not.toContain('backend');
      expect(useCopyStore.getState().selectedLabels).toContain('critical');
    });
  });

  describe('confirmCopy', () => {
    it('does nothing when sourceKey is null', async () => {
      useCopyStore.setState({ sourceKey: null, cloudMeta: makeCloudMeta() });
      await useCopyStore.getState().confirmCopy('http://server', 'https://cloud');

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('does nothing when cloudMeta is null', async () => {
      useCopyStore.setState({ sourceKey: 'PROJ-1', cloudMeta: null });
      await useCopyStore.getState().confirmCopy('http://server', 'https://cloud');

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('transitions to copying phase and then result on success', async () => {
      const copyResult = {
        targetKey: 'CLOUD-42',
        targetUrl: 'https://cloud/CLOUD-42',
        steps: [{ step: 'create_issue', success: true, detail: 'CLOUD-42' }],
      };
      mockInvoke.mockResolvedValue(copyResult);
      useCopyStore.setState({
        sourceKey: 'PROJ-1',
        cloudMeta: makeCloudMeta(),
        targetSummary: 'Test',
        targetDescription: 'Desc',
        targetStatus: 'To Do',
        targetPriorityId: '3',
        selectedLabels: [],
      });

      await useCopyStore.getState().confirmCopy('http://server', 'https://cloud');

      const state = useCopyStore.getState();
      expect(state.phase).toBe('result');
      expect(state.result).toEqual(copyResult);
      expect(state.progressStep).toBe('');
    });

    it('sets result with failed step on invoke error', async () => {
      mockInvoke.mockRejectedValue(new Error('Timeout'));
      useCopyStore.setState({
        sourceKey: 'PROJ-1',
        cloudMeta: makeCloudMeta(),
        targetSummary: 'Test',
        targetDescription: '',
        targetStatus: 'To Do',
        targetPriorityId: '3',
        selectedLabels: [],
      });

      await useCopyStore.getState().confirmCopy('http://server', 'https://cloud');

      const state = useCopyStore.getState();
      expect(state.phase).toBe('result');
      expect(state.result?.targetKey).toBeNull();
      expect(state.result?.steps[0].success).toBe(false);
    });
  });

  describe('reset', () => {
    it('returns all state to initial values', () => {
      useCopyStore.setState({
        phase: 'previewing',
        sourceKey: 'PROJ-1',
        targetSummary: 'Something',
        cloudMeta: makeCloudMeta(),
        result: {
          targetKey: 'CLOUD-1',
          targetUrl: 'https://cloud/CLOUD-1',
          steps: [],
        },
        error: 'some error',
      });

      useCopyStore.getState().reset();

      const state = useCopyStore.getState();
      expect(state.phase).toBe('idle');
      expect(state.sourceKey).toBeNull();
      expect(state.targetSummary).toBe('');
      expect(state.cloudMeta).toBeNull();
      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});
