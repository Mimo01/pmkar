import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, ChevronDown, Copy, Search, X } from 'lucide-react';
import type { JSX } from 'react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatTimestamp } from '../../lib/format';
import type { AuditEntry } from './types';

interface AuditLogPageProps {
  onClose: () => void;
}

/**
 * Safely coerce any value to a string for display. Objects/arrays are JSON-
 * stringified rather than rendered directly (which would crash React with
 * "Objects are not valid as a React child").
 *
 * Debug session: copy-400-and-logs-crash — defensive guard so a malformed
 * audit row cannot blank the entire page via the outer ErrorBoundary.
 */
function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unrenderable value]';
  }
}

function formatResponseBody(body: string | null | undefined): string {
  // Defensive: only operate on strings (Rust always sends string|null but a
  // schema drift or test fixture mismatch could land us with a non-string).
  if (body === null || body === undefined) return '';
  const text = typeof body === 'string' ? body : toDisplayString(body);
  if (!text) return '';
  // Try strict JSON parse + pretty-print first
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // JSON may be truncated (100 KB limit in audit middleware) — do a
    // best-effort visual format: add newlines after commas/braces for
    // readability.
    return text
      .replace(/,\s*"/g, ',\n"')
      .replace(/\{"/g, '{\n"')
      .replace(/"\}/g, '"\n}')
      .replace(/\[\{/g, '[\n{')
      .replace(/\}\]/g, '}\n]');
  }
}

function parseHeaders(raw: string | null | undefined): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function renderStatusBadge(code: number | null, t: (key: string) => string): JSX.Element {
  if (code === null) {
    return (
      <Badge
        variant="outline"
        className="text-xs font-mono bg-red-500/20 text-red-300 border-red-500/30"
      >
        {t('audit.status.error')}
      </Badge>
    );
  }
  if (code >= 200 && code < 300) {
    return (
      <Badge
        variant="outline"
        className="text-xs font-mono bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
      >
        {code}
      </Badge>
    );
  }
  if (code >= 300 && code < 400) {
    return (
      <Badge
        variant="outline"
        className="text-xs font-mono bg-amber-500/15 text-amber-400 border-amber-500/20"
      >
        {code}
      </Badge>
    );
  }
  if (code >= 400 && code < 500) {
    return (
      <Badge
        variant="outline"
        className="text-xs font-mono bg-red-500/15 text-red-400 border-red-500/20"
      >
        {code}
      </Badge>
    );
  }
  // 5xx and anything else
  return (
    <Badge
      variant="outline"
      className="text-xs font-mono bg-red-500/20 text-red-300 border-red-500/30"
    >
      {code}
    </Badge>
  );
}

/**
 * Tinted method badge classes — readable in both light and dark themes.
 * Mirrors the bg/border/text triple used by renderStatusBadge so methods feel
 * visually consistent with status codes.
 */
function methodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    case 'POST':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
    case 'PUT':
    case 'PATCH':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
    case 'DELETE':
      return 'bg-red-500/15 text-red-400 border-red-500/20';
    default:
      return 'bg-brand-surface-hover text-brand-text-secondary border-brand-border';
  }
}

const PAGE_SIZE = 50;
const COMMON_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;
const STATUS_CLASSES = ['2xx', '3xx', '4xx', '5xx', 'error'] as const;
type StatusClass = (typeof STATUS_CLASSES)[number] | 'all';
type MethodFilter = (typeof COMMON_METHODS)[number] | 'all' | 'other';

function statusMatches(code: number | null, klass: StatusClass): boolean {
  if (klass === 'all') return true;
  if (klass === 'error') return code === null;
  if (code === null) return false;
  if (klass === '2xx') return code >= 200 && code < 300;
  if (klass === '3xx') return code >= 300 && code < 400;
  if (klass === '4xx') return code >= 400 && code < 500;
  if (klass === '5xx') return code >= 500 && code < 600;
  return true;
}

function methodMatches(method: string, filter: MethodFilter): boolean {
  if (filter === 'all') return true;
  const upper = method.toUpperCase();
  if (filter === 'other') {
    return !COMMON_METHODS.includes(upper as (typeof COMMON_METHODS)[number]);
  }
  return upper === filter;
}

/**
 * Build the human-readable text representation copied to the clipboard. Format
 * is intentionally plain-text (no JSON) so it pastes cleanly into chat / email
 * / bug reports.
 */
