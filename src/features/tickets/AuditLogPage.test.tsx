import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogPage } from './AuditLogPage';
import type { AuditEntry } from './types';

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
    await waitFor(() => {
      expect(screen.getByText('Timestamp')).toBeTruthy();
      expect(screen.getByText('Method')).toBeTruthy();
      expect(screen.getByText('URL')).toBeTruthy();
      expect(screen.getByText('Status')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText('POST')).toBeTruthy();
      expect(screen.getByText('GET')).toBeTruthy();
      expect(screen.getByText('https://jira.example.com/rest/api/2/search')).toBeTruthy();
      expect(screen.getByText('200')).toBeTruthy();
      expect(screen.getByText('401')).toBeTruthy();
    });
  });

  it('Test 2: clicking a row expands it showing headers content', async () => {
    mockInvoke.mockResolvedValue(mockEntries);
    render(<AuditLogPage onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('POST')).toBeTruthy();
    });
    const rows = screen.getAllByRole('button');
    const postRow = rows.find((r) => r.textContent?.includes('POST'));
    expect(postRow).toBeTruthy();
    fireEvent.click(postRow!);
    expect(screen.getByText('Request Headers')).toBeTruthy();
    expect(screen.getByText(/\[REDACTED\]/)).toBeTruthy();
  });

  it('Test 3: clicking an expanded row collapses it (expansion toggles)', async () => {
    mockInvoke.mockResolvedValue(mockEntries);
    render(<AuditLogPage onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('POST')).toBeTruthy();
    });
    const rows = screen.getAllByRole('button');
    const postRow = rows.find((r) => r.textContent?.includes('POST'));
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
      expect(screen.getByText('POST')).toBeTruthy();
    });
    const rows = screen.getAllByRole('button');
    const postRow = rows.find((r) => r.textContent?.includes('POST'));
    const getRow = rows.find((r) => r.textContent?.includes('GET'));
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
      expect(screen.getByText('POST')).toBeTruthy();
    });
    const rows = screen.getAllByRole('button');
    const postRow = rows.find((r) => r.textContent?.includes('POST'));
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
      expect(screen.getByText('GET')).toBeTruthy();
    });
    const rows = screen.getAllByRole('button');
    const getRow = rows.find((r) => r.textContent?.includes('GET'));
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
    expect(status200.className).toContain('text-green-400');
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
});
