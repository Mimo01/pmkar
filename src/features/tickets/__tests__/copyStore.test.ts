import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldSchema } from '@/types/fieldSchema';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

// Phase 22 mocks for schemaCacheStore and connectionStore
const mockPreWarm = vi.fn();
const mockLoadSchema = vi.fn();
let mockPrewarmedIssueTypes: Record<string, Array<{ id: string; name: string }>> = {};
let mockCache: Record<string, { status: string; fields?: unknown[] }> = {};

vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: {
    getState: () => ({
      preWarm: mockPreWarm,
      loadSchema: mockLoadSchema,
      get prewarmedIssueTypes() {
        return mockPrewarmedIssueTypes;
      },
      get cache() {
        return mockCache;
      },
    }),
  },
  schemaCacheKey: (side: string, pk: string | null, it: string | null) =>
    `${side}|${pk ?? '__null__'}|${it ?? '__null__'}`,
}));

vi.mock('../../connections/connectionStore', () => ({
  useConnectionStore: {
    getState: () => ({ targetProjectKey: 'PROJ' }),
  },
}));

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

      const promise = useCopyStore
        .getState()
        .startPreview(ticket, 'http://server', 'https://cloud');
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
        'Could not load target fields. Check your destination connection in Settings.',
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
      await useCopyStore.getState().confirmCopy('http://server', 'https://cloud', null);

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('does nothing when cloudMeta is null', async () => {
      useCopyStore.setState({ sourceKey: 'PROJ-1', cloudMeta: null });
      await useCopyStore.getState().confirmCopy('http://server', 'https://cloud', null);

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
        targetIssueTypeId: 'it-1',
      });

      await useCopyStore.getState().confirmCopy('http://server', 'https://cloud', null);

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

      await useCopyStore.getState().confirmCopy('http://server', 'https://cloud', null);

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

const initialPhase22State = {
  targetIssueTypeId: null as string | null,
  overrideValues: {} as Record<string, unknown>,
  resolvedTargetFields: [] as FieldSchema[],
};

