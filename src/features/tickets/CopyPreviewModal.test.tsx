import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock connectionStore
vi.mock('../connections/connectionStore', () => ({
  useConnectionStore: Object.assign(
    (selector: (s: any) => any) =>
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
    status: { name: 'Open', id: '1' },
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
    setTargetStatus: mockSetTargetStatus,
    setTargetPriorityId: mockSetTargetPriorityId,
    toggleLabel: mockToggleLabel,
    startPreview: vi.fn(),
    ...overrides,
  };
}

// Mock copyStore using a factory so per-test state overrides work
vi.mock('./copyStore', () => ({
  useCopyStore: Object.assign(
    (selector: (s: any) => any) => selector(currentStoreState),
    { getState: () => currentStoreState },
  ),
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

    // Editable select elements for status and priority
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);

    // Checkboxes for labels
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
  });

  it('populates status dropdown from cloudMeta.availableStatuses (COPY-01)', () => {
    render(<CopyPreviewModal />);

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('populates priority dropdown from cloudMeta.availablePriorities (COPY-01)', () => {
    render(<CopyPreviewModal />);

    expect(screen.getByText('Highest')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders label checkboxes, all checked by default (COPY-01, D-09)', () => {
    render(<CopyPreviewModal />);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.length).toBe(2);
    checkboxes.forEach((cb) => {
      expect(cb.checked).toBe(true);
    });
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

  it('Confirm button invokes copy_ticket with selected values (COPY-01)', () => {
    render(<CopyPreviewModal />);

    fireEvent.click(screen.getByText('Copy to Company Jira'));

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

  it('shows "No labels on source ticket" when ticket has no labels', () => {
    currentStoreState = buildStoreState({ targetLabels: [], selectedLabels: [] });

    render(<CopyPreviewModal />);
    expect(screen.getByText('No labels on source ticket')).toBeInTheDocument();
  });
});
