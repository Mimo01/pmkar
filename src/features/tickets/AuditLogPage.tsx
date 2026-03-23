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
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
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
                    <td className="px-4 py-2 text-xs text-brand-text-secondary truncate">{entry.url}</td>
                    <td className={`w-16 px-4 py-2 text-xs font-semibold text-right ${statusColor(entry.statusCode)}`}>
                      {entry.statusCode ?? '\u2014'}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === entry.id && (
                    <tr>
                      <td colSpan={4} className="bg-brand-surface-raised px-4 py-3">
                        <div className="space-y-2">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted">
                              {t('audit.requestHeaders')}
                            </span>
                            <pre className="whitespace-pre-wrap break-all font-mono text-xs text-brand-text mt-1">
                              {entry.headers}
                            </pre>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted">
                              {t('audit.response')}
                            </span>
                            {entry.responseBody ? (
                              <pre className="whitespace-pre-wrap break-all font-mono text-xs text-brand-text mt-1">
                                {formatResponseBody(entry.responseBody)}
                              </pre>
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
