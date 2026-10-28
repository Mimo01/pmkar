import { describe, expect, it } from 'vitest';
import type { JiraTicket } from '../../tickets/types';
import { __indexBuildCount, buildSnippet, searchTickets } from '../searchIndex';
import type { CorpusItem } from '../types';

interface Opts {
  summary?: string;
  description?: unknown;
  assignee?: string;
  labels?: string[];
  components?: string[];
  fixVersions?: string[];
  updated?: string;
  copiedKey?: string | null;
  extra?: Record<string, unknown>;
}

function item(key: string, o: Opts = {}): CorpusItem {
  const ticket = {
    id: key,
    key,
    fields: {
      summary: o.summary ?? 'Summary',
      status: { name: 'Open' },
      priority: { name: 'Medium' },
      assignee: o.assignee ? { displayName: o.assignee } : null,
      updated: o.updated ?? '2026-01-01T00:00:00.000Z',
      description: o.description,
      labels: o.labels,
      components: o.components?.map((name) => ({ name })),
      fixVersions: o.fixVersions?.map((name) => ({ name })),
      ...o.extra,
    },
  } as unknown as JiraTicket;
  return { ticket, category: 'new', copiedKey: o.copiedKey ?? null };
}

const keys = (items: CorpusItem[], q: string) =>
  searchTickets(items, q).hits.map((h) => h.item.ticket.key);

describe('searchTickets matching', () => {
  it('AND semantics in any order', () => {
    const a = item('A-1', { summary: 'Timeout on login page' });
    expect(keys([a], 'login timeout')).toEqual(['A-1']);
    expect(keys([a], 'login missing')).toEqual([]);
  });
  it('ignores diacritics both ways', () => {
    const a = item('A-1', { summary: 'Chyba prihlásenia' });
    const b = item('A-2', { description: 'text prihlasenia' });
    expect(keys([a], 'chyba prihlasenia')).toEqual(['A-1']);
    expect(keys([b], 'prihlásenia')).toEqual(['A-2']);
  });
  it('matches each field alone', () => {
    expect(keys([item('A-1', { description: 'zebrafield' })], 'zebrafield')).toHaveLength(1);
    expect(keys([item('A-1', { assignee: 'Jana Nováková' })], 'novakova')).toHaveLength(1);
    expect(keys([item('A-1', { labels: ['frontend'] })], 'frontend')).toHaveLength(1);
    expect(keys([item('A-1', { components: ['Billing'] })], 'billing')).toHaveLength(1);
    expect(keys([item('A-1', { fixVersions: ['v9.9'] })], 'v9.9')).toHaveLength(1);
    expect(keys([item('A-1', { copiedKey: 'MYPROJ-12' })], 'myproj-12')).toHaveLength(1);
  });
  it('does not search comments', () => {
    const a = item('A-1', { extra: { comment: { comments: [{ body: 'secretword' }] } } });
    expect(keys([a], 'secretword')).toEqual([]);
  });
  it('ignores non-string description', () => {
    expect(() =>
      searchTickets([item('A-1', { description: { type: 'doc' } })], 'ab'),
    ).not.toThrow();
    expect(() => searchTickets([item('A-1', { description: null })], 'ab')).not.toThrow();
  });
  it('words cannot span fields', () => {
    expect(keys([item('AB-1', { summary: 'cd' })], '1cd')).toEqual([]);
  });
  it('caps description at 20000 chars', () => {
    const d = `${'x'.repeat(20_001)} lateword`;
    expect(keys([item('A-1', { description: d })], 'lateword')).toEqual([]);
  });
});

