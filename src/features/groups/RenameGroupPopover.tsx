import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { GroupNameForm, useGroupNameForm } from './GroupNameForm';
import { useGroupStore } from './groupStore';
import type { Group } from './types';

export function RenameGroupPopover({
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
  const form = useGroupNameForm({
    action: 'rename',
    excludeGroupId: group?.id,
    originalName: group?.name,
  });
  const { reset } = form;
  const groupId = group?.id;
  const groupName = group?.name;

  // State resets on every open or group switch (D-06), not on each rename hydrate.
  // Seeded during render (not in an effect) so the autoFocus input mounts with the
  // name already in place and select-on-focus covers the whole existing name.
  const openKey = open && groupId !== undefined ? groupId : null;
  const [seededKey, setSeededKey] = useState<number | null>(null);
  if (openKey !== seededKey) {
    setSeededKey(openKey);
    if (openKey !== null && groupName !== undefined) reset(groupName);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!group) return;
    const id = group.id;
    const r = await form.submit((d) => useGroupStore.getState().renameGroup(id, d));
    if (r?.ok) onOpenChange(false);
  }

  return (
    <Popover open={open && group !== null} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        align="start"
        className="w-[280px] p-4"
        aria-label={t('groups.rename.title')}
        onCloseAutoFocus={(e) => {
          // No PopoverTrigger exists, so focus is returned explicitly (D-08).
          e.preventDefault();
          onReturnFocus();
        }}
      >
        <GroupNameForm
          title={t('groups.rename.title')}
          submitLabel={t('groups.rename.submit')}
          form={form}
          selectOnFocus
          onCancel={() => onOpenChange(false)}
          onSubmit={handleSubmit}
        />
      </PopoverContent>
    </Popover>
  );
}
