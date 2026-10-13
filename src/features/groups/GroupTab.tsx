import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CountPill } from './CountPill';
import { groupColorStyle } from './colors';
import type { Group } from './types';

interface GroupTabProps {
  group: Group;
  active: boolean;
  onSelect: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
  wrapperRef: (el: HTMLDivElement | null) => void;
  renderMenuItems: () => React.ReactNode;
  onMenuCloseAutoFocus: (e: Event) => void;
}

export function GroupTab({
  group,
  active,
  onSelect,
  buttonRef,
  wrapperRef,
  renderMenuItems,
  onMenuCloseAutoFocus,
}: GroupTabProps) {
  const { t } = useTranslation();
  const summary = t('groups.tab.aria', { name: group.name, count: group.memberCount });
  const localWrapperRef = useRef<HTMLDivElement | null>(null);
  const localButtonRef = useRef<HTMLButtonElement | null>(null);
  // The context menu's trigger is the (unfocusable) wrapper, so a menu opened from the
  // keyboard must hand focus back to the tab button itself when it closes.
  const openedByKeyboardRef = useRef(false);

  function setWrapper(el: HTMLDivElement | null) {
    localWrapperRef.current = el;
    wrapperRef(el);
  }

  function setButton(el: HTMLButtonElement | null) {
    localButtonRef.current = el;
    buttonRef(el);
  }

  function handleCloseAutoFocus(e: Event) {
    const byKeyboard = openedByKeyboardRef.current;
    openedByKeyboardRef.current = false;
    onMenuCloseAutoFocus(e);
    if (byKeyboard && !e.defaultPrevented) {
      e.preventDefault();
      localButtonRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      const wrapper = localWrapperRef.current;
      if (!wrapper) return;
      openedByKeyboardRef.current = true;
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

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setWrapper}
          style={groupColorStyle(group.color)}
          className="shrink-0 inline-flex items-center mr-3"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                ref={setButton}
                data-nav-tab=""
                onClick={onSelect}
                onKeyDown={handleKeyDown}
                aria-label={summary}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1 text-sm px-1.5 py-2 border-b-2 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 ${
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
            <TooltipContent aria-hidden="true">
              <span className="block">{summary}</span>
              <span className="block">{t('groups.tab.menuHint')}</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={handleCloseAutoFocus}>
        {renderMenuItems()}
      </ContextMenuContent>
    </ContextMenu>
  );
}
