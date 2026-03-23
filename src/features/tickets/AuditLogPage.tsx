import { Fragment, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
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

function statusColor(code: number | null): string {
  if (!code) return 'text-brand-muted';
  if (code >= 200 && code < 300) return 'text-green-400';
  if (code >= 300 && code < 400) return 'text-yellow-400';
  return 'text-red-400';
}

function methodColor(method: string): string {
  if (method === 'GET') return 'text-brand-muted';
  return 'text-brand-text-secondary';
}

export function AuditLogPage({ onClose }: AuditLogPageProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    invoke<AuditEntry[]>('get_audit_logs')
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header bar with title and close button */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
        <h1 className="text-xl font-semibold text-brand-text">{t('audit.heading')}</h1>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center text-brand-muted hover:text-brand-text hover:bg-brand-surface-hover rounded-lg transition-colors duration-150"
          aria-label={t('audit.close')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="overflow-y-auto flex-1">
          <table className="w-full table-fixed">
            <thead className="bg-brand-surface border-b-2 border-brand-border sticky top-0 z-10">
              <tr>
                <th className="w-40 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.time')}
                </th>
                <th className="w-16 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.method')}
                </th>
                <th className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.url')}
                </th>
                <th className="w-16 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-right">
                  {t('audit.col.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-brand-border-subtle/50 animate-pulse">
                  <td className="w-40 px-4 py-2">
                    <div className="h-3 bg-brand-surface-hover rounded w-28" />
                  </td>
                  <td className="w-16 px-4 py-2">
                    <div className="h-3 bg-brand-surface-hover rounded w-8" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="h-3 bg-brand-surface-hover rounded w-full" />
                  </td>
                  <td className="w-16 px-4 py-2">
                    <div className="h-3 bg-brand-surface-hover rounded w-8 ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-red-400">
            {t('audit.loadError')}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text-secondary mb-1">{t('audit.empty')}</p>
          <p className="text-xs text-brand-muted">{t('audit.empty.hint')}</p>
        </div>
      )}

      {/* Populated table */}
      {!loading && !error && entries.length > 0 && (
        <div className="overflow-y-auto flex-1">
          <table className="w-full table-fixed">
            <thead className="bg-brand-surface border-b-2 border-brand-border sticky top-0 z-10">
              <tr>
                <th className="w-40 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.time')}
                </th>
                <th className="w-16 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.method')}
                </th>
                <th className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  {t('audit.col.url')}
                </th>
                <th className="w-16 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-right">
                  {t('audit.col.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Fragment key={entry.id}>
                  {/* Summary row */}
                  <tr
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className="border-b border-brand-border-subtle/50 hover:bg-brand-surface-hover cursor-pointer transition-colors duration-100"
                    aria-label={`Expand row for ${entry.method} ${entry.url}`}
                  >
                    <td className="w-40 px-4 py-2 text-xs text-brand-text-secondary">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className={`w-16 px-4 py-2 text-xs font-semibold ${methodColor(entry.method)}`}>
                      {entry.method}
                    </td>
                    <td className="max-w-0 px-4 py-2 text-xs text-brand-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">{entry.url}</td>
                    <td className={`w-16 px-4 py-2 text-xs font-semibold text-right ${statusColor(entry.statusCode)}`}>
                      {entry.statusCode ?? '\u2014'}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === entry.id && (
                    <tr>
                      <td colSpan={4} className="bg-brand-surface-raised px-4 py-3">
                        <div className="space-y-3">
                          {/* Full URL */}
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted">
                              {t('audit.url')}
                            </span>
                            <p className="break-all font-mono text-xs text-brand-text mt-1">{entry.url}</p>
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
                                  <p className="text-xs text-brand-muted mt-1">{t('audit.headersEmpty')}</p>
                                ) : (
                                  <div className="mt-1 rounded border border-brand-border divide-y divide-brand-border-subtle/50">
                                    {keys.map((key) => (
                                      <div key={key} className="flex items-baseline gap-2 px-2 py-1">
                                        <span className="shrink-0 font-mono text-[11px] font-semibold text-brand-text-secondary w-40 truncate" title={key}>
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
                                <pre className="font-mono text-xs text-brand-text whitespace-pre">{formatResponseBody(entry.responseBody)}</pre>
                              </div>
                            ) : (
                              <p className="text-xs text-brand-muted mt-1">{t('audit.responseBodyEmpty')}</p>
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
        </div>
      )}
    </div>
  );
}
