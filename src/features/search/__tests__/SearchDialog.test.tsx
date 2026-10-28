import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { useAnnouncerStore } from '../../../components/LiveAnnouncer';
import { TooltipProvider } from '../../../components/ui/tooltip';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useGroupStore } from '../../groups/groupStore';
import type { JiraTicket } from '../../tickets/types';
import { SearchDialog } from '../SearchDialog';
import { useSearchStore } from '../searchStore';
import type { CorpusItem } from '../types';

let corpus: { items: CorpusItem[]; ready: boolean } = { items: [], ready: true };
vi.mock('../useSearchCorpus', () => ({
  useSearchCorpus: () => corpus,
}));

function item(n: number, summary: string): CorpusItem {
  const ticket = {
    id: String(n),
    key: `P-${n}`,
    fields: {
      summary,
      status: { name: 'Open', statusCategory: { key: 'new' } },
      priority: { id: '2', name: 'High' },
      assignee: null,
      updated: '2026-01-01T00:00:00Z',
    },
  } as unknown as JiraTicket;
  return { ticket, category: 'linked', copiedKey: null };
}

const AXE_OPTIONS = { rules: { region: { enabled: false } } };

function setup(onOpen: (k: string) => boolean = () => true) {
  const utils = renderWithI18n(
    <TooltipProvider delayDuration={300}>
      <SearchDialog onOpenTicket={onOpen} />
    </TooltipProvider>,
  );
  const button = screen.getByRole('button', { name: 'Search tickets' });
  return { ...utils, button, onOpen };
}

function pressShortcut(key = 'k') {
  const ev = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true });
  act(() => {
    window.dispatchEvent(ev);
  });
  return ev;
}

function expectSelected(input: HTMLInputElement) {
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
}

describe('SearchDialog', () => {
  beforeEach(() => {
    corpus = {
      items: [item(1, 'Alpha one'), item(2, 'Alpha two'), item(3, 'Alpha three')],
      ready: true,
    };
    useSearchStore.setState({ query: 'alpha' });
    useAnnouncerStore.setState({ message: '', nonce: 0 });
    useGroupStore.setState({ groups: [], groupIdsByIssue: {}, hydrated: true });
  });
  afterEach(() => {
    for (const el of document.querySelectorAll('[data-test-foreign]')) el.remove();
  });

  it('icon button carries the label and shortcuts', () => {
    const { button } = setup();
    expect(button.getAttribute('aria-keyshortcuts')).toBe('Control+K Meta+K Control+F Meta+F');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('click opens the palette with the input focused and selected, results shown', async () => {
    const user = userEvent.setup();
    const { button } = setup();
    await user.click(button);
    const dialog = screen.getByRole('dialog');
    expect(dialog.hasAttribute('data-search-dialog')).toBe(true);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(dialog.contains(input)).toBe(true);
    expect(input.value).toBe('alpha');
    expectSelected(input);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('Ctrl+K and Ctrl+F open it; Ctrl+K while open reselects the text', () => {
    setup();
    expect(pressShortcut('k').defaultPrevented).toBe(true);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expectSelected(input);
    input.setSelectionRange(2, 2);
    expect(pressShortcut('k').defaultPrevented).toBe(true);
    expectSelected(input);
  });

  it('Ctrl+F opens it too', () => {
    setup();
    pressShortcut('f');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shortcut is ignored while another dialog is open', () => {
    setup();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div data-test-foreign role="dialog" data-state="open"></div>',
    );
    expect(pressShortcut('k').defaultPrevented).toBe(false);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('Escape closes, returns focus to the button, keeps the query, no tooltip pops', async () => {
    const user = userEvent.setup();
    const { button } = setup();
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(useSearchStore.getState().query).toBe('alpha');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('Escape is defaultPrevented so detail views do not also navigate back', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onBack();
    };
    document.addEventListener('keydown', listener);
    const { button } = setup();
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
    document.removeEventListener('keydown', listener);
  });

  it('reopening keeps the query and shows previous results', async () => {
    const user = userEvent.setup();
    const { button } = setup();
    await user.click(button);
    await user.keyboard('{Escape}');
    await user.click(button);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('alpha');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('closes when onOpenTicket returns true', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn(() => true);
    const { button } = setup(onOpen);
    await user.click(button);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('P-1');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays open when onOpenTicket returns false', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn(() => false);
    const { button } = setup(onOpen);
    await user.click(button);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('P-1');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('renders a live region inside the dialog', async () => {
    const user = userEvent.setup();
    const { button } = setup();
    await user.click(button);
    const status = screen.getByRole('status');
    expect(screen.getByRole('dialog').contains(status)).toBe(true);
  });

  it('has no axe violations when open', async () => {
    const user = userEvent.setup();
    const { button } = setup();
    await user.click(button);
    expect(await axe(document.body, AXE_OPTIONS)).toHaveNoViolations();
  });
});
