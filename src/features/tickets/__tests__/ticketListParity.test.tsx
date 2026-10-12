// Characterization tests (D-23): pin the rendered membership and order of the New, Not mine
// and Linked lists BEFORE the filter/sort logic is extracted into ticketListUtils.ts.
// Assignee filtering needs the async user-search chip, so it is covered at unit level in
// ticketListUtils.test.ts instead.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IgnoredTicketsPage } from '../IgnoredTicketsPage';
import { LinkedTicketsPage } from '../LinkedTicketsPage';
import { TicketListPage } from '../TicketListPage';
import { useTicketStore } from '../ticketStore';
import type { JiraTicket, TriageEntry } from '../types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('../../connections/connectionStore', () => {
  const state = {
    serverConnection: {
      baseUrl: 'http://127.0.0.1:8080',
      username: 'jdoe',
      serverVersion: '8.20.0',
      lastTestedAt: new Date().toISOString(),
      status: 'ok',
    },
    cloudConnection: null,
    hasCompletedSetup: () => true,
  };
  return {
    useConnectionStore: Object.assign((selector: (s: unknown) => unknown) => selector(state), {
      getState: () => state,
      subscribe: () => () => {},
    }),
  };
});

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

interface Spec {
  key: string;
  updated: string;
  created: string | undefined;
  priorityId: string;
  status: string;
  assignee: string | null;
  done?: boolean;
  triage?: TriageEntry['state'];
}

const SPECS: Spec[] = [
  {
    key: 'ABC-2',
    updated: '2024-03-10T00:00:00.000Z',
    created: '2024-01-05T00:00:00.000Z',
    priorityId: '3',
    status: 'Open',
    assignee: 'Alice',
  },
  {
    key: 'ABC-10',
    updated: '2024-03-08T00:00:00.000Z',
    created: undefined,
    priorityId: '1',
    status: 'In Progress',
    assignee: null,
    triage: 'new',
  },
  {
    key: 'XYZ-1',
    updated: '2024-03-12T00:00:00.000Z',
    created: '2024-02-01T00:00:00.000Z',
    priorityId: '5',
    status: 'Blocked',
    assignee: 'alice smith',
    triage: 'seen',
  },
  {
    // Ties with ABC-10 on updated
    key: 'ABC-1',
    updated: '2024-03-08T00:00:00.000Z',
    created: '2024-01-01T00:00:00.000Z',
    priorityId: '2',
    status: 'Open',
    assignee: 'Bob',
  },
  {
    key: 'ABC-3',
    updated: '2024-03-01T00:00:00.000Z',
    created: '2024-01-20T00:00:00.000Z',
    priorityId: '4',
    status: 'Review',
    assignee: 'Bob',
    triage: 'ignored',
  },
  {
    key: 'ABC-11',
    updated: '2024-03-15T00:00:00.000Z',
    created: '2024-03-01T00:00:00.000Z',
    priorityId: '2',
    status: 'Open',
    assignee: 'Alice',
    triage: 'ignored',
  },
  {
    key: 'XYZ-2',
    updated: '2024-03-02T00:00:00.000Z',
    created: '2024-02-10T00:00:00.000Z',
    priorityId: '1',
    status: 'Blocked',
    assignee: null,
    triage: 'handled',
  },
  {
    key: 'ABC-4',
    updated: '2024-03-20T00:00:00.000Z',
    created: '2024-02-15T00:00:00.000Z',
    priorityId: '3',
    status: 'In Progress',
    assignee: 'alice smith',
    triage: 'copied',
  },
  {
    key: 'ABC-12',
    updated: '2024-03-05T00:00:00.000Z',
    created: '2024-01-10T00:00:00.000Z',
    priorityId: '5',
    status: 'Open',
    assignee: 'Bob',
    triage: 'copied',
  },
  {
    key: 'XYZ-3',
    updated: '2024-03-09T00:00:00.000Z',
    created: '2024-02-20T00:00:00.000Z',
    priorityId: '2',
    status: 'Review',
    assignee: 'Alice',
    triage: 'copied',
  },
  {
    key: 'DONE-1',
    updated: '2024-03-25T00:00:00.000Z',
    created: '2024-01-02T00:00:00.000Z',
    priorityId: '3',
    status: 'Closed',
    assignee: 'Alice',
    done: true,
    triage: 'new',
  },
  {
    key: 'DONE-2',
    updated: '2024-03-26T00:00:00.000Z',
    created: '2024-01-03T00:00:00.000Z',
    priorityId: '3',
    status: 'Closed',
    assignee: 'Bob',
    done: true,
    triage: 'copied',
  },
];

