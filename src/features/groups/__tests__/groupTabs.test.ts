import { describe, expect, it } from 'vitest';
import {
  computeOverflow,
  focusCoreTab,
  groupTabId,
  parseGroupTabId,
  resolveActiveTab,
} from '../groupTabs';

describe('focusCoreTab', () => {
  it('focuses the element with matching data-tab-id', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-tab-id', 'new');
    document.body.appendChild(btn);
    expect(focusCoreTab('new')).toBe(true);
    expect(document.activeElement).toBe(btn);
    btn.remove();
  });
  it('returns false when absent', () => {
    expect(focusCoreTab('linked')).toBe(false);
  });
});

describe('group tab ids', () => {
  it('round-trips', () => {
    expect(groupTabId(7)).toBe('group:7');
    expect(parseGroupTabId('group:7')).toBe(7);
  });
  it('rejects invalid ids', () => {
    for (const s of ['new', 'group:', 'group:abc', 'group:-1']) {
      expect(parseGroupTabId(s)).toBeNull();
    }
  });
});

describe('resolveActiveTab', () => {
  const g1 = { id: 1 };
  it('keeps core tabs', () => expect(resolveActiveTab('new', [], false)).toBe('new'));
  it('does not fall back before hydration', () =>
    expect(resolveActiveTab('group:1', [], false)).toBe('group:1'));
  it('keeps an existing group', () =>
    expect(resolveActiveTab('group:1', [g1], true)).toBe('group:1'));
  it('falls back to new for a missing group', () =>
    expect(resolveActiveTab('group:2', [g1], true)).toBe('new'));
});

describe('computeOverflow', () => {
  const o = (scrollLeft: number, clientWidth: number, scrollWidth: number) =>
    computeOverflow({ scrollLeft, clientWidth, scrollWidth });
  it('no overflow', () =>
    expect(o(0, 100, 100)).toEqual({ canScrollLeft: false, canScrollRight: false }));
  it('right only', () =>
    expect(o(0, 100, 300)).toEqual({ canScrollLeft: false, canScrollRight: true }));
  it('left only', () =>
    expect(o(200, 100, 300)).toEqual({ canScrollLeft: true, canScrollRight: false }));
  it('tolerates fractional positions', () =>
    expect(o(199.5, 100, 300)).toEqual({ canScrollLeft: true, canScrollRight: false }));
  it('both', () => expect(o(50, 100, 300)).toEqual({ canScrollLeft: true, canScrollRight: true }));
});
