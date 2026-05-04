import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogPage, buildCopyText } from './AuditLogPage';
import type { AuditEntry, MappingAuditEntry } from './types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

const mockEntries: AuditEntry[] = [
  {
    id: 2,
    timestamp: '2026-03-23T10:00:00Z',
    method: 'POST',
    url: 'https://jira.example.com/rest/api/2/search',
    headers: '{"authorization": "[REDACTED]", "content-type": "application/json"}',
    statusCode: 200,
    responseBody: '{"total":5,"issues":[]}',
  },
  {
    id: 1,
    timestamp: '2026-03-23T09:59:00Z',
    method: 'GET',
    url: 'https://jira.example.com/rest/api/2/myself',
    headers: '{"authorization": "[REDACTED]"}',
    statusCode: 401,
    responseBody: null,
  },
];

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test 10: renders page heading "API Audit Log"', async () => {
    mockInvoke.mockResolvedValue(mockEntries);
    render(<AuditLogPage onClose={() => {}} />);
    expect(screen.getByText('API Audit Log')).toBeTruthy();
  });

  it('Test 1: renders audit entries in a table with Timestamp, Method, URL, Status columns', async () => {
    mockInvoke.mockResolvedValue(mockEntries);
    render(<AuditLogPage onClose={() => {}} />);
    // Column headers — scope to the table so toolbar select labels don't collide
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(within(table).getByText('Timestamp')).toBeTruthy();
      expect(within(table).getByText('Method')).toBeTruthy();
      expect(within(table).getByText('URL')).toBeTruthy();
      expect(within(table).getByText('Status')).toBeTruthy();
    });
    // Data cells — scope to tbody (toolbar select <option>POST</option> would otherwise collide)
    await waitFor(() => {
      const table = screen.getByRole('table');
      const tbody = table.querySelector('tbody') as HTMLElement;
      expect(within(tbody).getByText('POST')).toBeTruthy();
      expect(within(tbody).getByText('GET')).toBeTruthy();
      expect(within(tbody).getByText('https://jira.example.com/rest/api/2/search')).toBeTruthy();
      expect(within(tbody).getByText('200')).toBeTruthy();
      expect(within(tbody).getByText('401')).toBeTruthy();
    });
  });

  // Helper: get only the table-row buttons (filters out toolbar copy buttons,
  // which also have role="button"). Rows are <tr role="button">.
  function getRowButtons(): HTMLElement[] {
    return screen.getAllByRole('button').filter((el) => el.tagName === 'TR');
  }

  it('Test 2: clicking a row expands it showing headers content', async () => {
    mockInvoke.mockResolvedValue(mockEntries);
    render(<AuditLogPage onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('https://jira.example.com/rest/api/2/search')).toBeTruthy();
    });
    const postRow = getRowButtons().find((r) => r.textContent?.includes('POST'));
    expect(postRow).toBeTruthy();
    fireEvent.click(postRow!);
    expect(screen.getByText('Request Headers')).toBeTruthy();
    expect(screen.getByText(/\[REDACTED\]/)).toBeTruthy();
  });

  it('Test 3: clicking an expanded row collapses it (expansion toggles)', async () => {
    mockInvoke.mockResolvedValue(mockEntries);
    render(<AuditLogPage onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('https://jira.example.com/rest/api/2/search')).toBeTruthy();
    });
    const postRow = getRowButtons().find((r) => r.textContent?.includes('POST'));
    expect(postRow).toBeTruthy();
    fireEvent.click(postRow!);
    expect(screen.getByText('Request Headers')).toBeTruthy();
    fireEvent.click(postRow!);
    expect(screen.queryByText('Request Headers')).toBeNull();
  });

  it('Test 4: only one row expanded at a time (expanding row B collapses row A)', async () => {
    mockInvoke.mockResolvedValue(mockEntries);
    render(<AuditLogPage onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('https://jira.example.com/rest/api/2/search')).toBeTruthy();
    });
    const postRow = getRowButtons().find((r) => r.textContent?.includes('POST'));
    const getRow = getRowButtons().find((r) => r.textContent?.includes('GET'));
    expect(postRow).toBeTruthy();
    expect(getRow).toBeTruthy();
    fireEvent.click(postRow!);
    expect(screen.getAllByText('Request Headers').length).toBe(1);
    fireEvent.click(getRow!);
    // After clicking GET row, only one expanded section should exist
    expect(screen.getAllByText('Request Headers').length).toBe(1);
    // The GET row should now be expanded (aria-expanded=true)
    expect(getRow?.getAttribute('aria-expanded')).toBe('true');
  });

  it('Test 5: empty state shows heading and body text', async () => {
    mockInvoke.mockResolvedValue([]);
    render(<AuditLogPage onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('No API calls recorded yet')).toBeTruthy();
      expect(screen.getByText('Fetch or copy a ticket to see activity.')).toBeTruthy();
    });
  });

  it('Test 6: JSON response body is pretty-printed in expanded panel', async () => {
    mockInvoke.mockResolvedValue(mockEntries);
    render(<AuditLogPage onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('https://jira.example.com/rest/api/2/search')).toBeTruthy();
    });
    const postRow = getRowButtons().find((r) => r.textContent?.includes('POST'));
    expect(postRow).toBeTruthy();
    fireEvent.click(postRow!);
    // Pretty-printed JSON has newlines and indentation
    const responseSection = screen.getByText(/Response Body/i, { selector: 'span' });
    expect(responseSection).toBeTruthy();
    // The pretty-printed JSON should contain formatted output (with newlines)
    const preElements = document.querySelectorAll('pre');
    const hasFormattedJson = Array.from(preElements).some(
      (pre) => pre.textContent?.includes('"total"') && pre.textContent?.includes('"issues"'),
    );
    expect(hasFormattedJson).toBe(true);
  });

  it('Test 7: null response body shows "Response body not recorded" message', async () => {
    mockInvoke.mockResolvedValue(mockEntries);
    render(<AuditLogPage onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('https://jira.example.com/rest/api/2/myself')).toBeTruthy();
    });
    const getRow = getRowButtons().find((r) => r.textContent?.includes('GET'));
    expect(getRow).toBeTruthy();
    fireEvent.click(getRow!);
    expect(screen.getByText('Response body not recorded')).toBeTruthy();
  });

  it('Test 8: status code colors: 2xx green-400, 4xx/5xx red-400', async () => {
    mockInvoke.mockResolvedValue(mockEntries);
    render(<AuditLogPage onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('200')).toBeTruthy();
    });
    const status200 = screen.getByText('200');
    expect(status200.className).toContain('text-emerald-400');
    const status401 = screen.getByText('401');
    expect(status401.className).toContain('text-red-400');
  });

  it('Test 9: back/close button calls onClose callback', async () => {
    mockInvoke.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<AuditLogPage onClose={onClose} />);
    const closeButton = screen.getByLabelText('Close audit log');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Filter toolbar tests (260429-v9y)
  describe('filter toolbar', () => {
    function tbody(): HTMLElement {
      return screen.getByRole('table').querySelector('tbody') as HTMLElement;
    }

    it('search filters by URL substring (case-insensitive)', async () => {
      mockInvoke.mockResolvedValue(mockEntries);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(within(tbody()).getByText('POST')).toBeTruthy();
      });
      const searchInput = screen.getByLabelText('Search URL or method') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'MYSELF' } });
      // GET /myself remains, POST /search is filtered out
      expect(within(tbody()).getByText('GET')).toBeTruthy();
      expect(within(tbody()).queryByText('POST')).toBeNull();
    });

    it('method filter narrows entries to selected method', async () => {
      mockInvoke.mockResolvedValue(mockEntries);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(within(tbody()).getByText('POST')).toBeTruthy();
      });
      const methodSelect = screen.getByLabelText('Method') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'GET' } });
      expect(within(tbody()).queryByText('POST')).toBeNull();
      expect(within(tbody()).getByText('GET')).toBeTruthy();
    });

    it('status filter narrows entries by status class', async () => {
      mockInvoke.mockResolvedValue(mockEntries);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(within(tbody()).getByText('200')).toBeTruthy();
      });
      const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
      fireEvent.change(statusSelect, { target: { value: '4xx' } });
      expect(within(tbody()).queryByText('200')).toBeNull();
      expect(within(tbody()).getByText('401')).toBeTruthy();
    });

    it('result count reflects filtered entries', async () => {
      mockInvoke.mockResolvedValue(mockEntries);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(screen.getByText('2 of 2')).toBeTruthy();
      });
      const searchInput = screen.getByLabelText('Search URL or method');
      fireEvent.change(searchInput, { target: { value: 'myself' } });
      expect(screen.getByText('1 of 2')).toBeTruthy();
    });

    it('Load more remains available while filters are active', async () => {
      // 50 entries (PAGE_SIZE) with id=1..50; first response is full → hasMore stays true
      const fullPage: AuditEntry[] = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        timestamp: '2026-04-29T12:00:00Z',
        method: i % 2 === 0 ? 'GET' : 'POST',
        url: `https://jira.example.com/rest/api/2/issue/${i + 1}`,
        headers: '{}',
        statusCode: 200,
        responseBody: null,
      }));
      mockInvoke.mockResolvedValue(fullPage);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(within(tbody()).getAllByText('GET').length).toBeGreaterThan(0);
      });
      // Activate filter
      const methodSelect = screen.getByLabelText('Method') as HTMLSelectElement;
      fireEvent.change(methodSelect, { target: { value: 'GET' } });
      // Load more button should remain available (hasMore + filtered list non-empty)
      expect(screen.getByText('Load more')).toBeTruthy();
    });

    it('Load more button is shown in the filtered-empty state when more pages may exist', async () => {
      const fullPage: AuditEntry[] = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        timestamp: '2026-04-29T12:00:00Z',
        method: 'GET',
        url: `https://jira.example.com/rest/api/2/issue/${i + 1}`,
        headers: '{}',
        statusCode: 200,
        responseBody: null,
      }));
      mockInvoke.mockResolvedValue(fullPage);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(within(tbody()).getAllByText('GET').length).toBeGreaterThan(0);
      });
      // Filter with no matches in the loaded page
      const searchInput = screen.getByLabelText('Search URL or method');
      fireEvent.change(searchInput, { target: { value: 'no-match-zzz' } });
      expect(screen.getByText('No matching log entries')).toBeTruthy();
      // Load more should be offered alongside Clear filters
      expect(screen.getByText('Load more')).toBeTruthy();
    });

    it('shows filtered-empty state with clear-filters button when no rows match', async () => {
      mockInvoke.mockResolvedValue(mockEntries);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(within(tbody()).getByText('POST')).toBeTruthy();
      });
      const searchInput = screen.getByLabelText('Search URL or method');
      fireEvent.change(searchInput, { target: { value: 'no-match-anywhere-zzz' } });
      expect(screen.getByText('No matching log entries')).toBeTruthy();
      // The Clear filters button in the empty state restores the list
      const clearButtons = screen.getAllByText('Clear filters');
      fireEvent.click(clearButtons[0]);
      // Table re-appears with both rows
      expect(within(tbody()).getByText('POST')).toBeTruthy();
      expect(within(tbody()).getByText('GET')).toBeTruthy();
    });
  });

  // Copy-log button tests (260429-v9y)
  describe('copy log entry', () => {
    it('expanded-panel Copy button writes formatted text to clipboard', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      mockInvoke.mockResolvedValue(mockEntries);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(screen.getByText('https://jira.example.com/rest/api/2/search')).toBeTruthy();
      });
      const postRow = getRowButtons().find((r) => r.textContent?.includes('POST'));
      fireEvent.click(postRow!);
      // The expanded-panel button's accessible name is "Copy" (visible text);
      // it's the only Copy button on the page.
      const copyButton = screen.getByRole('button', { name: 'Copy' });
      await act(async () => {
        fireEvent.click(copyButton);
      });
      expect(writeText).toHaveBeenCalledTimes(1);
      const text = writeText.mock.calls[0][0] as string;
      expect(text).toContain('POST');
      expect(text).toContain('https://jira.example.com/rest/api/2/search');
      expect(text).toContain('Status: 200');
      expect(text).toContain('Request Headers');
      expect(text).toContain('Response Body');
    });

    it('Copy button is only present when a row is expanded', async () => {
      mockInvoke.mockResolvedValue(mockEntries);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(screen.getByText('https://jira.example.com/rest/api/2/search')).toBeTruthy();
      });
      // No row expanded → no Copy button
      expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
      // Expand a row → Copy button appears
      const postRow = getRowButtons().find((r) => r.textContent?.includes('POST'));
      fireEvent.click(postRow!);
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });

    it('buildCopyText formats the entry as readable plain text', () => {
      const text = buildCopyText(mockEntries[0]);
      expect(text).toContain('[2026-03-23T10:00:00Z]');
      expect(text).toContain('POST https://jira.example.com/rest/api/2/search');
      expect(text).toContain('Status: 200');
      expect(text).toContain('  authorization: [REDACTED]');
      expect(text).toContain('"total": 5');
    });

    it('buildCopyText reports "Error" for entries with null status', () => {
      const entry: AuditEntry = {
        id: 99,
        timestamp: '2026-04-29T12:00:00Z',
        method: 'POST',
        url: 'https://jira.example.com/rest/api/2/search',
        headers: '{}',
        statusCode: null,
        responseBody: null,
      };
      const text = buildCopyText(entry);
      expect(text).toContain('Status: Error');
      expect(text).toContain('(empty)');
    });
  });

  // Defensive tests — debug session: copy-400-and-logs-crash
  describe('defensive rendering (copy-400-and-logs-crash)', () => {
    it('does not crash when a header value is a non-string (object)', async () => {
      // Backend type says Record<string,string> but JSON.parse of a malformed
      // entry could yield an object value. Direct {value} render would throw
      // "Objects are not valid as a React child". The fix coerces with
      // toDisplayString which JSON-stringifies the object.
      const badEntry: AuditEntry = {
        id: 99,
        timestamp: '2026-04-29T12:00:00Z',
        method: 'POST',
        url: 'https://jira.example.com/rest/api/3/issue',
        // Object value (not string) — this would have crashed previously.
        headers: '{"authorization": "[REDACTED]", "x-meta": {"nested": true}}',
        statusCode: 400,
        responseBody: '{"errorMessages":[],"errors":{"project":"valid project is required"}}',
      };
      mockInvoke.mockResolvedValue([badEntry]);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(screen.getByText('https://jira.example.com/rest/api/3/issue')).toBeTruthy();
      });
      const row = getRowButtons().find((r) => r.textContent?.includes('POST'));
      expect(row).toBeTruthy();
      fireEvent.click(row!);
      // The expanded panel should render — and the nested object should appear
      // as a serialized string, not crash the page.
      expect(screen.getByText('Request Headers')).toBeTruthy();
      expect(screen.getByText('"valid project is required"', { exact: false })).toBeTruthy();
      // Nested object value rendered as JSON string
      const allText = document.body.textContent ?? '';
      expect(allText.includes('"nested":true') || allText.includes('"nested": true')).toBe(true);
    });

    it('does not crash when entry.id is null (defensive — uses index fallback for key)', async () => {
      const entries: AuditEntry[] = [
        {
          id: null,
          timestamp: '2026-04-29T12:00:00Z',
          method: 'GET',
          url: 'https://jira.example.com/rest/api/2/myself',
          headers: '{"authorization": "[REDACTED]"}',
          statusCode: null,
          responseBody: null,
        },
        {
          id: null,
          timestamp: '2026-04-29T12:00:01Z',
          method: 'GET',
          url: 'https://jira.example.com/rest/api/2/myself',
          headers: '{"authorization": "[REDACTED]"}',
          statusCode: null,
          responseBody: null,
        },
      ];
      mockInvoke.mockResolvedValue(entries);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        // Two GET badges in tbody (toolbar select option also says "GET" but
        // is excluded by tbody scoping)
        const tbody = screen.getByRole('table').querySelector('tbody') as HTMLElement;
        expect(within(tbody).getAllByText('GET').length).toBe(2);
      });
      // Should render both rows without React duplicate-key warning crash
      expect(getRowButtons().filter((r) => r.textContent?.includes('GET')).length).toBe(2);
    });

    it('does not crash when invoke resolves with non-array (defensive)', async () => {
      // Should not happen normally but harden against backend regression.
      mockInvoke.mockResolvedValue(null as unknown as AuditEntry[]);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(screen.getByText('No API calls recorded yet')).toBeTruthy();
      });
    });

    it('renders 4xx response body so user can read Jira error without opening individual rows', async () => {
      // The actual user-visible diagnostic for Issue A (copy 400). Verifies that
      // when a row is expanded, the response body shows the Jira error JSON.
      const entry: AuditEntry = {
        id: 7,
        timestamp: '2026-04-29T12:00:00Z',
        method: 'POST',
        url: 'https://jira.example.com/rest/api/3/issue',
        headers: '{"authorization": "[REDACTED]"}',
        statusCode: 400,
        responseBody:
          '{"errorMessages":[],"errors":{"customfield_10001":"Field does not exist or you do not have permission"}}',
      };
      mockInvoke.mockResolvedValue([entry]);
      render(<AuditLogPage onClose={() => {}} />);
      await waitFor(() => {
        expect(screen.getByText('400')).toBeTruthy();
      });
      const row = getRowButtons().find((r) => r.textContent?.includes('POST'));
      fireEvent.click(row!);
      // The pretty-printed body should contain the user-actionable Jira message.
      const allText = document.body.textContent ?? '';
      expect(allText).toContain('customfield_10001');
      expect(allText).toContain('Field does not exist');
    });
  });

  // Field Transformations tab tests (quick task 260430-0tj)
  describe('Field Transformations tab', () => {
    const mockMappingEntries: MappingAuditEntry[] = [
      {
        id: 2,
        copyId: 'aaaabbbb-cccc-dddd-eeee-ffffffffffff',
        fieldId: 'summary',
        sourceValueHash: 'h1',
        targetValueHash: 'h2',
        wasOverridden: false,
        gapKind: null,
        transformerKind: 'identity',
        outcome: 'ok',
        failureReason: null,
        timestamp: '2026-04-30T10:00:00Z',
      },
      {
        id: 1,
        copyId: '11112222-3333-4444-5555-666677778888',
        fieldId: 'assignee',
        sourceValueHash: 'h3',
        targetValueHash: 'h4',
        wasOverridden: false,
        gapKind: 'person',
        transformerKind: 'user',
        outcome: 'failed',
        failureReason: 'unresolved person',
        timestamp: '2026-04-30T09:00:00Z',
      },
    ];

    it('mapping_audit_tab_renders_rows: mock returns 2 rows, click tab, assert rows render', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_audit_logs_page') return Promise.resolve(mockEntries);
        if (cmd === 'get_mapping_audit_log_page') return Promise.resolve(mockMappingEntries);
        return Promise.resolve([]);
      });
      render(<AuditLogPage onClose={() => {}} />);

      // Click the Field Transformations tab
      const tab = screen.getByRole('tab', { name: /field transformations/i });
      fireEvent.click(tab);

      // Quick task 260430-26i: rows are now grouped by copyId and collapsed by
      // default. Each row has its own copyId here so we get two groups; expand
      // both before asserting field-id contents.
      await waitFor(() => {
        expect(
          screen.getAllByRole('button', { name: /Expand transformation group/i }),
        ).toHaveLength(2);
      });
      const groupButtons = screen.getAllByRole('button', { name: /Expand transformation group/i });
      for (const btn of groupButtons) fireEvent.click(btn);

      // Both field ids should appear
      await waitFor(() => {
        expect(screen.getByText('summary')).toBeTruthy();
        expect(screen.getByText('assignee')).toBeTruthy();
      });

      // Outcome badges
      const allText = document.body.textContent ?? '';
      expect(allText).toContain('ok');
      expect(allText).toContain('failed');
    });

    it('mapping_audit_empty_state: mock returns [], click tab, assert empty-state message', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_audit_logs_page') return Promise.resolve(mockEntries);
        if (cmd === 'get_mapping_audit_log_page') return Promise.resolve([]);
        return Promise.resolve([]);
      });
      render(<AuditLogPage onClose={() => {}} />);

      const tab = screen.getByRole('tab', { name: /field transformations/i });
      fireEvent.click(tab);

      await waitFor(() => {
        expect(screen.getByText('No field transformations recorded yet.')).toBeTruthy();
      });
    });
  });
});
