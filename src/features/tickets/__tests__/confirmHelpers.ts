import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect } from 'vitest';
import i18n from '../../../i18n/index';

async function clickInDialog(name: string): Promise<void> {
  const dlg = await screen.findByRole('alertdialog');
  fireEvent.click(within(dlg).getByRole('button', { name }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
}

export async function confirmDeny(): Promise<void> {
  await clickInDialog(i18n.t('triage.confirm.deny.action', { tab: i18n.t('nav.notMine') }));
}

export async function confirmLink(): Promise<void> {
  await clickInDialog(i18n.t('triage.confirm.link.action'));
}

export async function confirmWatch(): Promise<void> {
  await clickInDialog(i18n.t('triage.confirm.watch.action'));
}

export async function cancelConfirm(): Promise<void> {
  await clickInDialog(i18n.t('triage.confirm.cancel'));
}

export function expectNoConfirmDialog(): void {
  expect(screen.queryByRole('alertdialog')).toBeNull();
}
