import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Placeholder — CopyPreviewModal will be created in Plan 04
// import { CopyPreviewModal } from './CopyPreviewModal';

describe('CopyPreviewModal', () => {
  it.todo('renders source fields on left column (COPY-01, COPY-08)');
  it.todo('renders editable target fields on right column (COPY-08)');
  it.todo('populates status dropdown from cloudMeta.availableStatuses (COPY-01)');
  it.todo('populates priority dropdown from cloudMeta.availablePriorities (COPY-01)');
  it.todo('renders label checkboxes, all checked by default (COPY-01, D-09)');
  it.todo('shows description preview using DescriptionRenderer (COPY-09, D-05)');
  it.todo('Discard Preview button resets copyStore (COPY-08)');
  it.todo('Confirm button invokes copy_ticket with selected values (COPY-01)');
  it.todo('displays status note about project default (status limitation)');
});
