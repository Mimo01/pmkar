import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, ChevronUp } from 'lucide-react';
import type { JSX } from 'react';
import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatTimestamp } from '../../lib/format';
import type { AuditEntry } from './types';

interface AuditLogPageProps {
  onClose: () => void;
}

function formatResponseBody(body: string | null): string {
  if (!body) return '';
  // Try strict JSON parse + pretty-print first
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // JSON may be truncated (10KB limit) — do a best-effort visual format:
    // add newlines after commas/braces for readability
    return body
      .replace(/,\s*"/g, ',\n"')
      .replace(/\{"/g, '{\n"')
      .replace(/"\}/g, '"\n}')
      .replace(/\[\{/g, '[\n{')
      .replace(/\}\]/g, '}\n]');
  }
}

function parseHeaders(raw: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
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

function methodColor(method: string): string {
  if (method === 'GET') return 'text-green-600';
  if (method === 'POST') return 'text-blue-600';
  if (method === 'PUT') return 'text-yellow-600';
  if (method === 'DELETE') return 'text-red-600';
  return 'text-brand-muted';
}

const PAGE_SIZE = 50;

export function AuditLogPage({ onClose }: AuditLogPageProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    invoke<AuditEntry[]>('get_audit_logs_page', { offset: 0, limit: PAGE_SIZE })
      .then((data) => {
        setEntries(data);
        setOffset(data.length);
        if (data.length < PAGE_SIZE) {
          setHasMore(false);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await invoke<AuditEntry[]>('get_audit_logs_page', {
        offset,
        limit: PAGE_SIZE,
      });
      setEntries((prev) => [...prev, ...data]);
      setOffset((prev) => prev + data.length);
      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  }

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
                <th className="w-20 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-right">
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
                  <td className="w-20 px-4 py-2">
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

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text mb-1">{t('audit.empty.heading')}</p>
          <p className="text-xs text-brand-muted text-center max-w-sm">{t('audit.empty.body')}</p>
        </div>
      )}

      {/* Populated table */}
      {!loading && !error && entries.length > 0 && (
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
                <th className="w-20 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-right">
                  {t('audit.col.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Fragment key={entry.id}>
                  {/* Summary row */}
                  {/* biome-ignore lint/a11y/useSemanticElements: tr with role="button" is correct for expandable table rows — cannot use <button> inside <tbody> */}
                  <tr
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedId(expandedId === entry.id ? null : entry.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-expanded={expandedId === entry.id}
                    className="border-b border-brand-border-subtle/50 hover:bg-brand-surface-hover cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]"
                  >
                    <td className="w-40 px-4 py-2 text-xs text-brand-text-secondary">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="w-20 px-4 py-2">
                      <Badge
                        variant="outline"
                        className={cn('text-xs font-mono', methodColor(entry.method))}
                      >
                        {entry.method}
                      </Badge>
                    </td>
                    <td className="max-w-0 px-4 py-2 text-xs text-brand-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
                      {entry.url}
                    </td>
                    <td className="w-20 px-4 py-2 text-right">
                      {renderStatusBadge(entry.statusCode, t)}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === entry.id && (
                    <tr>
                      <td colSpan={4} className="bg-brand-surface-raised px-4 py-3">
                        <div className="space-y-3">
                          {/* Expand/collapse indicator */}
                          <div className="flex items-center gap-1 text-xs text-brand-muted">
                            <ChevronUp className="w-3 h-3" aria-hidden="true" />
                          </div>

                          {/* Full URL */}
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted">
                              {t('audit.url')}
                            </span>
                            <p className="break-all font-mono text-xs text-brand-text mt-1">
                              {entry.url}
                            </p>
                          </div>

                          {/* Request headers as key/value rows */}
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted">
                              {t('audit.requestHeaders')}
                            </span>
                            {(() => {
                              const parsed = parseHeaders(entry.headers);
                              if (parsed) {
                                const keys = Object.keys(parsed);
                                return keys.length === 0 ? (
                                  <p className="text-xs text-brand-muted mt-1">
                                    {t('audit.headersEmpty')}
                                  </p>
                                ) : (
                                  <div className="mt-1 rounded border border-brand-border divide-y divide-brand-border-subtle/50">
                                    {keys.map((key) => (
                                      <div
                                        key={key}
                                        className="flex items-baseline gap-2 px-2 py-1"
                                      >
                                        <span
                                          className="shrink-0 font-mono text-[11px] font-semibold text-brand-text-secondary w-40 truncate"
                                          title={key}
                                        >
                                          {key}
                                        </span>
                                        <span className="font-mono text-[11px] text-brand-text break-all min-w-0">
                                          {parsed[key]}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              // Fallback: raw string
                              return (
                                <pre className="mt-1 rounded border border-brand-border bg-black/20 px-2 py-2 whitespace-pre-wrap break-all font-mono text-xs text-brand-text">
                                  {entry.headers}
                                </pre>
                              );
                            })()}
                          </div>

                          {/* Response body — pretty-printed JSON in a scrollable code block */}
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted">
                              {t('audit.response')}
                            </span>
                            {entry.responseBody ? (
                              <div className="mt-1 rounded border border-brand-border bg-black/20 px-3 py-2 overflow-x-auto">
                                <pre className="font-mono text-xs text-brand-text whitespace-pre">
                                  {formatResponseBody(entry.responseBody)}
                                </pre>
                              </div>
                            ) : (
                              <p className="text-xs text-brand-muted mt-1">
                                {t('audit.responseBodyEmpty')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
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
