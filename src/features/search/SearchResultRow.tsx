import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { groupColorStyle } from '../groups/colors';
import { GroupChipLabel, groupChipClass } from '../groups/GroupChip';
import { selectGroupIdsForIssue, useGroupStore } from '../groups/groupStore';
import { PriorityIcon } from '../tickets/PriorityIcon';
import { UserAvatar } from '../tickets/UserAvatar';
import { Highlight } from './Highlight';
import type { SearchHit } from './types';

interface SearchResultRowProps {
  hit: SearchHit;
  words: readonly string[];
  id: string;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}

export function SearchResultRow({
  hit,
  words,
  id,
  active,
  onSelect,
  onHover,
}: SearchResultRowProps) {
  const { t } = useTranslation();
  const { ticket, category } = hit.item;
  const key = ticket.key;
  const ids = useGroupStore(selectGroupIdsForIssue(key));
  const groups = useGroupStore((s) => s.groups);
  const chips = useMemo(() => {
    const set = new Set(ids ?? []);
    return groups.filter((g) => set.has(g.id));
  }, [ids, groups]);

  const priorityName = ticket.fields.priority?.name ?? '';
  const assignee = ticket.fields.assignee;

  let badge: string | null = null;
  switch (category) {
    case 'new':
      badge = t('search.badge.new');
      break;
    case 'dismissed':
      badge = t('search.badge.dismissed');
      break;
    case 'linked':
      badge = t('search.badge.linked');
      break;
    case 'watched':
      badge = t('search.badge.watched');
      break;
    default:
      badge = null;
  }

  let prefix = '';
  if (hit.snippet) {
    switch (hit.snippet.field) {
      case 'assignee':
        prefix = t('search.field.assignee');
        break;
      case 'labels':
        prefix = t('search.field.labels');
        break;
      case 'components':
        prefix = t('search.field.components');
        break;
      case 'fixVersions':
        prefix = t('search.field.fixVersions');
        break;
      case 'copiedKey':
        prefix = t('search.field.copiedKey');
        break;
      default:
        prefix = '';
    }
  }

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: aria-activedescendant pattern, focus stays in the input
    <li
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: listbox option inside ul per combobox pattern
      role="option"
      id={id}
      aria-selected={active}
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      onMouseEnter={onHover}
      className={`px-4 py-2 min-h-12 flex flex-col gap-1 cursor-pointer transition-colors duration-100 motion-reduce:transition-none hover:bg-brand-surface-hover ${
        active ? 'bg-brand-surface-hover' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-brand-text-secondary whitespace-nowrap">
          <Highlight text={key} words={words} />
        </span>
        <span className="text-sm text-brand-text truncate flex-1 min-w-0">
          <Highlight text={ticket.fields.summary} words={words} />
        </span>
        <span title={t('search.priority', { name: priorityName })}>
          <PriorityIcon priority={priorityName} showLabel={false} />
          <span className="sr-only">{t('search.priority', { name: priorityName })}</span>
        </span>
        <UserAvatar user={assignee} size="sm" />
        {assignee && (
          <span className="text-xs text-brand-text-secondary hidden sm:inline">
            {assignee.displayName}
          </span>
        )}
        {badge && (
          <span className="border border-brand-border bg-brand-surface-raised text-brand-text-secondary text-xs font-semibold rounded px-2 py-1">
            {badge}
          </span>
        )}
        {chips.map((g) => (
          <span
            key={g.id}
            style={groupColorStyle(g.color)}
            className={`pl-1.5 pr-2 ${groupChipClass}`}
          >
            <GroupChipLabel group={g} />
          </span>
        ))}
      </div>
      {hit.snippet && (
        <span className="text-xs text-brand-text-secondary truncate">
          {prefix ? `${prefix} ` : ''}
          <Highlight text={hit.snippet.text} words={words} />
        </span>
      )}
    </li>
  );
}
