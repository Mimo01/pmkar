import { Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { groupColorStyle } from './colors';
import { useGroupNavigation } from './NavigationContext';
import type { Group } from './types';

/**
 * Shared chip look: rounded-md, text-xs font-medium, neutral text on a surface
 * lightly tinted with the group color and a group-tinted hairline border
 * (`group-chip` in index.css), led by a filled tag glyph in the group color.
 */
export const groupChipClass =
  'inline-flex items-center gap-1 h-5 rounded-md text-xs font-medium border group-chip text-brand-text';

/** Leading tag glyph in the group color; decorative, never the only signal. */
export function GroupChipIcon() {
  return (
    <Tag
      className="h-3 w-3 shrink-0 fill-(--group-color) text-(--group-color)"
      aria-hidden="true"
    />
  );
}

/** Non-interactive chip label: tag glyph and truncated name. */
export function GroupChipLabel({ group }: { group: Group }) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <GroupChipIcon />
      <span className="max-w-[160px] truncate">{group.name}</span>
    </span>
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
        // detail is 0 for keyboard activation; only then hand focus to the tab.
        navigateToGroup(group.id, { focusTab: e.detail === 0 });
      }}
      style={groupColorStyle(group.color)}
      className={`relative z-10 pl-1.5 pr-2 ${groupChipClass} hover:group-chip-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-ring`}
    >
      <GroupChipLabel group={group} />
    </button>
  );
}
