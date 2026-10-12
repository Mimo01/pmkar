import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import type { GroupColorToken } from './colors';
import { GroupColorSwatches } from './GroupColorSwatches';
import { useGroupStore } from './groupStore';
import type { Group } from './types';

export function ChangeColorPopover({
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
  const inFlightRef = useRef(false);

  async function handlePick(token: GroupColorToken) {
    if (!group) return;
    if (token === group.color) {
      onOpenChange(false);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const id = group.id;
    // Applies immediately; there is no confirm button (D-09).
    onOpenChange(false);
    try {
      const r = await useGroupStore.getState().setGroupColor(id, token);
      if (!r.ok) {
        toast.error(t(r.code === 'not_found' ? 'groups.error.notFound' : 'groups.error.color'));
      }
    } finally {
      inFlightRef.current = false;
    }
  }

  return (
    <Popover open={open && group !== null} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        align="start"
        className="w-[280px] p-4"
        aria-label={t('groups.color.title')}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onReturnFocus();
        }}
      >
        {group && (
          <>
            <h2 className="text-base font-semibold text-brand-text mb-3">
              {t('groups.color.title')}
            </h2>
            <GroupColorSwatches
              value={group.color}
              selectionFollowsFocus={false}
              autoFocus
              onSelect={handlePick}
            />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
