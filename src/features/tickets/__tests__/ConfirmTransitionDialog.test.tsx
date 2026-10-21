import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { ConfirmTransitionDialog, type ConfirmTransitionTarget } from '../ConfirmTransitionDialog';

const deny: ConfirmTransitionTarget = { kind: 'deny', ticketKey: 'SRV-1', cloudKey: 'CLD-9' };
const link: ConfirmTransitionTarget = { kind: 'link', ticketKey: 'SRV-1', cloudKey: 'CLD-9' };
const watch: ConfirmTransitionTarget = { kind: 'watch', ticketKey: 'ABC-1', cloudKey: 'CLOUD-7' };

function Wrapper({
  initial,
  onResolve,
  onClosed,
}: {
  initial: ConfirmTransitionTarget | null;
  onResolve: (c: boolean) => void;
  onClosed: (c: boolean) => void;
}) {
  const [target, setTarget] = useState<ConfirmTransitionTarget | null>(initial);
  return (
    <ConfirmTransitionDialog
      target={target}
      onResolve={(c) => {
        onResolve(c);
        setTarget(null);
      }}
      onClosed={onClosed}
    />
  );
}

function setup(initial: ConfirmTransitionTarget | null) {
  const onResolve = vi.fn();
  const onClosed = vi.fn();
  const view = renderWithI18n(
    <Wrapper initial={initial} onResolve={onResolve} onClosed={onClosed} />,
  );
  return { onResolve, onClosed, view, user: userEvent.setup() };
}

describe('ConfirmTransitionDialog', () => {
  it('renders nothing when target is null', () => {
    setup(null);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('deny variant renders title, body and buttons', async () => {
    setup(deny);
    const dlg = await screen.findByRole('alertdialog', { name: 'Move SRV-1 to Dismissed?' });
    expect(dlg.textContent).toContain('CLD-9');
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Cancel', 'Move to Dismissed']);
  });

  it('link variant renders title and confirm button', async () => {
    setup(link);
    await screen.findByRole('alertdialog', { name: 'Restore link to CLD-9?' });
    expect(screen.getByRole('button', { name: 'Restore link' })).toBeTruthy();
  });

  it('focuses Cancel on open', async () => {
    setup(deny);
    await screen.findByRole('alertdialog');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' })),
    );
  });

  it('Cancel resolves false and onClosed receives false', async () => {
    const { user, onResolve, onClosed } = setup(deny);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onResolve).toHaveBeenCalledWith(false);
    await waitFor(() => expect(onClosed).toHaveBeenCalledWith(false));
  });

  it('Escape resolves false', async () => {
    const { user, onResolve, onClosed } = setup(deny);
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    expect(onResolve).toHaveBeenCalledWith(false);
    await waitFor(() => expect(onClosed).toHaveBeenCalledWith(false));
  });

  it('Confirm resolves true exactly once, even on double click', async () => {
    const onResolve = vi.fn();
    const onClosed = vi.fn();
    // Parent that keeps the target open so a second click could reach the handler.
    renderWithI18n(
      <ConfirmTransitionDialog target={deny} onResolve={onResolve} onClosed={onClosed} />,
    );
    const btn = await screen.findByRole('button', { name: 'Move to Dismissed' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith(true);
  });

  it('onClosed receives true after Confirm', async () => {
    const { user, onClosed } = setup(deny);
    await user.click(await screen.findByRole('button', { name: 'Move to Dismissed' }));
    await waitFor(() => expect(onClosed).toHaveBeenCalledWith(true));
  });

  it('pointer down outside does not resolve', async () => {
    const { onResolve } = setup(deny);
    await screen.findByRole('alertdialog');
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);
    expect(onResolve).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('confirm button is not destructive', async () => {
    setup(deny);
    const btn = await screen.findByRole('button', { name: 'Move to Dismissed' });
    expect(btn.className).not.toContain('bg-destructive');
  });

  it('has no axe violations', async () => {
    setup(deny);
    const dlg = await screen.findByRole('alertdialog');
    expect(await axe(dlg)).toHaveNoViolations();
  });

  it('watch variant renders title, body, confirm and focuses Cancel', async () => {
    setup(watch);
    const dlg = await screen.findByRole('alertdialog', { name: 'Move ABC-1 to Watched?' });
    expect(dlg.textContent).toContain('CLOUD-7');
    expect(screen.getByRole('button', { name: 'Move to Watched' })).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' })),
    );
  });

  it('watch variant Confirm resolves true once', async () => {
    const onResolve = vi.fn();
    renderWithI18n(
      <ConfirmTransitionDialog target={watch} onResolve={onResolve} onClosed={vi.fn()} />,
    );
    const btn = await screen.findByRole('button', { name: 'Move to Watched' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith(true);
  });

  it('watch variant Cancel resolves false', async () => {
    const { user, onResolve } = setup(watch);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onResolve).toHaveBeenCalledWith(false);
  });

  it('watch variant has no axe violations', async () => {
    setup(watch);
    const dlg = await screen.findByRole('alertdialog');
    expect(await axe(dlg)).toHaveNoViolations();
  });
});
