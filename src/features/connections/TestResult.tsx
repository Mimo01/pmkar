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

export function TestResult({ result, connectionType }: TestResultProps) {
  if (result === null) {
    return null;
  }

  if (result.success) {
    const jiraType = connectionType === 'server' ? 'Jira Server' : 'Jira Cloud';
    const version = result.serverVersion ?? 'version unavailable';
    const username = result.username ?? 'unknown';
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-sm text-green-600 dark:text-green-400"
      >
        {`Connected as ${username} — ${jiraType} v${version}`}
      </p>
    );
  }

  return (
    <p
      role="alert"
      aria-live="assertive"
      className="mt-2 text-sm text-red-600 dark:text-red-400"
    >
      {getErrorMessage(result)}
    </p>
  );
}
