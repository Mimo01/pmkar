import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { groupColorVar } from './colors';
import { useGroupNavigation } from './NavigationContext';
import type { Group } from './types';

/** Non-interactive chip label: color dot plus truncated name, with a full-name tooltip. */
export function GroupChipLabel({ group }: { group: Group }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 min-w-0">
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: groupColorVar(group.color) }}
          />
          <span className="max-w-[160px] truncate">{group.name}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent aria-hidden="true">{group.name}</TooltipContent>
    </Tooltip>
  );
}

/** Card chip: navigates to the group view without opening ticket detail. */
export function CardGroupChip({ group }: { group: Group }) {
  const { t } = useTranslation();
  const { navigateToGroup } = useGroupNavigation();
  return (
    <button
      type="button"
      aria-label={t('groups.chip.goTo', { name: group.name })}
      onClick={(e) => {
        e.stopPropagation();
        navigateToGroup(group.id);
      }}
      className="relative z-10 inline-flex items-center h-5 px-1 rounded border border-brand-border-subtle text-xs text-brand-text-secondary hover:text-brand-text cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-ring"
    >
      <GroupChipLabel group={group} />
    </button>
  );
}
