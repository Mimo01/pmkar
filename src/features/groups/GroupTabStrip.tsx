import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CreateGroupPopover } from './CreateGroupPopover';
import { GroupTab } from './GroupTab';
import { useGroupStore } from './groupStore';
import { computeOverflow, groupTabId, parseGroupTabId, type TabId } from './groupTabs';

const ARROW_CLASS =
  'flex items-center justify-center w-7 h-7 text-brand-muted hover:text-brand-text rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

export function GroupTabStrip({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  const { t } = useTranslation();
  const groups = useGroupStore((s) => s.groups);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [overflow, setOverflow] = useState({ canScrollLeft: false, canScrollRight: false });
  const [pendingFocusId, setPendingFocusId] = useState<number | null>(null);

  function updateOverflow() {
    const el = scrollerRef.current;
    if (!el) return;
    const next = computeOverflow({
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    });
    setOverflow((prev) =>
      prev.canScrollLeft === next.canScrollLeft && prev.canScrollRight === next.canScrollRight
        ? prev
        : next,
    );
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute when groups change
  useLayoutEffect(() => {
    updateOverflow();
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => updateOverflow());
    ro.observe(el);
    return () => ro.disconnect();
  }, [groups]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth + 1) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: groups changes tab layout
  useEffect(() => {
    const id = parseGroupTabId(activeTab);
    if (id === null) return;
    tabRefs.current.get(id)?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [activeTab, groups]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: wait for the new group to render
  useEffect(() => {
    if (pendingFocusId === null) return;
    const el = tabRefs.current.get(pendingFocusId);
    if (!el) return;
    el.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
    el.focus();
    setPendingFocusId(null);
  }, [pendingFocusId, groups]);

  function scrollByDir(dir: -1 | 1) {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    scrollerRef.current?.scrollBy?.({ left: dir * 200, behavior: reduced ? 'auto' : 'smooth' });
  }

  function handleCreated(id: number) {
    setPendingFocusId(id);
    onTabChange(groupTabId(id));
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-1 min-w-0 items-center">
        <span
          data-testid="group-divider"
          aria-hidden="true"
          className="mx-2 h-4 w-px shrink-0 bg-brand-border"
        />
        <div className="relative flex-1 min-w-0">
          <div
            data-testid="group-tab-scroller"
            ref={scrollerRef}
            onScroll={updateOverflow}
            className="flex items-end overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {groups.map((g) => (
              <GroupTab
                key={g.id}
                group={g}
                active={activeTab === groupTabId(g.id)}
                onSelect={() => onTabChange(groupTabId(g.id))}
                buttonRef={(el) => {
                  if (el) tabRefs.current.set(g.id, el);
                  else tabRefs.current.delete(g.id);
                }}
              />
            ))}
          </div>
          {overflow.canScrollLeft && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-7 w-6 bg-gradient-to-r from-brand-surface to-transparent" />
              <div className="absolute left-0 inset-y-0 z-10 flex items-center bg-brand-surface">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={t('groups.scrollLeft')}
                      onClick={() => scrollByDir(-1)}
                      className={ARROW_CLASS}
                    >
                      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent aria-hidden="true">{t('groups.scrollLeft')}</TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
          {overflow.canScrollRight && (
            <>
              <div className="pointer-events-none absolute inset-y-0 right-7 w-6 bg-gradient-to-l from-brand-surface to-transparent" />
              <div className="absolute right-0 inset-y-0 z-10 flex items-center bg-brand-surface">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={t('groups.scrollRight')}
                      onClick={() => scrollByDir(1)}
                      className={ARROW_CLASS}
                    >
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent aria-hidden="true">{t('groups.scrollRight')}</TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </div>
        <div className="shrink-0 ml-2">
          <CreateGroupPopover onCreated={handleCreated} />
        </div>
      </div>
    </TooltipProvider>
  );
}
