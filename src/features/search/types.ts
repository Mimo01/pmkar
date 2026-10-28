import type { JiraTicket } from '../tickets/types';

export type SearchCategory = 'new' | 'dismissed' | 'linked' | 'watched';

export type SnippetField =
  | 'description'
  | 'assignee'
  | 'labels'
  | 'components'
  | 'fixVersions'
  | 'copiedKey';

/** category null = Done ticket (no badge). */
export interface CorpusItem {
  ticket: JiraTicket;
  category: SearchCategory | null;
  copiedKey: string | null;
}

export interface SearchSnippet {
  field: SnippetField;
  text: string;
}

export interface SearchHit {
  item: CorpusItem;
  rank: 0 | 1 | 2 | 3;
  snippet: SearchSnippet | null;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  words: string[];
}

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_RESULT_LIMIT = 20;
export const SEARCH_DEBOUNCE_MS = 150;
export const DESCRIPTION_INDEX_CAP = 20_000;
export const SNIPPET_LENGTH = 80;
