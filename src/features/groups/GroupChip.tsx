import { Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { groupColorStyle } from './colors';
import { useGroupNavigation } from './NavigationContext';
import type { Group } from './types';

/**
 * Shared chip look: a neutral app-surface chip (rounded-md, hairline border,
 * text-xs font-medium, neutral text). The group color lives only in the
 * leading filled tag glyph, so chips sit quietly next to status badges.
 */
export const groupChipClass =
  'inline-flex items-center gap-1 h-5 rounded-md text-xs font-medium border border-brand-border bg-brand-surface-hover text-brand-text';

/** Leading tag glyph in the group color; decorative, never the only signal. */
export function GroupChipIcon() {
  return (
    <Tag
      className="h-3 w-3 shrink-0 fill-(--group-color) text-(--group-color)"
      aria-hidden="true"
    />
  );
}

/** Non-interactive chip label: truncated name with a full-name tooltip. */
export function GroupChipLabel({ group }: { group: Group }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 min-w-0">
          <GroupChipIcon />
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
      className={`relative z-10 pl-1.5 pr-2 ${groupChipClass} hover:border-brand-text-secondary/50 cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-ring`}
    >
      <GroupChipLabel group={group} />
    </button>
  );
}
