import { useState, useRef } from 'react';
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

interface ConnectionFormProps {
  connectionType: 'server' | 'cloud';
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
  onTestSuccess,
  onTestInvalidated,
}: ConnectionFormProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  // Server-only
  const [pat, setPat] = useState('');

  // Cloud-only
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  // Snapshot of values at last successful test
  const testedValuesRef = useRef<Credentials | null>(null);

  function getCurrentCredentials(): Credentials {
    if (connectionType === 'server') {
      return { baseUrl, pat };
    }
    return { baseUrl, email, apiToken };
  }

  function credentialsMatchTested(): boolean {
    const current = getCurrentCredentials();
    const tested = testedValuesRef.current;
    if (!tested) return false;
    return JSON.stringify(current) === JSON.stringify(tested);
  }

  function handleUrlBlur() {
    let trimmed = baseUrl.trimEnd().replace(/\/+$/, '');
    setBaseUrl(trimmed);
    if (trimmed && !trimmed.startsWith('https://')) {
      setUrlError('URL must start with https://');
    } else {
      setUrlError('');
    }
  }

  function handleFieldChange(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      // After changing any field, check if it matches tested values; if not, invalidate
      // We schedule this check via setTimeout to let state update first
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
    // Clear URL error when user starts typing again
    if (urlError) setUrlError('');
    setTimeout(() => {
      if (testedValuesRef.current !== null && !credentialsMatchTested()) {
        testedValuesRef.current = null;
        setTestResult(null);
        onTestInvalidated();
      }
    }, 0);
  }

  const canTest = !urlError && baseUrl.startsWith('https://') && !testing;

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

  return (
    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6 space-y-4">
      {/* Base URL field */}
      <div className="space-y-1">
        <label
          htmlFor="base-url"
          className="text-sm font-normal leading-normal text-slate-950 dark:text-slate-50"
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
          className={[
            'w-full rounded-md border border-slate-200 dark:border-slate-700',
            'bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50',
            'px-3 py-2 text-base font-normal leading-normal',
            'focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2',
            testing ? 'opacity-50 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {urlError && (
          <p className="text-sm text-red-600 dark:text-red-400">{urlError}</p>
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
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="text-sm font-normal leading-normal text-slate-950 dark:text-slate-50"
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
              className={[
                'w-full rounded-md border border-slate-200 dark:border-slate-700',
                'bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50',
                'px-3 py-2 text-base font-normal leading-normal',
                'focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2',
                testing ? 'opacity-50 cursor-not-allowed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
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
          'bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md py-2',
          'focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2',
          !canTest ? 'opacity-50 cursor-not-allowed' : '',
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
