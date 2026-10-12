import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { groupColorVar } from './colors';
import type { Group } from './types';

interface GroupTabProps {
  group: Group;
  active: boolean;
  onSelect: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}

export function GroupTab({ group, active, onSelect, buttonRef }: GroupTabProps) {
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          ref={buttonRef}
          onClick={onSelect}
          aria-label={t('groups.tab.aria', { name: group.name, count: group.memberCount })}
          aria-current={active ? 'page' : undefined}
          className={`shrink-0 flex items-center gap-1 text-sm py-2 mr-4 border-b-2 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
            active
              ? 'text-brand-text font-semibold border-brand'
              : 'text-brand-muted font-normal hover:text-brand-text border-transparent'
          }`}
        >
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: groupColorVar(group.color) }}
          />
          <span className="grid max-w-[160px]">
            <span
              aria-hidden="true"
              className="col-start-1 row-start-1 truncate invisible font-semibold"
            >
              {group.name}
            </span>
            <span className="col-start-1 row-start-1 truncate">{group.name}</span>
          </span>
          <span className="text-xs text-brand-text-secondary">{group.memberCount}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent aria-hidden="true">{group.name}</TooltipContent>
    </Tooltip>
  );
}
