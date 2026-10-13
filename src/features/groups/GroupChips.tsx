import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { countPillClass } from './CountPill';
import { groupColorStyle } from './colors';
import { CardGroupChip, GroupChipLabel, groupChipClass } from './GroupChip';
import { selectGroupIdsForIssue, useGroupStore } from './groupStore';

const MAX_VISIBLE = 2;

export function GroupChips({ issueKey, hideGroupId }: { issueKey: string; hideGroupId?: number }) {
  const { t } = useTranslation();
  const ids = useGroupStore(selectGroupIdsForIssue(issueKey));
  const groups = useGroupStore((s) => s.groups);
  const chips = useMemo(() => {
    const set = new Set(ids ?? []);
    return groups.filter((g) => set.has(g.id) && g.id !== hideGroupId);
  }, [ids, groups, hideGroupId]);

  if (chips.length === 0) return null;
  const rest = chips.slice(MAX_VISIBLE);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="ml-auto flex items-center gap-1 shrink-0 min-w-0">
        {chips.slice(0, MAX_VISIBLE).map((g) => (
          <CardGroupChip key={g.id} group={g} />
        ))}
        {rest.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t('groups.chip.moreAria', {
                  count: rest.length,
                  names: rest.map((g) => g.name).join(', '),
                })}
                onClick={(e) => e.stopPropagation()}
                className={`${countPillClass()} relative z-10 cursor-pointer hover:text-brand-text focus-visible:outline-2 focus-visible:outline-focus-ring`}
              >
                {t('groups.chip.more', { count: rest.length })}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex flex-col items-start gap-1">
                {rest.map((g) => (
                  <span
                    key={g.id}
                    style={groupColorStyle(g.color)}
                    className={`px-2 ${groupChipClass}`}
                  >
                    <GroupChipLabel group={g} />
                  </span>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
