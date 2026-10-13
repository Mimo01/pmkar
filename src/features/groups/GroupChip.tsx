import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { groupColorStyle } from './colors';
import { useGroupNavigation } from './NavigationContext';
import type { Group } from './types';

/**
 * Shared chip look: button-like rounded-md, text-xs font-medium, a solid
 * group-color fill with one shared dark label color.
 */
export const groupChipClass =
  'inline-flex items-center h-5 rounded-md text-xs font-medium bg-(--group-color) text-(--group-chip-text)';

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
      className={`relative z-10 px-2 ${groupChipClass} hover:brightness-110 cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-ring`}
    >
      <GroupChipLabel group={group} />
    </button>
  );
}
