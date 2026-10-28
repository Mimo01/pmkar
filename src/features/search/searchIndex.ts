import type { JiraTicket } from '../tickets/types';
import { foldText, foldWithMap, parseQuery } from './normalize';
import {
  type CorpusItem,
  DESCRIPTION_INDEX_CAP,
  SEARCH_MIN_CHARS,
  SEARCH_RESULT_LIMIT,
  type SearchHit,
  type SearchResult,
  type SearchSnippet,
  SNIPPET_LENGTH,
  type SnippetField,
} from './types';
import { stripWikiMarkup } from './wikiText';

interface IndexEntry {
  key: string;
  summary: string;
  assignee: string;
  labels: string;
  components: string;
  fixVersions: string;
  description: string;
  display: {
    description: string;
    assignee: string;
    labels: string;
    components: string;
    fixVersions: string;
  };
  haystack: string;
  updatedMs: number;
}

const indexCache = new WeakMap<JiraTicket, IndexEntry>();
let buildCount = 0;

/** Test-only: number of index entries built so far. */
export function __indexBuildCount(): number {
  return buildCount;
}

function buildEntry(ticket: JiraTicket): IndexEntry {
  buildCount++;
  const f = ticket.fields;
  const rawDesc = typeof f.description === 'string' ? f.description : '';
  const descDisplay = stripWikiMarkup(rawDesc).slice(0, DESCRIPTION_INDEX_CAP);
  const display = {
    description: descDisplay,
    assignee: f.assignee?.displayName ?? '',
    labels: (f.labels ?? []).join(', '),
    components: (f.components ?? []).map((c) => c.name).join(', '),
    fixVersions: (f.fixVersions ?? []).map((v) => v.name).join(', '),
  };
  const key = foldText(ticket.key);
  const summary = foldText(f.summary ?? '');
  const assignee = foldText(display.assignee);
  const labels = foldText(display.labels);
  const components = foldText(display.components);
  const fixVersions = foldText(display.fixVersions);
  const description = foldText(descDisplay);
  const updated = new Date(f.updated).getTime();
  return {
    key,
    summary,
    assignee,
    labels,
    components,
    fixVersions,
    description,
    display,
    haystack: [key, summary, description, assignee, labels, components, fixVersions].join('\u0000'),
    updatedMs: Number.isNaN(updated) ? 0 : updated,
  };
}

function getEntry(ticket: JiraTicket): IndexEntry {
  let e = indexCache.get(ticket);
  if (!e) {
    e = buildEntry(ticket);
    indexCache.set(ticket, e);
  }
  return e;
}

/** ~80-char one-line snippet around the earliest word occurrence. Plain text only. */
export function buildSnippet(text: string, words: readonly string[]): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const { folded, map } = foldWithMap(clean);
  let first = -1;
  for (const w of words) {
    if (!w) continue;
    const idx = folded.indexOf(w);
    if (idx !== -1 && (first === -1 || idx < first)) first = idx;
  }
  if (first === -1) return clean.slice(0, SNIPPET_LENGTH);
  const orig = map[first] ?? 0;
  const start = Math.max(0, orig - 30);
  const end = Math.min(clean.length, start + SNIPPET_LENGTH);
  return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`;
}

const SNIPPET_ORDER: SnippetField[] = [
  'description',
  'assignee',
  'labels',
  'components',
  'fixVersions',
  'copiedKey',
];

function computeSnippet(
  entry: IndexEntry,
  copiedKey: string | null,
  foldedCopied: string,
  words: readonly string[],
): SearchSnippet | null {
  const outside = words.find((w) => !entry.key.includes(w) && !entry.summary.includes(w));
  if (outside === undefined) return null;
  for (const field of SNIPPET_ORDER) {
    const folded = field === 'copiedKey' ? foldedCopied : entry[field];
    if (!folded.includes(outside)) continue;
    const display = field === 'copiedKey' ? (copiedKey ?? '') : entry.display[field];
    return { field, text: buildSnippet(display, words) };
  }
  return null;
}

export function searchTickets(
  items: readonly CorpusItem[],
  rawQuery: string,
  limit: number = SEARCH_RESULT_LIMIT,
): SearchResult {
  if (rawQuery.trim().length < SEARCH_MIN_CHARS) return { hits: [], total: 0, words: [] };
  const words = parseQuery(rawQuery);
  if (words.length === 0) return { hits: [], total: 0, words: [] };

  interface Match {
    item: CorpusItem;
    entry: IndexEntry;
    foldedCopied: string;
    rank: 0 | 1 | 2 | 3;
  }
  const matches: Match[] = [];
  for (const item of items) {
    const entry = getEntry(item.ticket);
    const foldedCopied = item.copiedKey ? foldText(item.copiedKey) : '';
    let ok = true;
    for (const w of words) {
      if (!entry.haystack.includes(w) && !foldedCopied.includes(w)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    let rank: 0 | 1 | 2 | 3 = 3;
    if (words.length === 1 && (entry.key === words[0] || foldedCopied === words[0])) rank = 0;
    else if (entry.key.startsWith(words[0])) rank = 1;
    else if (words.every((w) => entry.key.includes(w) || entry.summary.includes(w))) rank = 2;
    matches.push({ item, entry, foldedCopied, rank });
  }

  matches.sort(
    (a, b) =>
      a.rank - b.rank ||
      b.entry.updatedMs - a.entry.updatedMs ||
      a.item.ticket.key.localeCompare(b.item.ticket.key),
  );

  const hits: SearchHit[] = matches.slice(0, limit).map((m) => ({
    item: m.item,
    rank: m.rank,
    snippet: computeSnippet(m.entry, m.item.copiedKey, m.foldedCopied, words),
  }));
  return { hits, total: matches.length, words };
}