export function buildCopyText(entry: AuditEntry): string {
  const lines: string[] = [];
  const ts = entry.timestamp ?? '';
  const status = entry.statusCode === null ? 'Error' : String(entry.statusCode);
  lines.push(`[${ts}] ${toDisplayString(entry.method)} ${toDisplayString(entry.url)}`);
  lines.push(`Status: ${status}`);
  lines.push('');
  lines.push('Request Headers:');
  const parsedHeaders = parseHeaders(entry.headers);
  if (parsedHeaders && Object.keys(parsedHeaders).length > 0) {
    for (const key of Object.keys(parsedHeaders)) {
      lines.push(`  ${key}: ${toDisplayString(parsedHeaders[key])}`);
    }
  } else {
    lines.push('  (none)');
  }
  lines.push('');
  lines.push('Response Body:');
  const body = formatResponseBody(entry.responseBody);
  lines.push(body ? body : '  (empty)');
  return lines.join('\n');
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard write failed', err);
  }
  return false;
}

/**
 * Safe wrapper for the formatTimestamp helper. Catches any unexpected throw
 * (e.g. exotic locale data) so a single bad timestamp cannot crash the page.
 */
function safeFormatTimestamp(ts: string | null | undefined): string {
  if (typeof ts !== 'string' || ts.length === 0) return '';
  try {
    return formatTimestamp(ts);
  } catch {
    return ts;
  }
}

