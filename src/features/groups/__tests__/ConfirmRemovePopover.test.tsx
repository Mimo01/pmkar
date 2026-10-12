import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../../i18n/index';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { ConfirmRemovePopover } from '../ConfirmRemovePopover';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

function TriggerHarness({ onConfirm }: { onConfirm: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <ConfirmRemovePopover
      open={open}
      onOpenChange={setOpen}
      question="Remove it?"
      onConfirm={onConfirm}
      trigger={<button type="button">open</button>}
    />
  );
}

describe('ConfirmRemovePopover (trigger)', () => {
  it('WR-08: confirmDisabledReason disables Remove and explains why', async () => {
    const onConfirm = vi.fn(async () => {});
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <ConfirmRemovePopover
          open={open}
          onOpenChange={setOpen}
          question="Remove it?"
          onConfirm={onConfirm}
          confirmDisabledReason="Busy refreshing"
          trigger={<button type="button">open</button>}
        />
      );
    }
    renderWithI18n(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Busy refreshing');
    const remove = screen.getByRole('button', { name: 'Remove' });
    expect(remove).toBeDisabled();
    await user.click(remove);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Remove it?')).toBeTruthy();
  });

  it('opens with Cancel focused; Cancel does not confirm', async () => {
    const onConfirm = vi.fn(async () => {});
    const user = userEvent.setup();
    renderWithI18n(<TriggerHarness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'open' }));
    expect(await screen.findByText('Remove it?')).toBeTruthy();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await user.click(cancel);
    await waitFor(() => expect(screen.queryByText('Remove it?')).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape closes', async () => {
    const user = userEvent.setup();
    renderWithI18n(<TriggerHarness onConfirm={async () => {}} />);
    await user.click(screen.getByRole('button', { name: 'open' }));
    await screen.findByText('Remove it?');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Remove it?')).toBeNull());
  });

  it('Remove confirms once, disables while pending, then closes', async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const user = userEvent.setup();
    renderWithI18n(<TriggerHarness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'open' }));
    const remove = await screen.findByRole('button', { name: 'Remove' });
    await user.click(remove);
    await user.click(remove);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect((remove as HTMLButtonElement).disabled).toBe(true);
    resolve();
    await waitFor(() => expect(screen.queryByText('Remove it?')).toBeNull());
  });
});

describe('ConfirmRemovePopover (virtual anchor)', () => {
  it('renders when open and returns focus on close', async () => {
    const onReturnFocus = vi.fn();
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const anchorRef = { current: anchor };
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <ConfirmRemovePopover
          open={open}
          onOpenChange={setOpen}
          question="Remove many?"
          onConfirm={async () => {}}
          anchorRef={anchorRef}
          onReturnFocus={onReturnFocus}
        />
      );
    }
    const user = userEvent.setup();
    renderWithI18n(<Harness />);
    expect(await screen.findByText('Remove many?')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(onReturnFocus).toHaveBeenCalled());
  });
});
