import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRemovalBlockedByFetch } from '../tickets/useHintsEligible';
import { ChangeColorPopover } from './ChangeColorPopover';
import { CreateGroupPopover } from './CreateGroupPopover';
import { DeleteGroupDialog, type DeleteGroupTarget } from './DeleteGroupDialog';
import { GroupMenuItems } from './GroupMenuItems';
import { GroupTab } from './GroupTab';
import { canMove, type DeleteFocusTarget, deleteFocusTarget, positionOf } from './groupMoves';
import { useGroupStore } from './groupStore';
import {
  computeOverflow,
  focusCoreTab,
  groupTabId,
  parseGroupTabId,
  type TabId,
} from './groupTabs';
import { useMissingKeysByGroup } from './missingMembers';
import { RemoveMissingPopover } from './RemoveMissingPopover';
import { RenameGroupPopover } from './RenameGroupPopover';

const ARROW_CLASS =
  'flex items-center justify-center w-7 h-7 text-brand-muted hover:text-brand-text rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

export type PendingAction = {
  groupId: number;
  kind: 'rename' | 'color' | 'delete' | 'remove-missing';
} | null;

type MenuIntent = {
  groupId: number;
  kind: 'rename' | 'color' | 'delete' | 'remove-missing' | 'move-left' | 'move-right';
} | null;

type PendingFocus = {
  id: number;
  target: 'tab' | 'more';
  source: 'create' | 'manage';
} | null;

