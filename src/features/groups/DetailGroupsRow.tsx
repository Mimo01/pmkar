import { ChevronDown, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { JiraTicketDetail } from '../tickets/types';
import { groupColorStyle } from './colors';
import { resolveTicketForIssue } from './detailToTicket';
import { GroupChipLabel, groupChipClass } from './GroupChip';
import { GroupPicker } from './GroupPicker';
import { selectGroupIdsForIssue, useGroupStore } from './groupStore';
import { membershipErrorKey } from './membershipActions';
import { useGroupNavigation } from './NavigationContext';
import type { Group } from './types';

function afterUnmount(fn: () => void) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn);
  else setTimeout(fn, 0);
}

/** Groups button (checkbox picker) plus membership chips with confirmed remove. */
export function DetailGroupsRow({
  issueKey,
  detail,
}: {
  issueKey: string;
  detail: JiraTicketDetail | null;
}) {
  const { t } = useTranslation();
  const { navigateToGroup } = useGroupNavigation();
  const ids = useGroupStore(selectGroupIdsForIssue(issueKey));
  const groups = useGroupStore((s) => s.groups);
  const chips = useMemo(() => {
    const set = new Set(ids ?? []);
    return groups.filter((g) => set.has(g.id));
  }, [ids, groups]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmGroupId, setConfirmGroupId] = useState<number | null>(null);
  const groupsButtonRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inFlightRef = useRef(false);

  async function handleRemove(g: Group) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const r = await useGroupStore.getState().removeFromGroup(g.id, [issueKey]);
      setConfirmGroupId(null);
      if (!r.ok) {
        toast.error(t(membershipErrorKey(r.code)));
        return;
      }
      // The chip (and its × trigger) is gone, so land focus on the Groups button.
      afterUnmount(() => groupsButtonRef.current?.focus());
    } finally {
      inFlightRef.current = false;
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <GroupPicker
          mode="checkbox"
          issueKey={issueKey}
          resolveTicket={() => resolveTicketForIssue(issueKey, detail)}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
        >
          <Button ref={groupsButtonRef} variant="outline" size="sm">
            {t('groups.picker.button')}
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          </Button>
        </GroupPicker>

        {chips.map((g) => (
          <span key={g.id} style={groupColorStyle(g.color)} className={`pl-1 ${groupChipClass}`}>
            <button
              type="button"
              aria-label={t('groups.chip.goTo', { name: g.name })}
              onClick={() => navigateToGroup(g.id)}
              className="inline-flex items-center px-1 hover:text-brand-text cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-ring"
            >
              <GroupChipLabel group={g} />
            </button>
            <Popover
              open={confirmGroupId === g.id}
              onOpenChange={(o) => setConfirmGroupId(o ? g.id : null)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t('groups.chip.remove', { name: g.name })}
                  className="inline-flex items-center justify-center h-5 w-5 rounded-md text-brand-text-secondary hover:text-brand-text cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-ring"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-70 p-4"
                aria-label={t('groups.chip.removeConfirm', { name: g.name })}
                onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  cancelRef.current?.focus();
                }}
              >
                <p className="text-sm font-semibold text-brand-text mb-3">
                  {t('groups.chip.removeConfirm', { name: g.name })}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    ref={cancelRef}
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmGroupId(null)}
                  >
                    {t('groups.cancel')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-white"
                    onClick={() => void handleRemove(g)}
                  >
                    {t('groups.confirm.remove')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </span>
        ))}
      </div>
    </TooltipProvider>
  );
}
