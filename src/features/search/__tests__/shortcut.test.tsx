import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isModalOpen, shortcutHint, useSearchShortcut } from '../shortcut';

function Probe() {
  const ref = useRef<HTMLInputElement>(null);
  useSearchShortcut(() => {
    ref.current?.focus();
    ref.current?.select();
  });
  return (
    <div>
      <input data-testid="search" ref={ref} defaultValue="hello" />
      <input data-testid="other" />
    </div>
  );
}

function press(init: KeyboardEventInit, target: Element | Window = window) {
  const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useSearchShortcut', () => {
  it.each([
    [{ key: 'k', ctrlKey: true }],
    [{ key: 'k', metaKey: true }],
    [{ key: 'f', ctrlKey: true }],
    [{ key: 'f', metaKey: true }],
    [{ key: 'K', ctrlKey: true }],
  ])('focuses and selects on %o', (init) => {
    const { getByTestId } = render(<Probe />);
    const input = getByTestId('search') as HTMLInputElement;
    const ev = press(init);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(5);
  });

  it.each([
    [{ key: 'k', ctrlKey: true, shiftKey: true }],
    [{ key: 'f', ctrlKey: true, altKey: true }],
    [{ key: 'k' }],
  ])('ignores %o', (init) => {
    render(<Probe />);
    expect(press(init).defaultPrevented).toBe(false);
  });

  it('moves focus from another input', () => {
    const { getByTestId } = render(<Probe />);
    const other = getByTestId('other') as HTMLInputElement;
    other.focus();
    const ev = press({ key: 'k', ctrlKey: true }, other);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(getByTestId('search'));
  });

  it.each([
    '<div role="dialog" data-state="open"></div>',
    '<div role="alertdialog" data-state="open"></div>',
    '<div aria-modal="true"></div>',
  ])('does nothing while a modal is open: %s', (html) => {
    render(<Probe />);
    document.body.insertAdjacentHTML('beforeend', html);
    expect(isModalOpen()).toBe(true);
    expect(press({ key: 'k', ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it.each([
    '<div role="dialog" data-state="open" data-search-dialog=""></div>',
    '<div data-search-dialog=""><div role="dialog" data-state="open"></div></div>',
  ])('the search dialog itself does not block: %s', (html) => {
    const { getByTestId } = render(<Probe />);
    document.body.insertAdjacentHTML('beforeend', html);
    expect(isModalOpen()).toBe(false);
    const ev = press({ key: 'k', ctrlKey: true });
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(getByTestId('search'));
  });

  it('blocks when another dialog is open beside the search dialog', () => {
    render(<Probe />);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div role="dialog" data-state="open" data-search-dialog=""></div><div role="dialog" data-state="open"></div>',
    );
    expect(isModalOpen()).toBe(true);
    expect(press({ key: 'k', ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it('always calls the latest callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    function CbProbe({ cb }: { cb: () => void }) {
      useSearchShortcut(cb);
      return null;
    }
    const { rerender } = render(<CbProbe cb={first} />);
    rerender(<CbProbe cb={second} />);
    press({ key: 'k', ctrlKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('removes the listener on unmount', () => {
    const { unmount } = render(<Probe />);
    unmount();
    expect(press({ key: 'k', ctrlKey: true }).defaultPrevented).toBe(false);
  });
});

describe('shortcutHint', () => {
  it('returns the Mac hint on Mac', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    expect(shortcutHint()).toBe('⌘K');
  });
  it('returns Ctrl K elsewhere', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Windows');
    expect(shortcutHint()).toBe('Ctrl K');
  });
});
