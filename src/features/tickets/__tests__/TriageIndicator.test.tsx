import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { TriageIndicator } from '../TriageIndicator';

const mockInvoke = vi.mocked(invoke);

describe('TriageIndicator', () => {
  it('renders a dot indicator for new state', () => {
    const { container } = render(<TriageIndicator state="new" />);
    // The "new" indicator has a span with "New" sr-only text
    expect(container.querySelector('.rounded-full')).toBeTruthy();
  });

  it('renders sr-only "New" text for new state', () => {
    render(<TriageIndicator state="new" />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders a checkmark icon for copied state', () => {
    const { container } = render(<TriageIndicator state="copied" />);
    // SVG polyline is the checkmark
    expect(container.querySelector('polyline')).toBeTruthy();
  });

  it('renders the copiedKey as a button when state is copied and copiedKey is provided', () => {
    render(
      <TriageIndicator
        state="copied"
        copiedKey="CLOUD-42"
        cloudBaseUrl="https://company.atlassian.net"
      />,
    );
    expect(screen.getByRole('button', { name: /CLOUD-42/i })).toBeInTheDocument();
  });

  it('calls invoke with open_external_url when copiedKey button is clicked', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <TriageIndicator
        state="copied"
        copiedKey="CLOUD-42"
        cloudBaseUrl="https://company.atlassian.net"
      />,
    );

    await user.click(screen.getByRole('button', { name: /CLOUD-42/i }));
    expect(mockInvoke).toHaveBeenCalledWith('open_external_url', {
      url: 'https://company.atlassian.net/browse/CLOUD-42',
    });
  });

  it('renders ignored indicator for ignored state', () => {
    render(<TriageIndicator state="ignored" />);
    // The ignored indicator shows 'Dismiss' (en translation of 'detail.ignore')
    expect(screen.getByText(/dismiss|detail\.ignore/i)).toBeInTheDocument();
  });

  it('renders empty span for seen state', () => {
    const { container } = render(<TriageIndicator state="seen" />);
    // The fallback renders a w-4 h-4 span, not any text
    const emptySpan = container.querySelector('span[aria-hidden="true"]');
    expect(emptySpan).toBeTruthy();
  });

  it('renders empty span when state is undefined', () => {
    const { container } = render(<TriageIndicator state={undefined} />);
    expect(container.querySelector('span[aria-hidden="true"]')).toBeTruthy();
  });

  it('renders copied state without button when no copiedKey', () => {
    render(<TriageIndicator state="copied" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
