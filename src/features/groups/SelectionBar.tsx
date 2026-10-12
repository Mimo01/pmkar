import { ChevronDown, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { JiraTicket } from '../tickets/types';
import { GroupPicker } from './GroupPicker';
import { removeIssuesWithFeedback } from './membershipActions';
import type { Group } from './types';

export interface SelectionBarProps {
  selectedTickets: readonly JiraTicket[];
  /** Set in a group view: enables "Remove from group" and excludes it from the Add picker. */
  group?: Group | null;
  onClear: () => void;
  /** Called only after a bulk add/remove succeeded. */
  onActionSucceeded: () => void;
}

export function SelectionBar({
  selectedTickets,
  group,
  onClear,
  onActionSucceeded,
}: SelectionBarProps) {
  const { t } = useTranslation();
  const count = selectedTickets.length;
  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const inFlightRemoveRef = useRef(false);

  async function handleRemove() {
    if (!group || inFlightRemoveRef.current) return;
    inFlightRemoveRef.current = true;
    try {
      const ok = await removeIssuesWithFeedback(
        { id: group.id, name: group.name },
        selectedTickets.map((x) => x.key),
        t,
      );
      setRemoveOpen(false);
      if (ok) onActionSucceeded();
    } finally {
      inFlightRemoveRef.current = false;
    }
  }

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {count > 0 ? t('groups.bar.count', { count }) : ''}
      </div>
      {count > 0 && (
        <TooltipProvider delayDuration={300}>
          <div
            role="toolbar"
            aria-label={t('groups.bar.count', { count })}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-[560px] h-12 px-4 flex items-center gap-2 rounded-lg border border-brand-border bg-popover shadow-lg transition-opacity duration-150 motion-reduce:transition-none"
          >
            <span aria-hidden="true" className="text-sm font-semibold text-brand-text">
              {t('groups.bar.count', { count })}
            </span>
            <GroupPicker
              mode="list"
              tickets={selectedTickets}
              excludeGroupId={group?.id}
              side="top"
              align="start"
              open={addOpen}
              onOpenChange={setAddOpen}
              onAddSucceeded={onActionSucceeded}
            >
              <Button variant="outline" size="sm">
                {t('groups.bar.add')}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </GroupPicker>
            {group && (
              <Popover open={removeOpen} onOpenChange={setRemoveOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {t('groups.bar.remove')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-70 p-4"
                  side="top"
                  onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    cancelRef.current?.focus();
                  }}
                >
                  <p className="text-sm font-semibold text-brand-text mb-3">
                    {t('groups.bar.removeConfirm', { count, name: group.name })}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      ref={cancelRef}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRemoveOpen(false)}
                    >
                      {t('groups.cancel')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="text-white"
                      onClick={handleRemove}
                    >
                      {t('groups.confirm.remove')}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-7 w-7"
                  aria-label={t('groups.bar.clear')}
                  onClick={onClear}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('groups.bar.clear')}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}
    </>
  );
}
