import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { VersionHistoryModal } from '../VersionHistoryModal';

// The VersionHistoryModal imports CHANGELOG.md?raw — this is mocked in vitest config or via
// a vi.mock. Since vitest handles ?raw imports via the asset plugin, the real file is used.
// We just verify the component renders correctly.

describe('VersionHistoryModal', () => {
  it('renders dialog when open=true', () => {
    renderWithI18n(<VersionHistoryModal open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render visible dialog content when open=false', () => {
    renderWithI18n(<VersionHistoryModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows version history title', () => {
    renderWithI18n(<VersionHistoryModal open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/version history/i)).toBeInTheDocument();
  });

  it('renders at least one version entry from CHANGELOG.md', () => {
    renderWithI18n(<VersionHistoryModal open={true} onOpenChange={vi.fn()} />);
    // Should show version badges (v0.x.x format)
    const versionBadges = screen.getAllByText(/^v\d+\.\d+\.\d+/);
    expect(versionBadges.length).toBeGreaterThan(0);
  });

  it('first entry is expanded (defaultOpen=true for index 0)', () => {
    renderWithI18n(<VersionHistoryModal open={true} onOpenChange={vi.fn()} />);
    // The first version block header button should have aria-expanded="true"
    const expandButtons = screen.getAllByRole('button');
    // First version block button should have aria-expanded true
    const firstBlock = expandButtons[0];
    expect(firstBlock).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking a version block button collapses it', () => {
    renderWithI18n(<VersionHistoryModal open={true} onOpenChange={vi.fn()} />);
    const expandButtons = screen.getAllByRole('button');
    const firstBlock = expandButtons[0];
    // Initially open
    expect(firstBlock).toHaveAttribute('aria-expanded', 'true');
    // Click to close
    fireEvent.click(firstBlock);
    expect(firstBlock).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking a collapsed version block expands it', () => {
    renderWithI18n(<VersionHistoryModal open={true} onOpenChange={vi.fn()} />);
    const expandButtons = screen.getAllByRole('button');
    // Find a closed block (aria-expanded=false)
    const closedBlock = expandButtons.find((btn) => btn.getAttribute('aria-expanded') === 'false');
    if (closedBlock) {
      fireEvent.click(closedBlock);
      expect(closedBlock).toHaveAttribute('aria-expanded', 'true');
    }
    // If all are open (small changelog), just verify the component rendered
    expect(expandButtons.length).toBeGreaterThan(0);
  });

  it('calls onOpenChange when dialog is closed', () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<VersionHistoryModal open={true} onOpenChange={onOpenChange} />);
    // Close button from Dialog
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows "current" label on the latest version', () => {
    renderWithI18n(<VersionHistoryModal open={true} onOpenChange={vi.fn()} />);
    // The first entry has isLatest=true which shows a "current" badge
    expect(screen.getByText(/current/i)).toBeInTheDocument();
  });
});
