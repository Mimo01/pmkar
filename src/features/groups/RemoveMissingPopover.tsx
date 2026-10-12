import { useTranslation } from 'react-i18next';
import { useRemovalBlockedByFetch } from '../tickets/useHintsEligible';

import { ConfirmRemovePopover } from './ConfirmRemovePopover';
import { removeAllMissingWithFeedback } from './membershipActions';
import { readMissingKeysNow, useMissingKeysByGroup } from './missingMembers';
import type { Group } from './types';

/** Tab-anchored "Remove all missing" confirm (D-11), focus returns to the group trigger. */
export function RemoveMissingPopover({
  group,
  open,
  anchorRef,
  onOpenChange,
  onReturnFocus,
}: {
  group: Group | null;
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
}) {
  const { t } = useTranslation();
  const missingByGroup = useMissingKeysByGroup();
  const fetching = useRemovalBlockedByFetch();
  if (!group) return null;
  const count = missingByGroup.get(group.id)?.size ?? 0;

  return (
    <ConfirmRemovePopover
      open={open}
      onOpenChange={onOpenChange}
      anchorRef={anchorRef}
      align="start"
      onReturnFocus={onReturnFocus}
      question={t('groups.missing.removeAllConfirm', { count, name: group.name })}
      confirmDisabledReason={fetching ? t('groups.missing.refreshing') : null}
      onConfirm={async () => {
        // Race guard (T-32-23): recompute at confirm time; nothing missing means no removal.
        const keys = readMissingKeysNow(group.id);
        if (keys.size === 0) return;
        await removeAllMissingWithFeedback(group, [...keys], t);
      }}
    />
  );
}
