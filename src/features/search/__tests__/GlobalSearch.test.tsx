import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { useAnnouncerStore } from '../../../components/LiveAnnouncer';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useGroupStore } from '../../groups/groupStore';
import type { JiraTicket } from '../../tickets/types';
import { GlobalSearch } from '../GlobalSearch';
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

function many(count: number): CorpusItem[] {
  return Array.from({ length: count }, (_, i) => item(i + 1, `Alpha item ${i + 1}`));
}

const AXE_OPTIONS = { rules: { region: { enabled: false } } };

function setup(onOpen: (k: string) => boolean = () => true) {
  const utils = renderWithI18n(<GlobalSearch onOpenTicket={onOpen} />);
  const input = screen.getByRole('combobox') as HTMLInputElement;
  return { ...utils, input, onOpen };
}

function type(input: HTMLInputElement, value: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
}

function flush(ms = 200) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    corpus = { items: many(3), ready: true };
    useSearchStore.setState({ query: '' });
    useAnnouncerStore.setState({ message: '', nonce: 0 });
    useGroupStore.setState({ groups: [], groupIdsByIssue: {}, hydrated: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('has combobox semantics and starts collapsed', () => {
    const { input } = setup();
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-label')).toBe('Search all tickets');
    expect(input.getAttribute('placeholder')).toBe('Search all tickets…');
    expect(input.getAttribute('aria-keyshortcuts')).toBe('Control+K Meta+K Control+F Meta+F');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens only for 2+ chars after the debounce', () => {
    const { input } = setup();
    type(input, 'a');
    flush();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    fireEvent.change(input, { target: { value: 'al' } });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    flush();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const list = screen.getByRole('listbox', { name: 'Search results' });
    expect(input.getAttribute('aria-controls')).toBe(list.id);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('navigates with arrows, Home/End and wraps', () => {
    const { input } = setup();
    type(input, 'alpha');
    flush();
    const opts = screen.getAllByRole('option');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[0].id);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[2].id);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[0].id);
    fireEvent.keyDown(input, { key: 'End' });
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[2].id);
    fireEvent.keyDown(input, { key: 'Home' });
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[0].id);
  });

  it('Enter opens first hit when none active, keeps text, closes', () => {
    const onOpen = vi.fn(() => true);
    const { input } = setup(onOpen);
    type(input, 'alpha');
    flush();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('P-1');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('alpha');
  });

  it('Enter opens the active option', () => {
    const onOpen = vi.fn(() => true);
    const { input } = setup(onOpen);
    type(input, 'alpha');
    flush();
    fireEvent.keyDown(input, { key: 'End' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('P-3');
  });

  it('keeps the dropdown open when the host refuses', () => {
    const onOpen = vi.fn(() => false);
    const { input } = setup(onOpen);
    type(input, 'alpha');
    flush();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalled();
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('mouse down on an option opens the ticket', () => {
    const onOpen = vi.fn(() => true);
    const { input } = setup(onOpen);
    type(input, 'alpha');
    flush();
    fireEvent.mouseDown(screen.getAllByRole('option')[1]);
    expect(onOpen).toHaveBeenCalledWith('P-2');
  });

  it('Escape closes, then clears, then propagates; handled Esc is prevented', () => {
    const { input } = setup();
    const onBack = vi.fn();
    const docListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onBack();
    };
    document.addEventListener('keydown', docListener);
    type(input, 'alpha');
    flush();

    const mk = () =>
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const e1 = mk();
    act(() => {
      input.dispatchEvent(e1);
    });
    expect(e1.defaultPrevented).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('alpha');

    const e2 = mk();
    act(() => {
      input.dispatchEvent(e2);
    });
    expect(e2.defaultPrevented).toBe(true);
    expect(input.value).toBe('');
    expect(onBack).not.toHaveBeenCalled();

    const e3 = mk();
    act(() => {
      input.dispatchEvent(e3);
    });
    expect(e3.defaultPrevented).toBe(false);
    expect(onBack).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', docListener);
  });

  it('Tab closes the listbox', () => {
    const { input } = setup();
    type(input, 'alpha');
    flush();
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('mousedown outside closes without clearing', () => {
    const { input } = setup();
    type(input, 'alpha');
    flush();
    fireEvent.mouseDown(document.body);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('alpha');
  });

  it('caps at 20 rows with a truncation footer', () => {
    corpus = { items: many(25), ready: true };
    const { input } = setup();
    type(input, 'alpha');
    flush();
    expect(screen.getAllByRole('option')).toHaveLength(20);
    expect(screen.getByText('Showing 20 of 25, refine your search')).toBeTruthy();
  });

  it('shows the empty state with no listbox', () => {
    const { input } = setup();
    type(input, 'zzzz');
    flush();
    expect(screen.getByText('No tickets match')).toBeTruthy();
    expect(screen.getByText(/Searched: key, summary/)).toBeTruthy();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.hasAttribute('aria-controls')).toBe(false);
  });

  it('announces the count once after the debounce', () => {
    const { input } = setup();
    type(input, 'al');
    fireEvent.change(input, { target: { value: 'alp' } });
    expect(useAnnouncerStore.getState().nonce).toBe(0);
    flush();
    expect(useAnnouncerStore.getState().message).toBe('3 results');
    expect(useAnnouncerStore.getState().nonce).toBe(1);
    fireEvent.keyDown(input, { key: 'Enter' });
    flush();
    expect(useAnnouncerStore.getState().nonce).toBe(1);
  });

  it('announces No results', () => {
    const { input } = setup();
    type(input, 'zzzz');
    flush();
    expect(useAnnouncerStore.getState().message).toBe('No results');
  });

  it('shows Clear only with text; clicking clears and refocuses', () => {
    const { input, container } = setup();
    expect(screen.queryByLabelText('Clear search')).toBeNull();
    const kbd = container.querySelector('[aria-hidden="true"].border');
    expect(kbd?.getAttribute('aria-hidden')).toBe('true');
    type(input, 'alpha');
    expect(container.querySelector('[aria-hidden="true"].border')).toBeNull();
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(useSearchStore.getState().query).toBe('');
  });

  it('does not auto-open on remount; focus re-opens with same results', () => {
    useSearchStore.setState({ query: 'alpha' });
    const { input } = setup();
    expect(input.value).toBe('alpha');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    fireEvent.focus(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('renders no panel before the corpus is ready', () => {
    corpus = { items: [], ready: false };
    const { input } = setup();
    type(input, 'alpha');
    flush();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('has no axe violations (results and empty state)', async () => {
    vi.useRealTimers();
    const { input, container } = setup();
    type(input, 'alpha');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
    fireEvent.change(input, { target: { value: 'zzzz' } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(screen.getByText('No tickets match')).toBeTruthy();
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
  });
});
