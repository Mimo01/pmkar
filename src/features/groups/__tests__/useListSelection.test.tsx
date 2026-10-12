import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useListSelection } from '../useListSelection';

const KEYS = ['A', 'B', 'C', 'D', 'E'];

function setup(keys: readonly string[] = KEYS) {
  return renderHook(({ k }) => useListSelection(k), { initialProps: { k: keys } });
}

function on(r: ReturnType<typeof setup>) {
  act(() => r.result.current.toggleSelectMode());
}

function key(e: Partial<React.KeyboardEvent>) {
  return { key: 'Escape', defaultPrevented: false, preventDefault: vi.fn(), ...e } as never;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useListSelection', () => {
  it('starts off and empty', () => {
    const r = setup();
    expect(r.result.current.selectMode).toBe(false);
    expect(r.result.current.selectedKeys).toEqual([]);
  });

  it('toggles a key on and off', () => {
    const r = setup();
    on(r);
    act(() => r.result.current.toggle('B', false));
    expect(r.result.current.selectedKeys).toEqual(['B']);
    expect(r.result.current.isSelected('B')).toBe(true);
    act(() => r.result.current.toggle('B', false));
    expect(r.result.current.selectedKeys).toEqual([]);
  });

  it('selects a range forward', () => {
    const r = setup();
    on(r);
    act(() => r.result.current.toggle('B', false));
    act(() => r.result.current.toggle('D', true));
    expect(r.result.current.selectedKeys).toEqual(['B', 'C', 'D']);
  });

  it('selects a range in reverse', () => {
    const r = setup();
    on(r);
    act(() => r.result.current.toggle('D', false));
    act(() => r.result.current.toggle('B', true));
    expect(r.result.current.selectedKeys).toEqual(['B', 'C', 'D']);
  });

  it('shift never deselects', () => {
    const r = setup();
    on(r);
    act(() => r.result.current.toggle('B', false));
    act(() => r.result.current.toggle('D', true));
    act(() => r.result.current.toggle('C', false)); // deselect, anchor C
    expect(r.result.current.selectedKeys).toEqual(['B', 'D']);
    act(() => r.result.current.toggle('E', true));
    expect(r.result.current.selectedKeys).toEqual(['B', 'C', 'D', 'E']);
  });

  it('shift without anchor is a plain toggle', () => {
    const r = setup();
    on(r);
    act(() => r.result.current.toggle('C', true));
    expect(r.result.current.selectedKeys).toEqual(['C']);
  });

  it('prunes keys that leave the visible list and resets the anchor', () => {
    const r = setup();
    on(r);
    act(() => r.result.current.toggle('B', false));
    act(() => r.result.current.toggle('D', false));
    r.rerender({ k: ['A', 'B', 'C'] });
    expect(r.result.current.selectedKeys).toEqual(['B']);
    // anchor D was pruned: shift acts as a plain toggle
    act(() => r.result.current.toggle('C', true));
    expect(r.result.current.selectedKeys).toEqual(['B', 'C']);
  });

  it('does not loop on content-equal new arrays', () => {
    let renders = 0;
    const r = renderHook(
      ({ k }) => {
        renders++;
        return useListSelection(k);
      },
      { initialProps: { k: [...KEYS] } },
    );
    on(r as never);
    act(() => r.result.current.toggle('B', false));
    for (let i = 0; i < 3; i++) r.rerender({ k: [...KEYS] });
    expect(renders).toBeLessThan(20);
    expect(r.result.current.selectedKeys).toEqual(['B']);
  });

  it('toggleSelectMode while on clears selection (D-14)', () => {
    const r = setup();
    on(r);
    act(() => r.result.current.toggle('B', false));
    act(() => r.result.current.toggleSelectMode());
    expect(r.result.current.selectMode).toBe(false);
    expect(r.result.current.selectedKeys).toEqual([]);
  });

  it('clear keeps mode on', () => {
    const r = setup();
    on(r);
    act(() => r.result.current.toggle('B', false));
    act(() => r.result.current.clear());
    expect(r.result.current.selectMode).toBe(true);
    expect(r.result.current.selectedKeys).toEqual([]);
  });

  it('exit resets mode, selection and anchor', () => {
    const r = setup();
    on(r);
    act(() => r.result.current.toggle('B', false));
    act(() => r.result.current.exit());
    expect(r.result.current.selectMode).toBe(false);
    expect(r.result.current.selectedKeys).toEqual([]);
    on(r);
    act(() => r.result.current.toggle('D', true)); // no anchor: plain
    expect(r.result.current.selectedKeys).toEqual(['D']);
  });

  it('Escape exits select mode and focuses the toggle', () => {
    vi.useFakeTimers();
    const r = setup();
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    (r.result.current.selectToggleRef as { current: HTMLButtonElement | null }).current = btn;
    on(r);
    act(() => r.result.current.toggle('B', false));
    act(() => r.result.current.handleKeyDown(key({})));
    expect(r.result.current.selectMode).toBe(false);
    expect(r.result.current.selectedKeys).toEqual([]);
    act(() => {
      vi.runAllTimers();
    });
    expect(document.activeElement).toBe(btn);
    btn.remove();
  });

  it('Escape with defaultPrevented does nothing', () => {
    const r = setup();
    on(r);
    act(() => r.result.current.handleKeyDown(key({ defaultPrevented: true })));
    expect(r.result.current.selectMode).toBe(true);
  });

  it('Escape while off does nothing', () => {
    const r = setup();
    const ev = key({});
    act(() => r.result.current.handleKeyDown(ev));
    expect(r.result.current.selectMode).toBe(false);
    expect((ev as { preventDefault: () => void }).preventDefault).not.toHaveBeenCalled();
  });

  it('a remounted hook starts empty', () => {
    const r = setup();
    on(r);
    act(() => r.result.current.toggle('B', false));
    r.unmount();
    const r2 = setup();
    expect(r2.result.current.selectMode).toBe(false);
    expect(r2.result.current.selectedKeys).toEqual([]);
  });

  it('has no selectAll member', () => {
    const r = setup();
    expect(Object.keys(r.result.current).some((k) => /selectall/i.test(k))).toBe(false);
  });
});
