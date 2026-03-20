import type { ConnectionTestResult } from './types';

interface TestResultProps {
  result: ConnectionTestResult | null;
  connectionType: 'server' | 'cloud';
}

function getErrorMessage(result: ConnectionTestResult): string {
  switch (result.errorKind) {
    case 'auth':
      return 'Authentication failed — check your PAT is valid';
    case 'forbidden':
      return 'PAT lacks required permissions';
    case 'rate_limit': {
      const secs = result.retryAfterSecs ?? null;
      return `Rate limited — try again in ${secs !== null ? secs : 'a few'} seconds`;
    }
    case 'server_error':
      return 'Server error — try again later';
    case 'network':
      return 'Cannot reach server — check URL';
    default:
      return 'An unexpected error occurred — try again';
  }
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
          Connected as {username} — {jiraType} v{version}
        </span>
      </div>
    );
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