export function GroupTabStrip({
  activeTab,
  onTabChange,
  focusRequest,
  onFocusRequestHandled,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  focusRequest?: { id: number; seq: number } | null;
  onFocusRequestHandled?: () => void;
}) {
  const { t } = useTranslation();
  const groups = useGroupStore((s) => s.groups);
  const missingByGroup = useMissingKeysByGroup();
  const fetching = useRemovalBlockedByFetch();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [overflow, setOverflow] = useState({ canScrollLeft: false, canScrollRight: false });
  const wrapperRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const moreRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const anchorRef = useRef<HTMLElement | null>(null);
  const menuIntentRef = useRef<MenuIntent>(null);
  const movingRef = useRef(false);
  const [moving, setMoving] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<PendingFocus>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const returnFocusIdRef = useRef<number>(0);
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteGroupTarget | null>(null);
  const deleteCtxRef = useRef<{
    id: number;
    wasActive: boolean;
    focus: DeleteFocusTarget;
  } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingGroup = useMemo(
    () => (pending ? (groups.find((g) => g.id === pending.groupId) ?? null) : null),
    [pending, groups],
  );

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

  // Drop a create-focus request once the user navigates away from that group, so a
  // later unrelated hydrate can never pull focus onto it. Manage requests (menu actions)
  // may target an inactive tab, so they are kept.
  useEffect(() => {
    setPendingFocus((p) =>
      p !== null && p.source === 'create' && activeTab !== groupTabId(p.id) ? null : p,
    );
  }, [activeTab]);

  // External navigation request (navigateToGroup). Uses source 'manage' deliberately so the
  // drop effect above never clears it when the active tab changes.
  useEffect(() => {
    if (focusRequest == null) return;
    if (useGroupStore.getState().groups.some((g) => g.id === focusRequest.id)) {
      setPendingFocus({ id: focusRequest.id, target: 'tab', source: 'manage' });
    }
    onFocusRequestHandled?.();
  }, [focusRequest, onFocusRequestHandled]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: wait for the new group to render
  useEffect(() => {
    if (pendingFocus === null) return;
    const map = pendingFocus.target === 'more' ? moreRefs.current : tabRefs.current;
    const el = map.get(pendingFocus.id);
    if (!el) return;
    el.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
    el.focus();
    setPendingFocus(null);
  }, [pendingFocus, groups]);

  // A pending rename/color action whose group vanished from the store is dropped.
  useEffect(() => {
    if (pending && pending.kind !== 'delete' && !groups.some((g) => g.id === pending.groupId)) {
      setPending(null);
      toast.error(t('groups.error.notFound'));
    }
  }, [groups, pending, t]);

  useEffect(
    () => () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    },
    [],
  );

  function focusGroupTrigger(id: number) {
    if (!useGroupStore.getState().groups.some((g) => g.id === id)) return;
    setPendingFocus({
      id,
      target: activeTab === groupTabId(id) ? 'more' : 'tab',
      source: 'manage',
    });
  }

  function announce(msg: string) {
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setAnnouncement('');
    announceTimerRef.current = setTimeout(() => setAnnouncement(msg), 50);
    clearTimerRef.current = setTimeout(() => setAnnouncement(''), 5000);
  }

  async function handleMove(id: number, dir: 'left' | 'right') {
    if (movingRef.current) return;
    movingRef.current = true;
    setMoving(true);
    try {
      const r = await useGroupStore.getState().moveGroup(id, dir);
      if (!r.ok) {
        toast.error(t(r.code === 'not_found' ? 'groups.error.notFound' : 'groups.error.move'));
        return;
      }
      const current = useGroupStore.getState().groups;
      const pos = positionOf(current, id);
      const name = current.find((g) => g.id === id)?.name;
      if (pos && name !== undefined) {
        announce(t('groups.move.announce', { name, position: pos.position, total: pos.total }));
      }
    } finally {
      movingRef.current = false;
      setMoving(false);
      // The menu's close auto-focus was prevented, so focus must be restored on every
      // exit path (success, failure, or a vanished group). No-ops if the group is gone.
      focusGroupTrigger(id);
    }
  }

  function recordIntent(groupId: number, kind: NonNullable<MenuIntent>['kind']) {
    menuIntentRef.current = { groupId, kind };
  }

  function handleMenuCloseAutoFocus(e: Event) {
    const intent = menuIntentRef.current;
    menuIntentRef.current = null;
    if (!intent) return;
    e.preventDefault();
    if (intent.kind === 'move-left' || intent.kind === 'move-right') {
      void handleMove(intent.groupId, intent.kind === 'move-left' ? 'left' : 'right');
      return;
    }
    anchorRef.current = wrapperRefs.current.get(intent.groupId) ?? null;
    returnFocusIdRef.current = intent.groupId;
    if (intent.kind === 'delete') {
      const gs = useGroupStore.getState().groups;
      const g = gs.find((x) => x.id === intent.groupId);
      if (g) {
        const wasActive = activeTab === groupTabId(g.id);
        deleteCtxRef.current = {
          id: g.id,
          wasActive,
          focus: deleteFocusTarget(gs, g.id, wasActive),
        };
        setDeleteTarget({ id: g.id, name: g.name, memberCount: g.memberCount });
      }
      return;
    }
    setPending({ groupId: intent.groupId, kind: intent.kind });
  }

  function afterUnmount(fn: () => void) {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn);
    else setTimeout(fn, 0);
  }

  function handleDeleteReturnFocus(deleted: boolean) {
    const ctx = deleteCtxRef.current;
    deleteCtxRef.current = null;
    if (!ctx) return;
    if (!deleted) {
      focusGroupTrigger(ctx.id);
      return;
    }
    if (ctx.focus.kind === 'core-new') {
      afterUnmount(() => focusCoreTab('new'));
    } else if (ctx.focus.kind === 'group') {
      setPendingFocus({ id: ctx.focus.id, target: 'tab', source: 'manage' });
    } else {
      afterUnmount(() => createTriggerRef.current?.focus());
    }
  }

  function scrollByDir(dir: -1 | 1) {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    scrollerRef.current?.scrollBy?.({ left: dir * 200, behavior: reduced ? 'auto' : 'smooth' });
  }

  function handleCreated(id: number) {
    // Only honour focus/tab switch for a group the store actually has.
    if (!useGroupStore.getState().groups.some((g) => g.id === id)) return;
    setPendingFocus({ id, target: 'tab', source: 'create' });
    onTabChange(groupTabId(id));
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-1 min-w-0 items-center">
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          data-testid="group-move-status"
        >
          {announcement}
        </div>
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
            // scroll-px-10 keeps scrollIntoView/focus scrolling clear of the arrow overlays.
            className="flex items-end overflow-x-auto scroll-px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                moreButtonRef={(el) => {
                  if (el) moreRefs.current.set(g.id, el);
                  else moreRefs.current.delete(g.id);
                }}
                wrapperRef={(el) => {
                  if (el) wrapperRefs.current.set(g.id, el);
                  else wrapperRefs.current.delete(g.id);
                }}
                onMenuCloseAutoFocus={handleMenuCloseAutoFocus}
                renderMenuItems={(variant) => (
                  <GroupMenuItems
                    variant={variant}
                    canMoveLeft={!moving && canMove(groups, g.id, 'left')}
                    canMoveRight={!moving && canMove(groups, g.id, 'right')}
                    onRename={() => recordIntent(g.id, 'rename')}
                    onChangeColor={() => recordIntent(g.id, 'color')}
                    onMoveLeft={() => recordIntent(g.id, 'move-left')}
                    onMoveRight={() => recordIntent(g.id, 'move-right')}
                    missingCount={missingByGroup.get(g.id)?.size ?? 0}
                    onRemoveMissing={() => recordIntent(g.id, 'remove-missing')}
                    removeMissingDisabledReason={fetching ? t('groups.missing.refreshing') : null}
                    onDelete={() => recordIntent(g.id, 'delete')}
                  />
                )}
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
          <CreateGroupPopover onCreated={handleCreated} triggerRef={createTriggerRef} />
        </div>
        <RenameGroupPopover
          group={pending?.kind === 'rename' ? pendingGroup : null}
          open={pending?.kind === 'rename'}
          anchorRef={anchorRef}
          onOpenChange={(o) => {
            if (!o) setPending(null);
          }}
          onReturnFocus={() => focusGroupTrigger(returnFocusIdRef.current)}
        />
        <ChangeColorPopover
          group={pending?.kind === 'color' ? pendingGroup : null}
          open={pending?.kind === 'color'}
          anchorRef={anchorRef}
          onOpenChange={(o) => {
            if (!o) setPending(null);
          }}
          onReturnFocus={() => focusGroupTrigger(returnFocusIdRef.current)}
        />
        <RemoveMissingPopover
          group={pending?.kind === 'remove-missing' ? pendingGroup : null}
          open={pending?.kind === 'remove-missing'}
          anchorRef={anchorRef}
          onOpenChange={(o) => {
            if (!o) setPending(null);
          }}
          onReturnFocus={() => focusGroupTrigger(returnFocusIdRef.current)}
        />
        <DeleteGroupDialog
          target={deleteTarget}
          onOpenChange={(o) => {
            if (!o) {
              setDeleteTarget(null);
              setPending(null);
            }
          }}
          onDeleted={() => {
            if (deleteCtxRef.current?.wasActive) onTabChange('new');
          }}
          onReturnFocus={handleDeleteReturnFocus}
        />
      </div>
    </TooltipProvider>
  );
}
