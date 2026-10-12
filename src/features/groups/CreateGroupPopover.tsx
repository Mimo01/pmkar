import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type GroupColorToken, pickDefaultColor } from './colors';
import { GroupColorSwatches } from './GroupColorSwatches';
import { GroupNameForm, useGroupNameForm } from './GroupNameForm';
import { useGroupStore } from './groupStore';

export function CreateGroupPopover({
  onCreated,
  triggerRef,
}: {
  onCreated: (groupId: number) => void;
  triggerRef?: React.Ref<HTMLButtonElement>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<GroupColorToken>('blue');
  const createdRef = useRef(false);
  const form = useGroupNameForm({ action: 'create' });

  function handleOpenChange(next: boolean) {
    if (next) {
      form.reset('');
      setColor(pickDefaultColor(useGroupStore.getState().groups.map((g) => g.color)));
      createdRef.current = false;
    }
    setOpen(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const r = await form.submit((d) => useGroupStore.getState().createGroup(d, color));
    if (!r || !r.ok) return;
    // If the follow-up hydrate failed, the new group is not in the store yet, so
    // its tab cannot be selected or focused. Close normally and let focus return
    // to the trigger instead of dropping it to <body>.
    const present = useGroupStore.getState().groups.some((g) => g.id === r.value.id);
    createdRef.current = present;
    setOpen(false);
    if (present) onCreated(r.value.id);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              ref={triggerRef}
              type="button"
              aria-label={t('groups.new')}
              className="flex items-center justify-center w-7 h-7 text-brand-text-secondary hover:text-brand-text rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent aria-hidden="true">{t('groups.new')}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        aria-label={t('groups.new')}
        onCloseAutoFocus={(e) => {
          if (createdRef.current) e.preventDefault();
        }}
      >
        <GroupNameForm
          title={t('groups.new')}
          submitLabel={t('groups.create')}
          form={form}
          onSubmit={handleSubmit}
          onCancel={() => handleOpenChange(false)}
        >
          <p className="mt-2 mb-1 text-xs text-brand-text-secondary">{t('groups.color.label')}</p>
          <GroupColorSwatches value={color} onSelect={setColor} selectionFollowsFocus />
        </GroupNameForm>
      </PopoverContent>
    </Popover>
  );
}
