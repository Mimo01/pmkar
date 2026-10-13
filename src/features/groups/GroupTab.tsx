import { MoreHorizontal } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CountPill } from './CountPill';
import { groupColorStyle } from './colors';
import type { Group } from './types';

interface GroupTabProps {
  group: Group;
  active: boolean;
  onSelect: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
  moreButtonRef: (el: HTMLButtonElement | null) => void;
  wrapperRef: (el: HTMLDivElement | null) => void;
  renderMenuItems: (variant: 'dropdown' | 'context') => React.ReactNode;
  onMenuCloseAutoFocus: (e: Event) => void;
}

export function GroupTab({
  group,
  active,
  onSelect,
  buttonRef,
  moreButtonRef,
  wrapperRef,
  renderMenuItems,
  onMenuCloseAutoFocus,
}: GroupTabProps) {
  const { t } = useTranslation();
  const localWrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerLabel = t('groups.menu.trigger', { name: group.name });

  function setWrapper(el: HTMLDivElement | null) {
    localWrapperRef.current = el;
    wrapperRef(el);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      const wrapper = localWrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      wrapper.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left,
          clientY: rect.bottom,
        }),
      );
    }
  }

  const moreButton = (
    <button
      type="button"
      ref={moreButtonRef}
      aria-label={triggerLabel}
      aria-hidden={active ? undefined : true}
      tabIndex={active ? 0 : -1}
      className={`flex h-5 w-5 items-center justify-center rounded text-brand-text-secondary hover:text-brand-text focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 ${
        active ? '' : 'invisible pointer-events-none'
      }`}
    >
      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setWrapper}
          style={groupColorStyle(group.color)}
          className="shrink-0 inline-flex items-center gap-1 mr-4"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                ref={buttonRef}
                data-nav-tab=""
                onClick={onSelect}
                onKeyDown={handleKeyDown}
                aria-label={t('groups.tab.aria', { name: group.name, count: group.memberCount })}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1 text-sm px-1 py-2 border-b-2 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 ${
                  active
                    ? 'text-brand-text font-semibold border-(--group-color)'
                    : 'text-brand-text-secondary font-normal hover:text-brand-text border-(--group-color)/35 hover:border-(--group-color)/70'
                }`}
              >
                <span className="grid max-w-[160px]">
                  <span
                    aria-hidden="true"
                    className="col-start-1 row-start-1 truncate invisible font-semibold"
                  >
                    {group.name}
                  </span>
                  <span className="col-start-1 row-start-1 truncate">{group.name}</span>
                </span>
                <CountPill active={active}>{group.memberCount}</CountPill>
              </button>
            </TooltipTrigger>
            <TooltipContent aria-hidden="true">{group.name}</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            {active ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>{moreButton}</DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent aria-hidden="true">{triggerLabel}</TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuTrigger asChild>{moreButton}</DropdownMenuTrigger>
            )}
            <DropdownMenuContent onCloseAutoFocus={onMenuCloseAutoFocus}>
              {renderMenuItems('dropdown')}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={onMenuCloseAutoFocus}>
        {renderMenuItems('context')}
      </ContextMenuContent>
    </ContextMenu>
  );
}
