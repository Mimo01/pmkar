import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { GROUP_COLOR_TOKENS, type GroupColorToken } from '../colors';
import { GroupColorSwatches } from '../GroupColorSwatches';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const NAMES = [
  'Blue',
  'Teal',
  'Green',
  'Amber',
  'Orange',
  'Purple',
  'Pink',
  'Indigo',
  'Cyan',
  'Lime',
  'Fuchsia',
  'Slate',
];

function Harness({
  initial = 'blue',
  follows,
  autoFocus,
  onSelect,
}: {
  initial?: GroupColorToken;
  follows: boolean;
  autoFocus?: boolean;
  onSelect?: (t: GroupColorToken) => void;
}) {
  const [v, setV] = useState<GroupColorToken>(initial);
  return (
    <TooltipProvider>
      <GroupColorSwatches
        value={v}
        selectionFollowsFocus={follows}
        autoFocus={autoFocus}
        onSelect={(tk) => {
          setV(tk);
          onSelect?.(tk);
        }}
      />
    </TooltipProvider>
  );
}

describe('GroupColorSwatches', () => {
  it('renders a named radiogroup with 12 radios in palette order', () => {
    renderWithI18n(<Harness follows={false} />);
    expect(screen.getByRole('radiogroup', { name: 'Color' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(NAMES);
    expect(radios).toHaveLength(GROUP_COLOR_TOKENS.length);
  });

  it('only the selected swatch is checked and tabbable', () => {
    renderWithI18n(<Harness initial="green" follows={false} />);
    for (const r of screen.getAllByRole('radio')) {
      const isGreen = r.getAttribute('aria-label') === 'Green';
      expect(r).toHaveAttribute('aria-checked', String(isGreen));
      expect(r).toHaveAttribute('tabindex', isGreen ? '0' : '-1');
    }
  });

  it('arrow keys move focus without selecting when selection does not follow focus', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithI18n(<Harness follows={false} onSelect={onSelect} />);
    screen.getByRole('radio', { name: 'Blue' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Teal' })).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('teal');
  });

  it('Space selects the focused swatch', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithI18n(<Harness follows={false} onSelect={onSelect} />);
    screen.getByRole('radio', { name: 'Blue' }).focus();
    await user.keyboard('{ArrowRight}{ArrowRight} ');
    expect(onSelect).toHaveBeenCalledWith('green');
  });

  it('click selects', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithI18n(<Harness follows={false} onSelect={onSelect} />);
    await user.click(screen.getByRole('radio', { name: 'Purple' }));
    expect(onSelect).toHaveBeenCalledWith('purple');
  });

  it('selection follows focus when enabled, wrapping and Home/End', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithI18n(<Harness follows onSelect={onSelect} />);
    screen.getByRole('radio', { name: 'Blue' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onSelect).toHaveBeenLastCalledWith('teal');
    expect(screen.getByRole('radio', { name: 'Teal' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Home}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Slate' })).toHaveFocus();
    expect(onSelect).toHaveBeenLastCalledWith('slate');
    await user.keyboard('{End}');
    expect(onSelect).toHaveBeenLastCalledWith('slate');
    await user.keyboard('{Home}');
    expect(onSelect).toHaveBeenLastCalledWith('blue');
  });

  it('autoFocus focuses the checked swatch on mount', () => {
    renderWithI18n(<Harness initial="pink" follows autoFocus />);
    expect(screen.getByRole('radio', { name: 'Pink' })).toHaveFocus();
  });
});
