import { describe, expect, it } from 'vitest';
import { canMove, deleteFocusTarget, positionOf } from '../groupMoves';

const three = [{ id: 1 }, { id: 2 }, { id: 3 }];

describe('canMove', () => {
  it('blocks left at the first group', () => expect(canMove(three, 1, 'left')).toBe(false));
  it('allows right at the first group', () => expect(canMove(three, 1, 'right')).toBe(true));
  it('blocks right at the last group', () => expect(canMove(three, 3, 'right')).toBe(false));
  it('allows left in the middle', () => expect(canMove(three, 2, 'left')).toBe(true));
  it('blocks both directions for a single group', () => {
    expect(canMove([{ id: 1 }], 1, 'left')).toBe(false);
    expect(canMove([{ id: 1 }], 1, 'right')).toBe(false);
  });
  it('returns false for an unknown id', () => {
    expect(canMove(three, 99, 'left')).toBe(false);
    expect(canMove(three, 99, 'right')).toBe(false);
  });
});

describe('positionOf', () => {
  it('is 1-based among groups', () =>
    expect(positionOf(three, 3)).toEqual({ position: 3, total: 3 }));
  it('returns null for an unknown id', () => expect(positionOf(three, 99)).toBeNull());
});

describe('deleteFocusTarget', () => {
  it('prefers the left neighbour', () =>
    expect(deleteFocusTarget(three, 2, false)).toEqual({ kind: 'group', id: 1 }));
  it('falls back to the right neighbour for the first group', () =>
    expect(deleteFocusTarget(three, 1, false)).toEqual({ kind: 'group', id: 2 }));
  it('falls back to create for the only group', () =>
    expect(deleteFocusTarget([{ id: 1 }], 1, false)).toEqual({ kind: 'create' }));
  it('goes to the New core tab when the active group is deleted', () => {
    expect(deleteFocusTarget(three, 2, true)).toEqual({ kind: 'core-new' });
    expect(deleteFocusTarget([{ id: 1 }], 1, true)).toEqual({ kind: 'core-new' });
  });
});
