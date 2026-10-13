import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { groupColorStyle } from './colors';
import { useGroupNavigation } from './NavigationContext';
import type { Group } from './types';

/** Shared tinted chip look: soft group-color tint, stronger border, neutral text. */
export const groupChipClass =
  'border border-(--group-color)/45 bg-(--group-color)/12 text-brand-text';

/** Non-interactive chip label: truncated name with a full-name tooltip. */
export function GroupChipLabel({ group }: { group: Group }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 min-w-0">
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
      style={groupColorStyle(group.color)}
      className={`relative z-10 inline-flex items-center h-5 px-1.5 rounded ${groupChipClass} text-xs hover:bg-(--group-color)/20 cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-ring`}
    >
      <GroupChipLabel group={group} />
    </button>
  );
}
