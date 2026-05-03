import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

// Mock schemaCacheStore — AllFieldsSection (used in source column) reads schema on mount.
vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        cache: {
          'source|__null__|__null__': {
            status: 'success',
            fields: [
              { fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } },
              { fieldId: 'status', name: 'Status', required: false, schema: { type: 'any' } },
              {
                fieldId: 'priority',
                name: 'Priority',
                required: false,
                schema: { type: 'priority' },
              },
              { fieldId: 'assignee', name: 'Assignee', required: false, schema: { type: 'user' } },
              {
                fieldId: 'labels',
                name: 'Labels',
                required: false,
                schema: { type: 'array', items: 'string' },
              },
            ],
          },
        },
        loadSchema: vi.fn(),
      }),
    {
      getState: () => ({
        cache: { 'source|__null__|__null__': { status: 'success', fields: [] } },
        loadSchema: vi.fn(),
      }),
    },
  ),
  schemaCacheKey: (side: string, pk: string | null, it: string | null) =>
    `${side}|${pk ?? '__null__'}|${it ?? '__null__'}`,
}));

// Mock connectionStore
vi.mock('../connections/connectionStore', () => ({
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

const mockReset = vi.fn();
const mockConfirmCopy = vi.fn();
const mockSetTargetSummary = vi.fn();
const mockSetTargetStatus = vi.fn();
const mockSetTargetPriorityId = vi.fn();
const mockToggleLabel = vi.fn();

const mockCloudMeta = {
  availableStatuses: [
    { id: 's1', name: 'To Do' },
    { id: 's2', name: 'In Progress' },
    { id: 's3', name: 'Done' },
  ],
  availablePriorities: [
    { id: 'p1', name: 'Highest' },
    { id: 'p2', name: 'High' },
    { id: 'p3', name: 'Medium' },
  ],
  currentAccountId: 'acc-123',
  cloudBaseUrl: 'https://cloud.example.com',
};

const mockSourceTicket = {
  id: '10001',
  key: 'PROJ-1',
  fields: {
    summary: 'Source ticket summary',
    status: { name: 'Open', id: '1', statusCategory: { key: 'new' } },
    priority: { name: 'High', id: '2' },
    assignee: { displayName: 'Jane Doe' },
    reporter: null,
    description: 'Plain text description',
    labels: ['frontend', 'bug'],
    components: [],
    fixVersions: [],
    comment: { comments: [] },
    attachment: [],
    subtasks: [],
    issuelinks: [],
    updated: '2026-03-20T10:00:00.000+0000',
  },
};

// Mutable store state controlled per-test
let currentStoreState: Record<string, unknown> = {};

function buildStoreState(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'previewing' as const,
    sourceTicket: mockSourceTicket,
    sourceKey: 'PROJ-1',
    targetSummary: 'Source ticket summary',
    targetDescription: 'Plain text description',
    targetStatus: 'To Do',
    targetPriorityId: 'p3',
    targetLabels: ['frontend', 'bug'],
    selectedLabels: ['frontend', 'bug'],
    cloudMeta: mockCloudMeta,
    result: null,
    error: null,
    progressStep: '',
    reset: mockReset,
    confirmCopy: mockConfirmCopy,
    setTargetSummary: mockSetTargetSummary,
    setTargetDescription: vi.fn(),
    setTargetStatus: mockSetTargetStatus,
    setTargetPriorityId: mockSetTargetPriorityId,
    toggleLabel: mockToggleLabel,
    startPreview: vi.fn(),
    targetProjectKey: '',
    setTargetProjectKey: vi.fn(),
    targetIssueTypeId: null,
    overrideValues: {},
    resolvedTargetFields: [],
    setTargetIssueTypeId: vi.fn(),
    setOverrideValue: vi.fn(),
    clearOverrides: vi.fn(),
    ...overrides,
  };
}

// Mock copyStore using a factory so per-test state overrides work
vi.mock('./copyStore', () => ({
  useCopyStore: Object.assign((selector: (s: unknown) => unknown) => selector(currentStoreState), {
    getState: () => currentStoreState,
  }),
}));

import { CopyPreviewModal } from './CopyPreviewModal';

describe('CopyPreviewModal', () => {
  beforeEach(() => {
    mockReset.mockReset();
    mockConfirmCopy.mockReset();
    mockSetTargetStatus.mockReset();
    mockSetTargetPriorityId.mockReset();
    mockToggleLabel.mockReset();
    // Reset to default state
    currentStoreState = buildStoreState();
  });

  it('renders source fields on left column (COPY-01, COPY-08)', () => {
    render(<CopyPreviewModal />);

    // Source section heading
    expect(screen.getByText('Source')).toBeInTheDocument();

    // Source field values (summary appears twice — both columns show it)
    expect(screen.getAllByText('Source ticket summary').length).toBeGreaterThan(0);
    expect(screen.getByText('Open')).toBeInTheDocument();
    // 'High' may appear in both source field and priority dropdown options
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('frontend, bug')).toBeInTheDocument();
  });

  it('renders editable target fields on right column (COPY-08)', () => {
    render(<CopyPreviewModal />);

    // Target section heading
    expect(screen.getByText('Target')).toBeInTheDocument();

    // Summary input is editable
    const summaryInput = screen.getByDisplayValue('Source ticket summary');
    expect(summaryInput).toBeInTheDocument();
    expect(summaryInput.tagName).toBe('INPUT');
  });

  it('renders source status in source column (COPY-01)', () => {
    render(<CopyPreviewModal />);

    // Source column shows the original status value
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('renders source priority in source column (COPY-01)', () => {
    render(<CopyPreviewModal />);

    // Source column shows the original priority value
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });

  it('renders source labels in source column (COPY-01, D-09)', () => {
    render(<CopyPreviewModal />);

    // Source column shows label values
    expect(screen.getByText('frontend, bug')).toBeInTheDocument();
  });

  it('shows description preview using DescriptionRenderer (COPY-09, D-05)', () => {
    render(<CopyPreviewModal />);

    // DescriptionRenderer renders plain text in a <pre> when description is a string
    const matches = screen.getAllByText('Plain text description');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('Discard Preview button resets copyStore (COPY-08)', () => {
    render(<CopyPreviewModal />);

    fireEvent.click(screen.getByText('Discard Preview'));

    expect(mockReset).toHaveBeenCalledOnce();
  });

  it('Confirm button invokes copy_ticket_v2 with selected values (COPY-01)', () => {
    render(<CopyPreviewModal />);

    fireEvent.click(screen.getByText(/copy to/i));

    expect(mockConfirmCopy).toHaveBeenCalledWith(
      'http://server.example.com',
      'https://cloud.example.com',
    );
  });

  it('renders editable summary input prefilled from source', () => {
    render(<CopyPreviewModal />);

    const summaryInput = screen.getByDisplayValue('Source ticket summary');
    expect(summaryInput).toBeInTheDocument();
    expect(summaryInput.tagName).toBe('INPUT');
  });

  it('renders nothing when phase is idle', () => {
    currentStoreState = buildStoreState({ phase: 'idle' });

    const { container } = render(<CopyPreviewModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders source column without labels when ticket has no labels', () => {
    currentStoreState = buildStoreState({
      sourceTicket: {
        ...mockSourceTicket,
        fields: { ...mockSourceTicket.fields, labels: [] },
      },
    });

    render(<CopyPreviewModal />);
    expect(screen.queryByText('frontend, bug')).not.toBeInTheDocument();
  });

  it('shows attachment count when source has attachments (COPY-02)', () => {
    currentStoreState = buildStoreState({
      sourceTicket: {
        ...mockSourceTicket,
        fields: {
          ...mockSourceTicket.fields,
          attachment: [
            {
              id: '1',
              filename: 'screenshot.png',
              size: 1024,
              mimeType: 'image/png',
              content: 'http://example.com/att/1',
            },
            {
              id: '2',
              filename: 'log.txt',
              size: 512,
              mimeType: 'text/plain',
              content: 'http://example.com/att/2',
            },
          ],
        },
      },
    });
    render(<CopyPreviewModal />);
    expect(screen.getByText('2 file(s) will be copied')).toBeInTheDocument();
  });

  it('hides attachment row when source has no attachments (COPY-02)', () => {
    currentStoreState = buildStoreState(); // mockSourceTicket.attachment is []
    render(<CopyPreviewModal />);
    expect(screen.queryByText(/file\(s\) will be copied/)).not.toBeInTheDocument();
  });

  it('shows comment count when source has comments (COPY-03)', () => {
    currentStoreState = buildStoreState({
      sourceTicket: {
        ...mockSourceTicket,
        fields: {
          ...mockSourceTicket.fields,
          comment: {
            comments: [
              {
                id: '1',
                author: { displayName: 'Jane' },
                body: 'First comment',
                created: '2026-01-01T10:00:00.000+0000',
              },
              {
                id: '2',
                author: { displayName: 'John' },
                body: 'Second comment',
                created: '2026-01-02T10:00:00.000+0000',
              },
              {
                id: '3',
                author: { displayName: 'Jane' },
                body: 'Third comment',
                created: '2026-01-03T10:00:00.000+0000',
              },
            ],
          },
        },
      },
    });
    render(<CopyPreviewModal />);
    expect(screen.getByText('3 comment(s) will be copied')).toBeInTheDocument();
  });

  it('shows sub-task list with KEY: summary format (COPY-05)', () => {
    currentStoreState = buildStoreState({
      sourceTicket: {
        ...mockSourceTicket,
        fields: {
          ...mockSourceTicket.fields,
          subtasks: [
            { key: 'CUST-101', fields: { summary: 'Fix login timeout', status: { name: 'Open' } } },
            { key: 'CUST-102', fields: { summary: 'Add retry logic', status: { name: 'Open' } } },
          ],
        },
      },
    });
    render(<CopyPreviewModal />);
    expect(screen.getByText(/created as child issues/)).toBeInTheDocument();
    expect(screen.getByText(/CUST-101: Fix login timeout/)).toBeInTheDocument();
    expect(screen.getByText(/CUST-102: Add retry logic/)).toBeInTheDocument();
  });

  it('shows linked issues with linkType: KEY - summary format (COPY-06)', () => {
    currentStoreState = buildStoreState({
      sourceTicket: {
        ...mockSourceTicket,
        fields: {
          ...mockSourceTicket.fields,
          issuelinks: [
            {
              id: '1',
              type: { name: 'Blocks', inward: 'is blocked by', outward: 'Blocks' },
              outwardIssue: {
                key: 'CUST-200',
                fields: { summary: 'API rate limiting', status: { name: 'Open' } },
              },
            },
          ],
        },
      },
    });
    render(<CopyPreviewModal />);
    expect(screen.getByText(/Blocks: CUST-200/)).toBeInTheDocument();
    expect(screen.getByText(/API rate limiting/)).toBeInTheDocument();
  });

  it('hides sub-tasks and linked issues rows when arrays are empty (COPY-05, COPY-06)', () => {
    currentStoreState = buildStoreState(); // mockSourceTicket has empty subtasks and issuelinks
    render(<CopyPreviewModal />);
    expect(screen.queryByText('Sub-tasks')).not.toBeInTheDocument();
    expect(screen.queryByText('Linked Issues')).not.toBeInTheDocument();
  });
});