describe('searchTickets ranking and limits', () => {
  it('ranks 0..3 in order', () => {
    const items = [
      item('Z-1', { description: 'abc-12 here' }),
      item('Z-2', { summary: 'see abc-12 thing' }),
      item('ABC-120'),
      item('ABC-12'),
    ];
    const res = searchTickets(items, 'abc-12');
    expect(res.hits.map((h) => [h.item.ticket.key, h.rank])).toEqual([
      ['ABC-12', 0],
      ['ABC-120', 1],
      ['Z-2', 2],
      ['Z-1', 3],
    ]);
  });
  it('linked key ranks 0 before newer summary hit', () => {
    const items = [
      item('B-2', { summary: 'myproj-12 mention', updated: '2026-06-01T00:00:00.000Z' }),
      item('B-1', { copiedKey: 'MYPROJ-12', updated: '2026-01-01T00:00:00.000Z' }),
    ];
    const res = searchTickets(items, 'myproj-12');
    expect(res.hits.map((h) => [h.item.ticket.key, h.rank])).toEqual([
      ['B-1', 0],
      ['B-2', 2],
    ]);
  });
  it('newer description hit still ranks below older summary hit', () => {
    const items = [
      item('C-1', { description: 'needle', updated: '2026-09-01T00:00:00.000Z' }),
      item('C-2', { summary: 'needle', updated: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(keys(items, 'needle')).toEqual(['C-2', 'C-1']);
  });
  it('ties: updated desc then key asc', () => {
    const items = [
      item('D-2', { summary: 'needle', updated: '2026-01-01T00:00:00.000Z' }),
      item('D-1', { summary: 'needle', updated: '2026-01-01T00:00:00.000Z' }),
      item('D-3', { summary: 'needle', updated: '2026-02-01T00:00:00.000Z' }),
    ];
    expect(keys(items, 'needle')).toEqual(['D-3', 'D-1', 'D-2']);
  });
  it('min chars', () => {
    const a = item('A-1', { summary: 'abc' });
    expect(searchTickets([a], 'a')).toEqual({ hits: [], total: 0, words: [] });
    expect(searchTickets([a], ' ab ').hits).toHaveLength(1);
  });
  it('limits to 20 with total', () => {
    const items = Array.from({ length: 25 }, (_, i) => item(`E-${i}`, { summary: 'needle' }));
    const res = searchTickets(items, 'needle');
    expect(res.hits).toHaveLength(20);
    expect(res.total).toBe(25);
  });
});

describe('snippets', () => {
  it('null when words in key/summary', () => {
    const res = searchTickets([item('A-1', { summary: 'needle' })], 'needle');
    expect(res.hits[0].snippet).toBeNull();
  });
  it('description snippet with ellipsis and original text', () => {
    const d = `${'lorem ipsum '.repeat(20)}Prihlásenie zlyhalo ${'dolor sit '.repeat(20)}`;
    const res = searchTickets([item('A-1', { description: d })], 'prihlasenie');
    const s = res.hits[0].snippet;
    expect(s?.field).toBe('description');
    expect(s?.text.length).toBeLessThanOrEqual(82);
    expect(s?.text).toContain('Prihlásenie');
    expect(s?.text.startsWith('…')).toBe(true);
  });
  it('list-field and copiedKey snippets', () => {
    const l = searchTickets([item('A-1', { labels: ['ui', 'backend'] })], 'backend');
    expect(l.hits[0].snippet).toEqual({ field: 'labels', text: 'ui, backend' });
    const c = searchTickets([item('A-1', { copiedKey: 'MYPROJ-12' })], 'myproj-12');
    expect(c.hits[0].snippet).toEqual({ field: 'copiedKey', text: 'MYPROJ-12' });
  });
  it('buildSnippet without match returns head', () => {
    expect(buildSnippet('hello world', ['zzz'])).toBe('hello world');
  });
});

describe('index cache and perf', () => {
  it('reuses entry for same ticket object', () => {
    const a = item('A-1', { summary: 'cacheme' });
    const before = __indexBuildCount();
    searchTickets([a], 'cacheme');
    searchTickets([a], 'cacheme');
    expect(__indexBuildCount() - before).toBe(1);
  });
  it('1000 tickets x 5KB under 100ms warm', () => {
    const para = 'Chyba prihlásenia pri *načítaní* stránky. ';
    const items = Array.from({ length: 1000 }, (_, i) =>
      item(`P-${i}`, { summary: `Ticket ${i}`, description: para.repeat(120) }),
    );
    searchTickets(items, 'nacitani stranky');
    const t0 = performance.now();
    searchTickets(items, 'nacitani stranky');
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