describe('copyStore — Phase 22 override state', () => {
  beforeEach(() => {
    mockPreWarm.mockReset();
    mockLoadSchema.mockReset();
    mockPrewarmedIssueTypes = {};
    mockCache = {};
    useCopyStore.setState({
      ...initialPhase22State,
      // also reset the rest to known-good baseline
      phase: 'idle',
      sourceTicket: null,
      sourceKey: null,
      targetSummary: '',
      targetDescription: '',
      targetStatus: '',
      targetPriorityId: '',
      targetLabels: [],
      selectedLabels: [],
      targetProjectKey: 'PROJ',
      cloudMeta: null,
      result: null,
      error: null,
      progressStep: '',
    });
  });

  it('initial state has empty override fields', () => {
    const s = useCopyStore.getState();
    expect(s.targetIssueTypeId).toBeNull();
    expect(s.overrideValues).toEqual({});
    expect(s.resolvedTargetFields).toEqual([]);
  });

  it('setOverrideValue accumulates and replaces by key', () => {
    useCopyStore.getState().setOverrideValue('customfield_10001', 'a');
    useCopyStore.getState().setOverrideValue('customfield_10002', 7);
    useCopyStore.getState().setOverrideValue('customfield_10001', 'b');
    expect(useCopyStore.getState().overrideValues).toEqual({
      customfield_10001: 'b',
      customfield_10002: 7,
    });
  });

  it('clearOverrides resets override fields without touching unrelated fields', () => {
    useCopyStore.setState({
      targetIssueTypeId: 'it-1',
      overrideValues: { x: 1 },
      resolvedTargetFields: [
        { fieldId: 'f', name: 'F', required: false, schema: { type: 'any' } } as never,
      ],
      targetSummary: 'KEEP ME',
    });
    useCopyStore.getState().clearOverrides();
    const s = useCopyStore.getState();
    expect(s.targetIssueTypeId).toBeNull();
    expect(s.overrideValues).toEqual({});
    expect(s.resolvedTargetFields).toEqual([]);
    expect(s.targetSummary).toBe('KEEP ME');
  });

  it('reset clears override fields back to initial', () => {
    useCopyStore.setState({
      targetIssueTypeId: 'it-1',
      overrideValues: { x: 1 },
    });
    useCopyStore.getState().reset();
    const s = useCopyStore.getState();
    expect(s.targetIssueTypeId).toBeNull();
    expect(s.overrideValues).toEqual({});
    expect(s.resolvedTargetFields).toEqual([]);
  });

  it('setTargetIssueTypeId loads target schema and updates resolvedTargetFields', async () => {
    mockCache['target|PROJ|it-1'] = {
      status: 'success',
      fields: [{ fieldId: 'f1', name: 'F1', required: true, schema: { type: 'string' } }],
    };
    mockLoadSchema.mockResolvedValueOnce(undefined);
    await useCopyStore.getState().setTargetIssueTypeId('it-1');
    expect(mockLoadSchema).toHaveBeenCalledWith('target', 'PROJ', 'it-1');
    expect(useCopyStore.getState().targetIssueTypeId).toBe('it-1');
    expect(useCopyStore.getState().resolvedTargetFields).toHaveLength(1);
  });

  it("setTargetIssueTypeId('') clears without invoking loadSchema", async () => {
    await useCopyStore.getState().setTargetIssueTypeId('');
    expect(mockLoadSchema).not.toHaveBeenCalled();
    expect(useCopyStore.getState().targetIssueTypeId).toBeNull();
    expect(useCopyStore.getState().resolvedTargetFields).toEqual([]);
  });

  it('startPreview picks case-insensitive name-match default issue type', async () => {
    mockPrewarmedIssueTypes = {
      PROJ: [
        { id: 'it-bug', name: 'Bug' },
        { id: 'it-task', name: 'Task' },
      ],
    };
    mockCache['target|PROJ|it-task'] = { status: 'success', fields: [] };
    mockLoadSchema.mockResolvedValue(undefined);
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce({
      availableStatuses: [{ id: 's1', name: 'To Do' }],
      availablePriorities: [{ id: 'p1', name: 'Medium' }],
      currentAccountId: 'acc-1',
      cloudBaseUrl: 'https://cloud.example.com',
    });

    const ticket = {
      key: 'SRC-1',
      fields: {
        summary: 'X',
        description: '',
        status: { name: 'Open', id: '1' },
        priority: { name: 'Medium', id: '2' },
        labels: [],
        issuetype: { id: 'src-task', name: 'task' }, // lowercase to test case-insensitive
      },
    } as never;

    await useCopyStore.getState().startPreview(ticket, '', '');
    expect(useCopyStore.getState().targetIssueTypeId).toBe('it-task');
  });

  it('startPreview falls back to first issue type when no name match', async () => {
    mockPrewarmedIssueTypes = { PROJ: [{ id: 'it-bug', name: 'Bug' }] };
    mockCache['target|PROJ|it-bug'] = { status: 'success', fields: [] };
    mockLoadSchema.mockResolvedValue(undefined);
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce({
      availableStatuses: [{ id: 's1', name: 'To Do' }],
      availablePriorities: [{ id: 'p1', name: 'Medium' }],
      currentAccountId: 'acc-1',
      cloudBaseUrl: 'https://cloud.example.com',
    });

    const ticket = {
      key: 'SRC-1',
      fields: {
        summary: 'X',
        description: '',
        status: { name: 'Open', id: '1' },
        priority: { name: 'Medium', id: '2' },
        labels: [],
        issuetype: { id: 'src-story', name: 'Story' },
      },
    } as never;

    await useCopyStore.getState().startPreview(ticket, '', '');
    expect(useCopyStore.getState().targetIssueTypeId).toBe('it-bug');
  });

  it('startPreview calls preWarm when prewarmedIssueTypes is empty', async () => {
    mockPrewarmedIssueTypes = {};
    mockPreWarm.mockImplementationOnce(async () => {
      mockPrewarmedIssueTypes = { PROJ: [{ id: 'it-1', name: 'Story' }] };
    });
    mockCache['target|PROJ|it-1'] = { status: 'success', fields: [] };
    mockLoadSchema.mockResolvedValue(undefined);
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce({
      availableStatuses: [{ id: 's1', name: 'To Do' }],
      availablePriorities: [{ id: 'p1', name: 'Medium' }],
      currentAccountId: 'acc-1',
      cloudBaseUrl: 'https://cloud.example.com',
    });
    const ticket = {
      key: 'SRC-1',
      fields: {
        summary: 'X',
        description: '',
        status: { name: 'Open', id: '1' },
        priority: { name: 'Medium', id: '2' },
        labels: [],
        issuetype: { name: 'Story' },
      },
    } as never;
    await useCopyStore.getState().startPreview(ticket, '', '');
    expect(mockPreWarm).toHaveBeenCalledWith('PROJ');
    expect(useCopyStore.getState().targetIssueTypeId).toBe('it-1');
  });

  it('startPreview leaves targetIssueTypeId null when no issue types are available', async () => {
    mockPrewarmedIssueTypes = { PROJ: [] };
    mockPreWarm.mockResolvedValue(undefined); // still empty after preWarm
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce({
      availableStatuses: [{ id: 's1', name: 'To Do' }],
      availablePriorities: [{ id: 'p1', name: 'Medium' }],
      currentAccountId: 'acc-1',
      cloudBaseUrl: 'https://cloud.example.com',
    });
    const ticket = {
      key: 'SRC-1',
      fields: {
        summary: 'X',
        description: '',
        status: { name: 'Open', id: '1' },
        priority: { name: 'Medium', id: '2' },
        labels: [],
        issuetype: { name: 'Bug' },
      },
    } as never;
    await useCopyStore.getState().startPreview(ticket, '', '');
    expect(useCopyStore.getState().targetIssueTypeId).toBeNull();
    expect(mockLoadSchema).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Phase 25 — override values in confirmCopy (PREV-04)
// ---------------------------------------------------------------------------

describe('copyStore — Phase 25 override values in confirmCopy', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    useCopyStore.setState({
      phase: 'idle',
      sourceTicket: null,
      sourceKey: null,
      targetSummary: '',
      targetDescription: '',
      targetStatus: '',
      targetPriorityId: '',
      targetLabels: [],
      selectedLabels: [],
      targetProjectKey: 'PROJ',
      cloudMeta: null,
      result: null,
      error: null,
      progressStep: '',
      targetIssueTypeId: 'it-p25',
      overrideValues: {},
      resolvedTargetFields: [],
    });
  });

  it('PREV-04: confirmCopy invoke args contain Phase 25 override values (description ADF + user accountId)', async () => {
    const copyResult = {
      targetKey: 'CLOUD-1',
      targetUrl: 'https://cloud/CLOUD-1',
      steps: [{ step: 'create_issue', success: true, detail: 'CLOUD-1' }],
    };
    mockInvoke.mockResolvedValue(copyResult);

    // Set up store state with Phase 25 override values pre-populated (as if the pre-fill effect ran)
    useCopyStore.setState({
      sourceKey: 'SRC-25',
      cloudMeta: makeCloudMeta(),
      targetSummary: 'Phase 25 test ticket',
      targetDescription: '',
      targetStatus: 'To Do',
      targetPriorityId: '',
      selectedLabels: [],
      targetIssueTypeId: 'it-p25',
    });
    useCopyStore.getState().setOverrideValue('description', { version: 1, type: 'doc', content: [] });
    useCopyStore.getState().setOverrideValue('assignee', {
      accountId: 'acc-phase25',
      displayName: 'Phase25 User',
      emailAddress: 'p25@acme.com',
    });

    await useCopyStore.getState().confirmCopy('http://source.example.com', 'http://cloud.example.com', 'copy-id-p25');

    expect(mockInvoke).toHaveBeenCalledWith(
      'copy_ticket_v2',
      expect.objectContaining({
        args: expect.objectContaining({
          overrideValues: expect.objectContaining({
            description: { version: 1, type: 'doc', content: [] },
            assignee: expect.objectContaining({ accountId: 'acc-phase25' }),
          }),
        }),
      }),
    );
  });
});
