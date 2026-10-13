import { Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { groupColorStyle } from './colors';
import { useGroupNavigation } from './NavigationContext';
import type { Group } from './types';

/**
 * Shared chip look: a vivid group-color pill with a top sheen, a soft
 * group-tinted shadow (`group-chip-sheen` in index.css), a tag glyph and one
 * shared dark label color.
 */
export const groupChipClass =
  'inline-flex items-center gap-1 h-5 rounded-full text-xs font-semibold bg-(--group-color) group-chip-sheen text-(--group-chip-text)';

/** Leading tag glyph shared by every chip; decorative, never the only signal. */
export function GroupChipIcon() {
  return <Tag className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2.4} aria-hidden="true" />;
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
      className={`relative z-10 pl-1.5 pr-2 ${groupChipClass} hover:brightness-110 cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-ring`}
    >
      <GroupChipLabel group={group} />
    </button>
  );
}
