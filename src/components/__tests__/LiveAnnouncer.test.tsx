import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { announce, LiveAnnouncer, useAnnouncerStore } from '../LiveAnnouncer';

describe('LiveAnnouncer', () => {
  beforeEach(() => {
    useAnnouncerStore.setState({ message: '', nonce: 0 });
  });

  it('renders one polite sr-only status region, initially empty', () => {
    render(<LiveAnnouncer />);
    const regions = screen.getAllByRole('status');
    expect(regions).toHaveLength(1);
    const el = regions[0];
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    expect(el.className).toContain('sr-only');
    expect(el.textContent).toBe('');
    expect(el.hasAttribute('tabindex')).toBe(false);
  });

  it('shows announced text', async () => {
    render(<LiveAnnouncer />);
    act(() => announce('X-1 moved to Dismissed.'));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('X-1 moved to Dismissed.'),
    );
  });

  it('re-announces identical text (clear then set)', async () => {
    render(<LiveAnnouncer />);
    act(() => announce('same'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('same'));
    act(() => announce('same'));
    expect(useAnnouncerStore.getState().nonce).toBe(2);
    expect(screen.getByRole('status').textContent).toBe('');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('same'));
  });

  it('renders markup as literal text', async () => {
    render(<LiveAnnouncer />);
    act(() => announce('<b>x</b>'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('<b>x</b>'));
    expect(screen.getByRole('status').querySelector('b')).toBeNull();
  });

  it('is mounted beside every Toaster in App.tsx', () => {
    const src = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');
    const toasters = src.split('<Toaster />').length - 1;
    const announcers = src.split('<LiveAnnouncer />').length - 1;
    expect(toasters).toBeGreaterThanOrEqual(5);
    expect(announcers).toBe(toasters);
  });
});
