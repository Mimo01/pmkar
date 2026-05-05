/**
 * CopyPreviewPage — Phase 22 integration tests
 *
 * Uses a fully-mocked copyStore + mocked IssueTypeChooser / DynamicTargetForm
 * to verify the Phase 22 wiring: chooser, gaps, form, copy-button gating,
 * map-link navigation, email pre-fill, user search, and schema-loading visual.
 *
 * Pre-Phase-22 behaviors tested here: source panel content, progress bar, discard.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Tauri invoke mock — capture command names + args
// ---------------------------------------------------------------------------

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// ---------------------------------------------------------------------------
// connectionStore mock
// ---------------------------------------------------------------------------

vi.mock('../../connections/connectionStore', () => ({
  useConnectionStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        serverConnection: { baseUrl: 'http://server.example.com' },
        cloudConnection: { baseUrl: 'https://cloud.example.com' },
      }),
    {
      getState: () => ({
        serverConnection: { baseUrl: 'http://server.example.com' },
        cloudConnection: { baseUrl: 'https://cloud.example.com' },
      }),
    },
  ),
}));

// ---------------------------------------------------------------------------
// Capture DynamicTargetForm props
// ---------------------------------------------------------------------------

const capturedFormProps: Record<string, unknown> = {};
vi.mock('@/features/field-renderers/DynamicTargetForm', () => ({
  DynamicTargetForm: (props: unknown) => {
    Object.assign(capturedFormProps, props as object);
    const p = props as {
      fields: Array<{ fieldId: string }>;
      searchCallbacks?: unknown;
      initialQueries?: Record<string, string>;
    };
    return <div data-testid="dyn-form">fields:{p.fields.map((f) => f.fieldId).join(',')}</div>;
  },
}));

// ---------------------------------------------------------------------------
// Capture IssueTypeChooser props
// ---------------------------------------------------------------------------

let lastChooserProps: Record<string, unknown> | null = null;
vi.mock('../IssueTypeChooser', () => ({
  IssueTypeChooser: (props: unknown) => {
    lastChooserProps = props as Record<string, unknown>;
    const p = props as { onChange: (id: string) => void };
    return (
      <button type="button" data-testid="chooser-pick-it-2" onClick={() => p.onChange('it-2')}>
        pick-it-2
      </button>
    );
  },
}));

// ---------------------------------------------------------------------------
// schemaCacheStore mock (mutable via mockCache)
// ---------------------------------------------------------------------------

let mockCache: Record<string, { status: string; fields?: unknown[] }> = {};
vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        cache: mockCache,
        prewarmedIssueTypes: { PROJ: [{ id: 'it-1', name: 'Bug' }] },
        preWarm: vi.fn().mockResolvedValue(undefined),
        loadSchema: vi.fn(),
      }),
    {
      getState: () => ({
        cache: mockCache,
        prewarmedIssueTypes: { PROJ: [{ id: 'it-1', name: 'Bug' }] },
        preWarm: vi.fn().mockResolvedValue(undefined),
        loadSchema: vi.fn(),
      }),
    },
  ),
  schemaCacheKey: (side: string, pk: string | null, it: string | null) =>
    `${side}|${pk ?? '__null__'}|${it ?? '__null__'}`,
}));

// ---------------------------------------------------------------------------
// copyStore mutable mock
// ---------------------------------------------------------------------------

const mockReset = vi.fn();
const mockConfirmCopy = vi.fn();
const mockSetTargetSummary = vi.fn();
const mockSetTargetProjectKey = vi.fn();
const mockSetTargetIssueTypeId = vi.fn().mockResolvedValue(undefined);
const mockSetOverrideValue = vi.fn();

let currentStoreState: Record<string, unknown> = {};

function makeTicketDetail(fieldOverrides: Record<string, unknown> = {}) {
  return {
    key: 'SRC-1',
    fields: {
      summary: 'Source ticket',
      description: '',
      status: { name: 'Open', id: '1' },
      priority: { name: 'High', id: '2' },
      assignee: { displayName: 'Alice', emailAddress: 'alice@acme.com' },
      reporter: null,
      labels: ['x'],
      components: [],
      fixVersions: [],
      comment: { comments: [] },
      attachment: [],
      subtasks: [],
      issuelinks: [],
      updated: '2026-01-01',
      issuetype: { id: 'src-bug', name: 'Bug' },
      ...fieldOverrides,
    },
    renderedFields: { description: null },
  };
}

function buildState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    phase: 'previewing' as const,
    sourceTicket: makeTicketDetail(),
    sourceKey: 'SRC-1',
    targetSummary: 'Source ticket',
    targetDescription: '',
    targetStatus: 'To Do',
    targetPriorityId: 'p1',
    targetLabels: ['x'],
    selectedLabels: ['x'],
    cloudMeta: {
      availableStatuses: [{ id: 's1', name: 'To Do' }],
      availablePriorities: [{ id: 'p1', name: 'Medium' }],
      currentAccountId: 'acc',
      cloudBaseUrl: 'https://cloud.example.com',
    },
    result: null,
    error: null,
    progressStep: '',
    targetProjectKey: 'PROJ',
    setTargetProjectKey: mockSetTargetProjectKey,
    setTargetSummary: mockSetTargetSummary,
    setTargetDescription: vi.fn(),
    setTargetStatus: vi.fn(),
    setTargetPriorityId: vi.fn(),
    toggleLabel: vi.fn(),
    confirmCopy: mockConfirmCopy,
    reset: mockReset,
    targetIssueTypeId: 'it-1',
    overrideValues: {},
    resolvedTargetFields: [],
    setTargetIssueTypeId: mockSetTargetIssueTypeId,
    setOverrideValue: mockSetOverrideValue,
    clearOverrides: vi.fn(),
    setResolvedTargetFields: vi.fn(),
    startPreview: vi.fn(),
    ...overrides,
  };
}

vi.mock('../copyStore', () => ({
  useCopyStore: Object.assign((selector: (s: unknown) => unknown) => selector(currentStoreState), {
    getState: () => currentStoreState,
  }),
}));

// ---------------------------------------------------------------------------
// Import under test (after all mocks)
// ---------------------------------------------------------------------------

import { CopyPreviewPage } from '../CopyPreviewPage';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('CopyPreviewPage — Phase 22 integration', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockReset.mockReset();
    mockConfirmCopy.mockReset();
    mockSetTargetIssueTypeId.mockReset().mockResolvedValue(undefined);
    mockSetOverrideValue.mockReset();
    mockCache = {};
    lastChooserProps = null;
    for (const k of Object.keys(capturedFormProps)) {
      delete capturedFormProps[k];
    }
    currentStoreState = buildState();
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'fetch_cloud_projects') return [{ key: 'PROJ', name: 'Project' }];
      if (cmd === 'get_field_mapping') return [];
      if (cmd === 'search_jira_users_by_domain') return [];
      return null;
    });
  });

  // ── Source panel ───────────────────────────────────────────────────────────

  it('renders source ticket summary in left panel', async () => {
    render(<CopyPreviewPage />);
    await waitFor(() => expect(screen.getByText('Source ticket')).toBeInTheDocument());
  });

  it('renders chooser, summary input, and DynamicTargetForm when previewing', async () => {
    render(<CopyPreviewPage />);
    await waitFor(() => expect(screen.getByTestId('chooser-pick-it-2')).toBeInTheDocument());
    expect(screen.getByLabelText(/Summary/i)).toBeInTheDocument();
    expect(screen.getByTestId('dyn-form')).toBeInTheDocument();
  });

  // ── GapsSection integration ────────────────────────────────────────────────

  it('GapsSection renders when resolvedTargetFields contains a required-unmapped field', async () => {
    currentStoreState = buildState({
      resolvedTargetFields: [
        { fieldId: 'environment', name: 'Environment', required: true, schema: { type: 'string' } },
      ],
    });
    render(<CopyPreviewPage />);
    await waitFor(() => {
      expect(screen.getByTestId('gaps-section')).toBeInTheDocument();
    });
  });

  it('Copy button is disabled when a gap exists with no override value', async () => {
    currentStoreState = buildState({
      resolvedTargetFields: [
        { fieldId: 'environment', name: 'Environment', required: true, schema: { type: 'string' } },
      ],
    });
    render(<CopyPreviewPage />);
    await waitFor(() => {
      const copyBtn = screen.getByRole('button', { name: /Copy to PROJ/i });
      expect(copyBtn).toBeDisabled();
    });
  });

  it('Copy button is enabled once a gap field has been filled in via override', async () => {
    // Required-without-mapping field whose override has been entered by the user.
    // Bug fix: the gate must consult overrideValues, not just gapFields.length.
    currentStoreState = buildState({
      resolvedTargetFields: [
        { fieldId: 'environment', name: 'Environment', required: true, schema: { type: 'string' } },
      ],
      overrideValues: { environment: 'prod' },
    });
    render(<CopyPreviewPage />);
    await waitFor(() => {
      const copyBtn = screen.getByRole('button', { name: /Copy to PROJ/i });
      expect(copyBtn).not.toBeDisabled();
    });
  });

  it('Copy button stays disabled when override value is whitespace-only', async () => {
    currentStoreState = buildState({
      resolvedTargetFields: [
        { fieldId: 'environment', name: 'Environment', required: true, schema: { type: 'string' } },
      ],
      overrideValues: { environment: '   ' },
    });
    render(<CopyPreviewPage />);
    await waitFor(() => {
      const copyBtn = screen.getByRole('button', { name: /Copy to PROJ/i });
      expect(copyBtn).toBeDisabled();
    });
  });

  it('Copy button is enabled when no gaps', async () => {
    render(<CopyPreviewPage />);
    await waitFor(() => {
      const copyBtn = screen.getByRole('button', { name: /Copy to PROJ/i });
      expect(copyBtn).not.toBeDisabled();
    });
  });

  it('Copy button is disabled when targetIssueTypeId is null (D-11 parity with CopyPreviewModal)', async () => {
    currentStoreState = buildState({ targetIssueTypeId: null });
    render(<CopyPreviewPage />);
    await waitFor(() => {
      const copyBtn = screen.getByRole('button', { name: /Copy to PROJ/i });
      expect(copyBtn).toBeDisabled();
    });
  });

  // ── IssueTypeChooser ───────────────────────────────────────────────────────

  it('selecting a different issue type calls setTargetIssueTypeId', async () => {
    render(<CopyPreviewPage />);
    fireEvent.click(await screen.findByTestId('chooser-pick-it-2'));
    expect(mockSetTargetIssueTypeId).toHaveBeenCalledWith('it-2');
  });

  // ── Map field link ─────────────────────────────────────────────────────────

  it('clicking Map field link calls onOpenSettingsSection("field-mapping") and reset()', async () => {
    const onOpenSettingsSection = vi.fn();
    currentStoreState = buildState({
      resolvedTargetFields: [
        { fieldId: 'environment', name: 'Environment', required: true, schema: { type: 'string' } },
      ],
    });
    render(<CopyPreviewPage onOpenSettingsSection={onOpenSettingsSection} />);
    const mapLink = await screen.findByTestId('gap-map-link-environment');
    fireEvent.click(mapLink);
    expect(mockReset).toHaveBeenCalled();
    expect(onOpenSettingsSection).toHaveBeenCalledWith('field-mapping');
  });

  // ── Email pre-fill (D-15, PERS-02) ────────────────────────────────────────

  it('passes initialQueries entry for assignee field when source has emailAddress', async () => {
    currentStoreState = buildState({
      resolvedTargetFields: [
        { fieldId: 'assignee', name: 'Assignee', required: false, schema: { type: 'user' } },
      ],
    });
    render(<CopyPreviewPage />);
    await waitFor(() => {
      const iqs = (capturedFormProps as { initialQueries?: Record<string, string> }).initialQueries;
      expect(iqs).toBeDefined();
      expect(iqs!.assignee).toBe('alice@acme.com');
    });
  });

  it('does NOT set initialQueries entry when source has no emailAddress (Cloud privacy mode / PERS-04)', async () => {
    currentStoreState = buildState({
      sourceTicket: makeTicketDetail({
        assignee: { displayName: 'Alice' }, // no emailAddress (PERS-04)
      }),
      resolvedTargetFields: [
        { fieldId: 'assignee', name: 'Assignee', required: false, schema: { type: 'user' } },
      ],
    });
    render(<CopyPreviewPage />);
    await waitFor(() => {
      const iqs = (capturedFormProps as { initialQueries?: Record<string, string> }).initialQueries;
      expect(iqs ?? {}).not.toHaveProperty('assignee');
    });
  });

  // ── User search wiring (PERS-03, T-22-15) ─────────────────────────────────

  it('searchUsersForPicker invokes search_jira_users_by_domain with extracted domain', async () => {
    render(<CopyPreviewPage />);
    await waitFor(() => expect(capturedFormProps.searchCallbacks).toBeDefined());
    const onSearchUsers = (
      capturedFormProps as { searchCallbacks: { onSearchUsers: (q: string) => Promise<unknown> } }
    ).searchCallbacks.onSearchUsers;
    await onSearchUsers('alice@acme.com');
    expect(mockInvoke).toHaveBeenCalledWith('search_jira_users_by_domain', {
      baseUrl: 'http://server.example.com',
      domain: 'acme.com',
    });
  });

  // ── Mapping rows fetch ─────────────────────────────────────────────────────

  it('fetches mapping rows on preview open', async () => {
    render(<CopyPreviewPage />);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_field_mapping');
    });
  });

  // ── Preview audit logging (quick task 260430-0tj) ─────────────────────────

  it('logs preview transformations via log_preview_transformations on pre-fill', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'fetch_cloud_projects') return [{ key: 'PROJ', name: 'Project' }];
      if (cmd === 'get_field_mapping') {
        return [
          { sourceFieldId: 'summary', targetFieldId: 'summary', transformerKind: 'identity' },
          { sourceFieldId: 'priority', targetFieldId: 'priority', transformerKind: 'priority' },
          { sourceFieldId: 'assignee', targetFieldId: 'assignee', transformerKind: 'user' },
          {
            sourceFieldId: 'fixVersions',
            targetFieldId: 'fixVersions',
            transformerKind: 'version',
          },
          { sourceFieldId: 'missing_src', targetFieldId: 'orphan', transformerKind: 'identity' },
        ];
      }
      if (cmd === 'search_jira_users_by_domain') return [];
      return null;
    });

    render(<CopyPreviewPage />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'log_preview_transformations',
        expect.objectContaining({
          copyId: expect.any(String),
          entries: expect.any(Array),
        }),
      );
    });

    const logCall = mockInvoke.mock.calls.find(([c]) => c === 'log_preview_transformations');
    expect(logCall).toBeDefined();
    const entries = (
      logCall![1] as {
        entries: Array<{
          targetFieldId: string;
          outcome: string;
          failureReason: string | null;
          transformerKind: string;
        }>;
      }
    ).entries;
    const byField = Object.fromEntries(entries.map((e) => [e.targetFieldId, e]));

    // identity with present source → ok (pre-filled)
    expect(byField.summary?.outcome).toBe('ok');
    // priority transformer is prefillable; source priority object present → ok
    expect(byField.priority?.outcome).toBe('ok');
    // Phase 25: user transformer rows go through async resolve_users_preview path;
    // the mock sourceTicket assignee has no 'name' field, so no log entry is emitted
    // (the row silently skips username extraction). The async path fires but returns null.
    // version transformer is NOT prefillable → skipped, "runs at copy time"
    expect(byField.fixVersions?.outcome).toBe('skipped');
    expect(byField.fixVersions?.failureReason).toMatch(/runs at copy time/);
    // identity with absent source → skipped (source value missing)
    expect(byField.orphan?.outcome).toBe('skipped');
    expect(byField.orphan?.failureReason).toMatch(/source value missing/);
  });

  // ── Schema-loading visual ──────────────────────────────────────────────────

  it('chooser receives loading=true while cache entry status=loading', async () => {
    mockCache = {
      'target|PROJ|it-1': { status: 'loading' },
    };
    render(<CopyPreviewPage />);
    await waitFor(() => expect(lastChooserProps).not.toBeNull());
    expect((lastChooserProps as { loading?: boolean }).loading).toBe(true);
  });

  // ── Discard button ────────────────────────────────────────────────────────

  it('Discard button calls reset()', async () => {
    render(<CopyPreviewPage />);
    fireEvent.click(screen.getByRole('button', { name: /Discard/i }));
    expect(mockReset).toHaveBeenCalled();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it('renders loading spinner when phase is loading_preview', async () => {
    currentStoreState = buildState({
      phase: 'loading_preview',
      sourceTicket: null,
      cloudMeta: null,
    });
    render(<CopyPreviewPage />);
    expect(screen.getByLabelText('Loading preview')).toBeInTheDocument();
  });

  // ── Copying state ──────────────────────────────────────────────────────────

  it('shows progress bar when phase is copying', async () => {
    currentStoreState = buildState({
      phase: 'copying',
      progressStep: 'creating issue...',
    });
    render(<CopyPreviewPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Phase 25 — async pre-fill resolution (PREV-01, PREV-02, PREV-03)
// ---------------------------------------------------------------------------

describe('CopyPreviewPage — Phase 25 async pre-fill resolution', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockReset.mockReset();
    mockConfirmCopy.mockReset();
    mockSetTargetIssueTypeId.mockReset().mockResolvedValue(undefined);
    mockSetOverrideValue.mockReset();
    mockCache = {};
    lastChooserProps = null;
    for (const k of Object.keys(capturedFormProps)) {
      delete capturedFormProps[k];
    }

    // Default mock routing for Phase 25 tests
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'fetch_cloud_projects') return [{ key: 'PROJ', name: 'Project' }];
      if (cmd === 'get_field_mapping') return [];
      if (cmd === 'search_jira_users_by_domain') return [];
      if (cmd === 'log_preview_transformations') return null;
      if (cmd === 'resolve_description_to_adf')
        return { version: 1, type: 'doc', content: [] };
      if (cmd === 'resolve_users_preview')
        return [{ accountId: 'acc-1', displayName: 'Alice', emailAddress: 'alice@acme.com' }];
      return null;
    });
  });

  // PREV-01: wiki_to_adf row triggers resolve_description_to_adf invoke
  it('PREV-01 pre-fill effect invokes resolve_description_to_adf when wiki_to_adf row exists', async () => {
    const wikiRow = {
      sourceFieldId: 'description',
      targetFieldId: 'description',
      transformerKind: 'wiki_to_adf',
      sourceSchema: { type: 'string', system: 'description' },
      targetSchema: { type: 'doc' },
    };
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'fetch_cloud_projects') return [{ key: 'PROJ', name: 'Project' }];
      if (cmd === 'get_field_mapping') return [wikiRow];
      if (cmd === 'search_jira_users_by_domain') return [];
      if (cmd === 'log_preview_transformations') return null;
      if (cmd === 'resolve_description_to_adf') return { version: 1, type: 'doc', content: [] };
      return null;
    });

    currentStoreState = buildState({
      sourceTicket: makeTicketDetail({
        description: '<p>Test description</p>',
        renderedFields: { description: '<p>Test</p>' },
      }),
    });
    // renderedFields is on the outer ticket object, not inside fields
    currentStoreState = buildState({
      sourceTicket: {
        ...makeTicketDetail(),
        renderedFields: { description: '<p>Test</p>' },
      },
    });

    render(<CopyPreviewPage />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('resolve_description_to_adf', {
        html: '<p>Test</p>',
      });
    });

    await waitFor(() => {
      expect(mockSetOverrideValue).toHaveBeenCalledWith('description', {
        version: 1,
        type: 'doc',
        content: [],
      });
    });
  });

  // PREV-02: user rows trigger resolve_users_preview invoke
  it('PREV-02 pre-fill effect invokes resolve_users_preview for user rows', async () => {
    const userRow = {
      sourceFieldId: 'assignee',
      targetFieldId: 'assignee',
      transformerKind: 'user',
      sourceSchema: { type: 'user' },
      targetSchema: { type: 'user' },
    };
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'fetch_cloud_projects') return [{ key: 'PROJ', name: 'Project' }];
      if (cmd === 'get_field_mapping') return [userRow];
      if (cmd === 'search_jira_users_by_domain') return [];
      if (cmd === 'log_preview_transformations') return null;
      if (cmd === 'resolve_users_preview')
        return [{ accountId: 'acc-1', displayName: 'Alice', emailAddress: 'alice@acme.com' }];
      return null;
    });

    currentStoreState = buildState({
      sourceTicket: makeTicketDetail({
        assignee: { name: 'alice', emailAddress: 'alice@acme.com', displayName: 'Alice' },
      }),
    });

    render(<CopyPreviewPage />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('resolve_users_preview', {
        users: [{ username: 'alice', email: 'alice@acme.com' }],
        cloudBaseUrl: 'https://cloud.example.com',
      });
    });

    await waitFor(() => {
      expect(mockSetOverrideValue).toHaveBeenCalledWith('assignee', {
        accountId: 'acc-1',
        displayName: 'Alice',
        emailAddress: 'alice@acme.com',
      });
    });
  });

  // PREV-03: description field excluded from DynamicTargetForm
  it('PREV-03 description field is excluded from DynamicTargetForm fields prop', async () => {
    currentStoreState = buildState({
      resolvedTargetFields: [
        { fieldId: 'description', name: 'Description', required: false, schema: { type: 'string', system: 'description' } },
        { fieldId: 'assignee', name: 'Assignee', required: false, schema: { type: 'user' } },
      ],
    });

    render(<CopyPreviewPage />);

    await waitFor(() => {
      const fields = (capturedFormProps as { fields?: Array<{ fieldId: string }> }).fields;
      expect(fields).toBeDefined();
      const fieldIds = fields!.map((f) => f.fieldId);
      expect(fieldIds).not.toContain('description');
      expect(fieldIds).toContain('assignee');
    });
  });
});