function makeTicket(spec: Spec): JiraTicket {
  return {
    id: spec.key,
    key: spec.key,
    fields: {
      summary: `Summary for ${spec.key}`,
      status: {
        name: spec.status,
        statusCategory: { key: spec.done ? 'done' : 'indeterminate' },
      },
      priority: { name: `P${spec.priorityId}`, id: spec.priorityId },
      assignee: spec.assignee ? { displayName: spec.assignee } : null,
      created: spec.created,
      updated: spec.updated,
    },
  } as unknown as JiraTicket;
}

function buildTriageMap(): Record<string, TriageEntry> {
  const map: Record<string, TriageEntry> = {};
  for (const s of SPECS) {
    if (s.triage) map[s.key] = { state: s.triage, copiedKey: s.triage === 'copied' ? 'C-1' : null };
  }
  return map;
}

function renderedKeys(): string[] {
  return screen.queryAllByText(/^Summary for /).map((el) => (el.textContent ?? '').slice(12));
}

type SortField = 'updated' | 'key' | 'created' | 'priority' | 'status' | 'assignee';

interface Expectation {
  members: string[];
  /** Order with the default direction (desc) per sort field, then asc after the toggle */
  orders: Record<SortField, { desc: string[]; asc: string[] }>;
  searchTerm: string;
  searchResult: string[];
}

const PAGES: { name: string; Page: () => React.ReactElement; expected: Expectation }[] = [
  {
    name: 'TicketListPage (New)',
    Page: () => <TicketListPage />,
    expected: {
      members: ['ABC-2', 'ABC-10', 'XYZ-1', 'ABC-1'],
      orders: {
        updated: {
          desc: ['XYZ-1', 'ABC-2', 'ABC-10', 'ABC-1'],
          asc: ['ABC-10', 'ABC-1', 'ABC-2', 'XYZ-1'],
        },
        key: {
          desc: ['XYZ-1', 'ABC-10', 'ABC-2', 'ABC-1'],
          asc: ['ABC-1', 'ABC-2', 'ABC-10', 'XYZ-1'],
        },
        created: {
          desc: ['ABC-10', 'XYZ-1', 'ABC-2', 'ABC-1'],
          asc: ['ABC-1', 'ABC-2', 'XYZ-1', 'ABC-10'],
        },
        priority: {
          desc: ['XYZ-1', 'ABC-2', 'ABC-1', 'ABC-10'],
          asc: ['ABC-10', 'ABC-1', 'ABC-2', 'XYZ-1'],
        },
        status: {
          desc: ['ABC-2', 'ABC-1', 'ABC-10', 'XYZ-1'],
          asc: ['XYZ-1', 'ABC-10', 'ABC-2', 'ABC-1'],
        },
        assignee: {
          desc: ['ABC-1', 'XYZ-1', 'ABC-2', 'ABC-10'],
          asc: ['ABC-10', 'ABC-2', 'XYZ-1', 'ABC-1'],
        },
      },
      searchTerm: 'abc',
      searchResult: ['ABC-2', 'ABC-10', 'ABC-1'],
    },
  },
  {
    name: 'IgnoredTicketsPage (Not mine)',
    Page: () => <IgnoredTicketsPage />,
    expected: {
      members: ['ABC-3', 'ABC-11', 'XYZ-2'],
      orders: {
        updated: { desc: ['ABC-11', 'XYZ-2', 'ABC-3'], asc: ['ABC-3', 'XYZ-2', 'ABC-11'] },
        key: { desc: ['XYZ-2', 'ABC-11', 'ABC-3'], asc: ['ABC-3', 'ABC-11', 'XYZ-2'] },
        created: { desc: ['ABC-11', 'XYZ-2', 'ABC-3'], asc: ['ABC-3', 'XYZ-2', 'ABC-11'] },
        priority: { desc: ['ABC-3', 'ABC-11', 'XYZ-2'], asc: ['XYZ-2', 'ABC-11', 'ABC-3'] },
        status: { desc: ['ABC-3', 'ABC-11', 'XYZ-2'], asc: ['XYZ-2', 'ABC-11', 'ABC-3'] },
        assignee: { desc: ['ABC-3', 'ABC-11', 'XYZ-2'], asc: ['XYZ-2', 'ABC-11', 'ABC-3'] },
      },
      searchTerm: 'abc',
      searchResult: ['ABC-11', 'ABC-3'],
    },
  },
  {
    name: 'LinkedTicketsPage (Linked)',
    Page: () => <LinkedTicketsPage />,
    expected: {
      members: ['ABC-4', 'ABC-12', 'XYZ-3'],
      orders: {
        updated: { desc: ['ABC-4', 'XYZ-3', 'ABC-12'], asc: ['ABC-12', 'XYZ-3', 'ABC-4'] },
        key: { desc: ['XYZ-3', 'ABC-12', 'ABC-4'], asc: ['ABC-4', 'ABC-12', 'XYZ-3'] },
        created: { desc: ['XYZ-3', 'ABC-4', 'ABC-12'], asc: ['ABC-12', 'ABC-4', 'XYZ-3'] },
        priority: { desc: ['ABC-12', 'ABC-4', 'XYZ-3'], asc: ['XYZ-3', 'ABC-4', 'ABC-12'] },
        status: { desc: ['XYZ-3', 'ABC-12', 'ABC-4'], asc: ['ABC-4', 'ABC-12', 'XYZ-3'] },
        assignee: { desc: ['ABC-12', 'ABC-4', 'XYZ-3'], asc: ['XYZ-3', 'ABC-4', 'ABC-12'] },
      },
      searchTerm: 'abc',
      searchResult: ['ABC-4', 'ABC-12'],
    },
  },
];

