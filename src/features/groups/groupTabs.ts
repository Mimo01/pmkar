import type { Group } from './types';

export type CoreTab = 'new' | 'not-mine' | 'linked' | 'watched';
export type TabId = CoreTab | `group:${number}`;

export function groupTabId(id: number): TabId {
  return `group:${id}`;
}

/** Focuses a core nav tab by its data-tab-id. Returns false when it is not mounted. */
export function focusCoreTab(tab: CoreTab, options?: FocusOptions): boolean {
  const el = document.querySelector<HTMLElement>(`[data-tab-id="${tab}"]`);
  if (!el) return false;
  el.focus(options);
  return true;
}

export function parseGroupTabId(tab: string): number | null {
  const m = /^group:(\d+)$/.exec(tab);
  return m ? Number(m[1]) : null;
}

/**
 * Resolves the effective tab. Falls back to 'new' only when the active tab is a
 * group tab, groups are hydrated, and no group has that id. A failed plain hydrate
 * keeps the last good groups, so a transient error never triggers this fallback.
 * Deletion does, and so does a scope change (rehydrateAfter): its successful read
 * returns the new scope's groups, and its failed read clears groups rather than
 * leaving the previous scope's tabs interactive.
 */
export function resolveActiveTab(
  tab: TabId,
  groups: readonly Pick<Group, 'id'>[],
  groupsHydrated: boolean,
): TabId {
  const id = parseGroupTabId(tab);
  if (id === null || !groupsHydrated) return tab;
  return groups.some((g) => g.id === id) ? tab : 'new';
}

export function computeOverflow(m: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}): {
  canScrollLeft: boolean;
  canScrollRight: boolean;
} {
  return {
    canScrollLeft: m.scrollLeft > 0,
    canScrollRight: m.scrollLeft + m.clientWidth < m.scrollWidth - 1,
  };
}
