import type { Group, MoveDirection } from './types';

type IdOnly = Pick<Group, 'id'>;

/** Whether the group can move one step in `dir`. `groups` is sorted by position (D-04). */
export function canMove(groups: readonly IdOnly[], id: number, dir: MoveDirection): boolean {
  const i = groups.findIndex((g) => g.id === id);
  if (i < 0) return false;
  return dir === 'left' ? i > 0 : i < groups.length - 1;
}

/** 1-based position among groups only (D-15). */
export function positionOf(
  groups: readonly IdOnly[],
  id: number,
): { position: number; total: number } | null {
  const i = groups.findIndex((g) => g.id === id);
  return i < 0 ? null : { position: i + 1, total: groups.length };
}

export type DeleteFocusTarget =
  | { kind: 'core-new' }
  | { kind: 'group'; id: number }
  | { kind: 'create' };

/** Where focus lands after deleting group `id` (D-14). */
export function deleteFocusTarget(
  groups: readonly IdOnly[],
  id: number,
  wasActive: boolean,
): DeleteFocusTarget {
  if (wasActive) return { kind: 'core-new' };
  const i = groups.findIndex((g) => g.id === id);
  const left = i > 0 ? groups[i - 1] : undefined;
  if (left) return { kind: 'group', id: left.id };
  const right = i >= 0 ? groups[i + 1] : undefined;
  if (right) return { kind: 'group', id: right.id };
  return { kind: 'create' };
}
