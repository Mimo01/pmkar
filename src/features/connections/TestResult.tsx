import { useTranslation } from 'react-i18next';
import type { ConnectionTestResult } from './types';

interface TestResultProps {
  result: ConnectionTestResult | null;
  connectionType: 'server' | 'cloud';
}

function SuccessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 flex-shrink-0" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 flex-shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export function TestResult({ result, connectionType }: TestResultProps) {
  const { t } = useTranslation();

  if (result === null) {
    return null;
  }

  if (result.success) {
    const jiraType = connectionType === 'server' ? 'Jira Server' : 'Jira Cloud';
    const version = result.serverVersion ?? 'version unavailable';
    const username = result.username ?? 'unknown';
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2.5 mt-3 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
      >
        <SuccessIcon />
        <span className="text-sm text-emerald-300">
          {t('connection.test.connected', { username, jiraType, version })}
        </span>
      </div>
    );
  }

  function getErrorMessage(r: ConnectionTestResult): string {
    switch (r.errorKind) {
      case 'auth':
        return t('connection.test.auth');
      case 'forbidden':
        return t('connection.test.forbidden');
      case 'rate_limit': {
        const secs = r.retryAfterSecs ?? null;
        if (secs !== null) {
          return t('connection.test.rateLimited', { secs });
        }
        return t('connection.test.rateLimitedFew');
      }
      case 'server_error':
        return t('connection.test.serverError');
      case 'network':
        return t('connection.test.network');
      default:
        return t('connection.test.unexpected');
    }
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center gap-2.5 mt-3 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20"
    >
      <ErrorIcon />
      <span className="text-sm text-red-300">
        {getErrorMessage(result)}
      </span>
    </div>
  );
}
