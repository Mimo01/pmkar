import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import type { JiraTicket } from '../tickets/types';
import { useGroupStore } from './groupStore';
import type { GroupErrorCode } from './types';

export function membershipErrorKey(code: GroupErrorCode): string {
  return code === 'not_found' ? 'groups.error.notFound' : 'groups.error.membership';
}

/** One atomic add for all tickets (D-16). Toasts the real inserted count. */
export async function addIssuesWithFeedback(
  group: { id: number; name: string },
  tickets: readonly JiraTicket[],
  t: TFunction,
): Promise<boolean> {
  const r = await useGroupStore.getState().addToGroup(group.id, tickets);
  if (!r.ok) {
    toast.error(t(membershipErrorKey(r.code)));
    return false;
  }
  const skipped = tickets.length - r.value;
  if (r.value === 0) {
    toast.info(t('groups.toast.allAlreadyIn', { name: group.name }));
  } else if (skipped > 0) {
    toast.success(
      t('groups.toast.addedWithSkipped', { count: r.value, skipped, name: group.name }),
    );
  } else {
    toast.success(t('groups.toast.added', { count: r.value, name: group.name }));
  }
  return true;
}

export async function removeIssuesWithFeedback(
  group: { id: number; name: string },
  issueKeys: readonly string[],
  t: TFunction,
): Promise<boolean> {
  const r = await useGroupStore.getState().removeFromGroup(group.id, issueKeys);
  if (!r.ok) {
    toast.error(t(membershipErrorKey(r.code)));
    return false;
  }
  toast.success(t('groups.toast.removed', { count: r.value, name: group.name }));
  return true;
}
