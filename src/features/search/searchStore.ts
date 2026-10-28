import { create } from 'zustand';

/**
 * Raw global-search query (D-09). Lives in a store, not component state, because
 * App.tsx early-returns to the detail view and remounts AppShell, which would
 * otherwise lose the query (RESEARCH Pattern 1). Dropdown open state and the
 * debounced query stay local to GlobalSearch. Memory only, never persisted.
 */
interface SearchState {
  query: string;
  setQuery: (q: string) => void;
  clearQuery: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  setQuery: (q) => set({ query: q }),
  clearQuery: () => set({ query: '' }),
}));