export function AuditLogPage({ onClose }: AuditLogPageProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusClass>('all');

  // Copy feedback — keyed by row identifier (id or index fallback)
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    invoke<AuditEntry[]>('get_audit_logs_page', { offset: 0, limit: PAGE_SIZE })
      .then((data) => {
        // Defensive: ensure we always have an array, even if backend ever
        // returns something else.
        const rows = Array.isArray(data) ? data : [];
        setEntries(rows);
        setOffset(rows.length);
        if (rows.length < PAGE_SIZE) {
          setHasMore(false);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  // Cleanup any pending "Copied ✓" timer on unmount so tests / fast nav don't
  // leak state into the next render.
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await invoke<AuditEntry[]>('get_audit_logs_page', {
        offset,
        limit: PAGE_SIZE,
      });
      const rows = Array.isArray(data) ? data : [];
      setEntries((prev) => [...prev, ...rows]);
      setOffset((prev) => prev + rows.length);
      if (rows.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const filteredEntries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle && methodFilter === 'all' && statusFilter === 'all') return entries;
    return entries.filter((entry) => {
      const url = (entry.url ?? '').toLowerCase();
      const method = (entry.method ?? '').toLowerCase();
      if (needle && !url.includes(needle) && !method.includes(needle)) return false;
      if (!methodMatches(entry.method ?? '', methodFilter)) return false;
      if (!statusMatches(entry.statusCode, statusFilter)) return false;
      return true;
    });
  }, [entries, search, methodFilter, statusFilter]);

  const filtersActive = search.trim() !== '' || methodFilter !== 'all' || statusFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setMethodFilter('all');
    setStatusFilter('all');
  }

  async function handleCopy(entry: AuditEntry, rowKey: string) {
    const text = buildCopyText(entry);
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopiedKey(rowKey);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedKey(null), 1500);
  }

  function renderExpandedRow(entry: AuditEntry, rowKey: string): JSX.Element {
    // Defensive: catch any per-row render failure so one malformed entry can
    // never blank the whole page (debug session: copy-400-and-logs-crash).
    try {
      const parsed = parseHeaders(entry.headers);
      const headersBlock = parsed ? (
        Object.keys(parsed).length === 0 ? (
          <p className="text-xs text-brand-muted mt-1">{t('audit.headersEmpty')}</p>
        ) : (
          <div className="mt-1 rounded border border-brand-border divide-y divide-brand-border-subtle/50">
            {Object.keys(parsed).map((key) => (
              <div key={key} className="flex items-baseline gap-2 px-2 py-1">
                <span
                  className="shrink-0 font-mono text-[11px] font-semibold text-brand-text-secondary w-40 truncate"
                  title={key}
                >
                  {key}
                </span>
                <span className="font-mono text-[11px] text-brand-text break-all min-w-0">
                  {toDisplayString(parsed[key])}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        <pre className="mt-1 rounded border border-brand-border bg-black/20 px-2 py-2 whitespace-pre-wrap break-all font-mono text-xs text-brand-text">
          {toDisplayString(entry.headers)}
        </pre>
      );

      const isCopied = copiedKey === rowKey;

      return (
        <div className="space-y-3">
          {/* Copy action — top-right of the expanded panel */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => handleCopy(entry, rowKey)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-brand-text bg-brand-surface-hover hover:bg-brand-border rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface-raised"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              {isCopied ? t('audit.copied') : t('audit.copy')}
            </button>
          </div>

          {/* Full URL */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted">
              {t('audit.url')}
            </span>
            <p className="break-all font-mono text-xs text-brand-text mt-1">
              {toDisplayString(entry.url)}
            </p>
          </div>

          {/* Request headers as key/value rows */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted">
              {t('audit.requestHeaders')}
            </span>
            {headersBlock}
          </div>

          {/* Response body — pretty-printed JSON in a height-capped scroll panel */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted">
              {t('audit.response')}
            </span>
            {entry.responseBody ? (
              <div className="mt-1 rounded border border-brand-border bg-black/20 px-3 py-2 max-h-80 overflow-auto">
                <pre className="font-mono text-xs text-brand-text whitespace-pre">
                  {formatResponseBody(entry.responseBody)}
                </pre>
              </div>
            ) : (
              <p className="text-xs text-brand-muted mt-1">{t('audit.responseBodyEmpty')}</p>
            )}
          </div>
        </div>
      );
    } catch (err) {
      console.error('AuditLogPage row render failed', err, entry);
      return (
        <p className="text-xs text-red-400" data-testid="audit-row-render-error">
          {t('audit.loadError')}
        </p>
      );
    }
  }

  const showToolbar = !loading && !error;
  const showTable = !loading && !error && filteredEntries.length > 0;
  const showFilteredEmpty =
    !loading && !error && entries.length > 0 && filteredEntries.length === 0;
  const showEmpty = !loading && !error && entries.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header bar with back button and title */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-border bg-brand-surface">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded"
          aria-label={t('audit.close')}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {t('audit.back')}
        </button>
        <h1 className="text-base font-semibold text-brand-text">{t('audit.heading')}</h1>
      </div>

      {/* Filter toolbar */}
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-brand-border bg-brand-surface/60">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('audit.search.placeholder')}
              aria-label={t('audit.search.placeholder')}
              className="w-full pl-8 pr-2 py-1.5 text-sm bg-brand-surface border border-brand-border rounded-md text-brand-text placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-150"
            />
          </div>

          {/* Method filter */}
          <div className="relative">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as MethodFilter)}
              aria-label={t('audit.filter.method')}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-brand-surface border border-brand-border rounded-md text-brand-text focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-150 cursor-pointer"
            >
              <option value="all">
                {`${t('audit.filter.method')} — ${t('audit.filter.all')}`}
              </option>
              {COMMON_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-muted"
              aria-hidden="true"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusClass)}
              aria-label={t('audit.filter.status')}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-brand-surface border border-brand-border rounded-md text-brand-text focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-150 cursor-pointer"
            >
              <option value="all">
                {`${t('audit.filter.status')} — ${t('audit.filter.all')}`}
              </option>
              <option value="2xx">2xx</option>
              <option value="3xx">3xx</option>
              <option value="4xx">4xx</option>
              <option value="5xx">5xx</option>
              <option value="error">{t('audit.filter.error')}</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-muted"
              aria-hidden="true"
            />
          </div>

          {/* Result count + clear filters */}
          <div className="ml-auto flex items-center gap-3 text-xs text-brand-muted">
            <span aria-live="polite">
              {t('audit.count', { shown: filteredEntries.length, total: entries.length })}
            </span>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1 text-xs text-brand-text-secondary hover:text-brand-text bg-brand-surface-hover hover:bg-brand-border rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                {t('audit.filter.clear')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <ScrollArea className="flex-1">
          <table className="w-full table-fixed" aria-label="API audit log">
            <thead className="bg-brand-surface border-b-2 border-brand-border sticky top-0 z-10">
              <tr>
                <th className="w-40 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.time')}
                </th>
                <th className="w-20 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.method')}
                </th>
                <th className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.url')}
                </th>
                <th className="w-24 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-right">
                  {t('audit.col.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows are static, index is stable
                <tr key={i} className="border-b border-brand-border-subtle/50 animate-pulse">
                  <td className="w-40 px-4 py-2">
                    <div className="h-3 bg-brand-surface-hover rounded w-28" />
                  </td>
                  <td className="w-20 px-4 py-2">
                    <div className="h-3 bg-brand-surface-hover rounded w-10" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="h-3 bg-brand-surface-hover rounded w-full" />
                  </td>
                  <td className="w-24 px-4 py-2">
                    <div className="h-3 bg-brand-surface-hover rounded w-8 ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}

      {/* Error state */}
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-red-400">{t('audit.loadError')}</p>
        </div>
      )}

      {/* Empty state — no entries at all */}
      {showEmpty && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text mb-1">{t('audit.empty.heading')}</p>
          <p className="text-xs text-brand-muted text-center max-w-sm">{t('audit.empty.body')}</p>
        </div>
      )}

      {/* Empty state — entries exist but filtered out */}
      {showFilteredEmpty && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text mb-1">
            {t('audit.filter.empty.heading')}
          </p>
          <p className="text-xs text-brand-muted text-center max-w-sm mb-4">
            {t('audit.filter.empty.body')}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-brand-text bg-brand-surface-hover hover:bg-brand-border rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <X className="w-3 h-3" aria-hidden="true" />
              {t('audit.filter.clear')}
            </button>
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-3 py-1.5 text-xs font-medium text-brand-text bg-brand-surface-hover hover:bg-brand-border rounded transition-colors duration-150 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {loadingMore ? t('audit.loadingMore') : t('audit.loadMore')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Populated table */}
      {showTable && (
        <ScrollArea className="flex-1">
          <table className="w-full table-fixed" aria-label="API audit log">
            <thead className="bg-brand-surface border-b-2 border-brand-border sticky top-0 z-10">
              <tr>
                <th className="w-40 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.time')}
                </th>
                <th className="w-20 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.method')}
                </th>
                <th className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.url')}
                </th>
                <th className="w-24 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-right">
                  {t('audit.col.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, idx) => {
                // Stable key even when id is null (defensive — Rust always sets
                // Some(id), but TypeScript type allows null).
                const rowKey = entry.id !== null ? `id-${entry.id}` : `row-${idx}`;
                const isExpanded = entry.id !== null && expandedId === entry.id;
                return (
                  <Fragment key={rowKey}>
                    {/* Summary row */}
                    {/* biome-ignore lint/a11y/useSemanticElements: tr with role="button" is correct for expandable table rows — cannot use <button> inside <tbody> */}
                    <tr
                      onClick={() =>
                        setExpandedId(
                          entry.id !== null && expandedId === entry.id ? null : entry.id,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedId(
                            entry.id !== null && expandedId === entry.id ? null : entry.id,
                          );
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-expanded={isExpanded}
                      className="group border-b border-brand-border-subtle/50 hover:bg-brand-surface-hover cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]"
                    >
                      <td className="w-40 px-4 py-2 text-xs text-brand-text-secondary">
                        {safeFormatTimestamp(entry.timestamp)}
                      </td>
                      <td className="w-20 px-4 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-mono',
                            methodBadgeClass(toDisplayString(entry.method)),
                          )}
                        >
                          {toDisplayString(entry.method)}
                        </Badge>
                      </td>
                      <td
                        className="min-w-0 px-4 py-2 text-xs text-brand-text-secondary truncate"
                        title={toDisplayString(entry.url)}
                      >
                        {toDisplayString(entry.url)}
                      </td>
                      <td className="w-24 px-4 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          {renderStatusBadge(entry.statusCode, t)}
                          {!isExpanded && (
                            <ChevronDown
                              className="w-3 h-3 text-brand-muted opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="bg-brand-surface-raised px-4 py-3">
                          {renderExpandedRow(entry, rowKey)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {hasMore && entries.length > 0 && (
            <div className="flex justify-center py-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-sm font-medium text-brand-text bg-brand-surface-hover hover:bg-brand-border rounded-md transition-colors duration-150 disabled:opacity-50"
              >
                {loadingMore ? t('audit.loadingMore') : t('audit.loadMore')}
              </button>
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