const SORT_FIELDS: SortField[] = ['updated', 'key', 'created', 'priority', 'status', 'assignee'];

describe('ticket list parity (characterization)', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    const triageMap = buildTriageMap();
    useTicketStore.setState({
      tickets: SPECS.map(makeTicket),
      triageMap,
      selectedTicketKey: null,
      fetchStatus: 'idle',
      fetchError: null,
      lastFetchedAt: null,
      totalCount: 0,
      newCount: 0,
      jqlPreset: 'mine',
      jqlCustom: null,
      watchedUsers: [],
    });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_triage_state') return Promise.resolve(triageMap);
      if (cmd === 'get_fetch_config')
        return Promise.resolve({
          jqlPreset: 'mine',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      return Promise.resolve(undefined);
    });
  });

  describe.each(PAGES)('$name', ({ Page, expected }) => {
    it('shows exactly the expected partition (done tickets excluded)', () => {
      render(<Page />);
      expect([...renderedKeys()].sort()).toEqual([...expected.members].sort());
    });

    it('defaults to updated descending', () => {
      render(<Page />);
      expect(renderedKeys()).toEqual(expected.orders.updated.desc);
    });

    it.each(SORT_FIELDS)('sorts by %s in both directions', (field) => {
      render(<Page />);
      fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: field } });
      expect(renderedKeys()).toEqual(expected.orders[field].desc);
      fireEvent.click(screen.getByLabelText('Sort ascending'));
      expect(renderedKeys()).toEqual(expected.orders[field].asc);
    });

    it('filters by key search text (case-insensitive) keeping default order', () => {
      render(<Page />);
      fireEvent.change(screen.getByLabelText('Filter tickets by key'), {
        target: { value: expected.searchTerm },
      });
      expect(renderedKeys()).toEqual(expected.searchResult);
    });

    it('does not match search against summary text', () => {
      render(<Page />);
      fireEvent.change(screen.getByLabelText('Filter tickets by key'), {
        target: { value: 'summary' },
      });
      expect(renderedKeys()).toEqual([]);
    });
  });
});
