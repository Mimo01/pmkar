import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SecretInput } from './SecretInput';
import { TestResult } from './TestResult';
import type { ConnectionTestResult } from './types';

interface ServerCredentials {
  baseUrl: string;
  pat: string;
}

interface CloudCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

type Credentials = ServerCredentials | CloudCredentials;

interface InitialValues {
  baseUrl?: string;
  username?: string;
}

interface ConnectionFormProps {
  connectionType: 'server' | 'cloud';
  initialValues?: InitialValues;
  onTestSuccess: (result: ConnectionTestResult, credentials: Credentials) => void;
  onTestInvalidated: () => void;
}

function SpinnerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

const SERVER_PAT_HELP_URL =
  'https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html';
const CLOUD_API_TOKEN_HELP_URL =
  'https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/';

export function ConnectionForm({
  connectionType,
  initialValues,
  onTestSuccess,
  onTestInvalidated,
}: ConnectionFormProps) {
  const [baseUrl, setBaseUrl] = useState(initialValues?.baseUrl ?? '');
  const [urlError, setUrlError] = useState('');

  // Server-only
  const [pat, setPat] = useState('');

  // Cloud-only
  const [email, setEmail] = useState(connectionType === 'cloud' ? (initialValues?.username ?? '') : '');
  const [apiToken, setApiToken] = useState('');

  // Pre-fill secret from keychain when editing
  useEffect(() => {
    if (!initialValues?.username) return;
    const keychainType = connectionType === 'server' ? 'jira-server' : 'jira-cloud';
    const keychainUser = connectionType === 'cloud' ? (initialValues.username ?? '') : (initialValues.username ?? '');
    invoke<string>('get_credential', { connectionType: keychainType, username: keychainUser })
      .then((secret) => {
        if (connectionType === 'server') {
          setPat(secret);
        } else {
          setApiToken(secret);
        }
      })
      .catch(() => { /* credential not found — leave empty */ });
  }, []);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  // Snapshot of values at last successful test
  const testedValuesRef = useRef<Credentials | null>(null);

  // Always-current credentials ref — updated via useEffect to avoid stale closures in timeouts
  const currentCredentialsRef = useRef<Credentials>(
    connectionType === 'server' ? { baseUrl, pat } : { baseUrl, email, apiToken },
  );

  useEffect(() => {
    if (connectionType === 'server') {
      currentCredentialsRef.current = { baseUrl, pat };
    } else {
      currentCredentialsRef.current = { baseUrl, email, apiToken };
    }
  });

  function getCurrentCredentials(): Credentials {
    return currentCredentialsRef.current;
  }

  function credentialsMatchTested(): boolean {
    const current = getCurrentCredentials();
    const tested = testedValuesRef.current;
    if (!tested) return false;
    return JSON.stringify(current) === JSON.stringify(tested);
  }

  function isLocalhost(url: string): boolean {
    try {
      const u = new URL(url);
      return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }

  function handleUrlBlur() {
    let trimmed = baseUrl.trimEnd().replace(/\/+$/, '');
    setBaseUrl(trimmed);
    if (!trimmed) {
      setUrlError('');
    } else if (trimmed.startsWith('https://')) {
      setUrlError('');
    } else if (trimmed.startsWith('http://') && isLocalhost(trimmed)) {
      setUrlError('');
    } else if (trimmed.startsWith('http://')) {
      setUrlError('HTTPS required for non-local URLs');
    } else {
      setUrlError('URL must start with https://');
    }
  }

  function handleFieldChange(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      setTimeout(() => {
        if (testedValuesRef.current !== null && !credentialsMatchTested()) {
          testedValuesRef.current = null;
          setTestResult(null);
          onTestInvalidated();
        }
      }, 0);
    };
  }

  function handleBaseUrlChange(value: string) {
    setBaseUrl(value);
    if (urlError) setUrlError('');
    setTimeout(() => {
      if (testedValuesRef.current !== null && !credentialsMatchTested()) {
        testedValuesRef.current = null;
        setTestResult(null);
        onTestInvalidated();
      }
    }, 0);
  }

  const hasValidUrl = !urlError && (baseUrl.startsWith('https://') || (baseUrl.startsWith('http://') && isLocalhost(baseUrl)));
  const canTest = hasValidUrl && !testing;

  async function handleTest() {
    if (!canTest) return;
    setTesting(true);
    setTestResult(null);

    try {
      let result: ConnectionTestResult;
      const credentials = getCurrentCredentials();

      if (connectionType === 'server') {
        const { pat: serverPat } = credentials as ServerCredentials;
        result = await invoke<ConnectionTestResult>('test_jira_server_connection', {
          baseUrl: baseUrl.replace(/\/+$/, ''),
          pat: serverPat,
        });
      } else {
        const { email: cloudEmail, apiToken: cloudToken } = credentials as CloudCredentials;
        result = await invoke<ConnectionTestResult>('test_jira_cloud_connection', {
          baseUrl: baseUrl.replace(/\/+$/, ''),
          email: cloudEmail,
          apiToken: cloudToken,
        });
      }

      setTestResult(result);

      if (result.success) {
        testedValuesRef.current = credentials;
        onTestSuccess(result, credentials);
      }
    } catch {
      setTestResult({
        success: false,
        username: null,
        serverVersion: null,
        errorKind: 'network',
        retryAfterSecs: null,
      });
    } finally {
      setTesting(false);
    }
  }

  const inputClass = [
    'w-full rounded-lg border border-slate-700/50 bg-slate-800/50',
    'text-slate-100 placeholder-slate-500',
    'px-3 py-2.5 text-sm',
    'focus:outline-none focus:ring-2 focus:ring-red-600/40 focus:border-red-600/50',
    'transition-all duration-200',
    testing ? 'opacity-40 cursor-not-allowed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 backdrop-blur-sm">
      {/* Base URL field */}
      <div className="space-y-2">
        <label
          htmlFor="base-url"
          className="text-sm font-medium text-slate-300"
        >
          Base URL
        </label>
        <input
          id="base-url"
          type="url"
          value={baseUrl}
          onChange={(e) => handleBaseUrlChange(e.target.value)}
          onBlur={handleUrlBlur}
          disabled={testing}
          placeholder="https://jira.example.com"
          className={inputClass}
        />
        {urlError && (
          <p className="text-xs text-red-400">{urlError}</p>
        )}
      </div>

      {/* Server: PAT field */}
      {connectionType === 'server' && (
        <SecretInput
          id="pat"
          label="Personal Access Token"
          value={pat}
          onChange={handleFieldChange(setPat)}
          disabled={testing}
          helpUrl={SERVER_PAT_HELP_URL}
        />
      )}

      {/* Cloud: Email + API Token fields */}
      {connectionType === 'cloud' && (
        <>
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-slate-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => handleFieldChange(setEmail)(e.target.value)}
              disabled={testing}
              placeholder="you@company.com"
              className={inputClass}
            />
          </div>
          <SecretInput
            id="api-token"
            label="API Token"
            value={apiToken}
            onChange={handleFieldChange(setApiToken)}
            disabled={testing}
            helpUrl={CLOUD_API_TOKEN_HELP_URL}
          />
        </>
      )}

      {/* Test Connection button */}
      <button
        type="button"
        onClick={handleTest}
        disabled={!canTest}
        aria-busy={testing}
        className={[
          'w-full flex items-center justify-center gap-2',
          'bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-medium rounded-lg py-2.5 text-sm',
          'transition-all duration-200',
          !canTest ? 'opacity-40 cursor-not-allowed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {testing && <SpinnerIcon />}
        {testing ? 'Testing...' : 'Test Connection'}
      </button>

      <TestResult result={testResult} connectionType={connectionType} />
    </div>
  );
}
