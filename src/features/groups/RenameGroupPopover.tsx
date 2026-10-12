import { useEffect } from 'react';
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

  // State resets on every open (D-06).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when opening or switching group, not on each rename hydrate
  useEffect(() => {
    if (open && groupName !== undefined) reset(groupName);
  }, [open, groupId]);

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
