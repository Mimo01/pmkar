import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StepProgress } from './StepProgress';
import { WizardStep } from './WizardStep';
import { ConnectionForm } from './ConnectionForm';
import { SummaryStep } from './SummaryStep';
import { useConnectionStore } from './connectionStore';
import type { ConnectionTestResult, ConnectionMeta } from './types';

interface ServerCredentials {
  baseUrl: string;
  pat: string;
}

interface CloudCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

interface SetupWizardProps {
  initialStep?: number;
  onComplete?: () => void;
}

export function SetupWizard({ initialStep = 1, onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [testPassed, setTestPassed] = useState(false);

  const { setServerConnection, setCloudConnection, serverConnection, cloudConnection } =
    useConnectionStore();

  async function handleServerTestSuccess(
    result: ConnectionTestResult,
    credentials: ServerCredentials | { baseUrl: string; [key: string]: string },
  ) {
    const { baseUrl, pat } = credentials as ServerCredentials;
    const username = result.username ?? '';
    const serverVersion = result.serverVersion ?? '';

    try {
      await invoke('store_credential', {
        connectionType: 'jira-server',
        username,
        secret: pat,
      });
    } catch (err) {
      console.error('Failed to store server credential:', err);
    }

    const meta: ConnectionMeta = {
      baseUrl,
      username,
      serverVersion,
      lastTestedAt: new Date().toISOString(),
      status: 'ok',
    };
    setServerConnection(meta);
    invoke('set_connection_meta', {
      meta: { connectionType: 'server', baseUrl, username, serverVersion, lastTestedAt: meta.lastTestedAt, status: 'ok' },
    }).catch((err) => console.error('Failed to persist server connection meta:', err));
    setTestPassed(true);
  }

  async function handleCloudTestSuccess(
    result: ConnectionTestResult,
    credentials: CloudCredentials | { baseUrl: string; [key: string]: string },
  ) {
    const { baseUrl, email, apiToken } = credentials as CloudCredentials;
    const username = result.username ?? '';
    const serverVersion = result.serverVersion ?? '';

    try {
      await invoke('store_credential', {
        connectionType: 'jira-cloud',
        username: email,
        secret: apiToken,
      });
    } catch (err) {
      console.error('Failed to store cloud credential:', err);
    }

    const meta: ConnectionMeta = {
      baseUrl,
      username,
      serverVersion,
      lastTestedAt: new Date().toISOString(),
      status: 'ok',
    };
    setCloudConnection(meta);
    invoke('set_connection_meta', {
      meta: { connectionType: 'cloud', baseUrl, username, serverVersion, lastTestedAt: meta.lastTestedAt, status: 'ok' },
    }).catch((err) => console.error('Failed to persist cloud connection meta:', err));
    setTestPassed(true);
  }

  function handleTestInvalidated() {
    setTestPassed(false);
  }

  function handleNext() {
    setCurrentStep((s) => s + 1);
    setTestPassed(false);
  }

  function handleDone() {
    if (onComplete) {
      onComplete();
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-brand-bg">
      {/* Brand accent stripe */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-brand z-50" />
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-b from-brand-bg via-brand-bg to-brand-surface pointer-events-none" />

      <div className="relative max-w-[440px] w-full px-6 py-10">
        <StepProgress currentStep={currentStep} />

        {currentStep === 1 && (
          <>
            <WizardStep title="Source Connection" subtitle="Customer Jira Server">
              <ConnectionForm
                connectionType="server"
                onTestSuccess={(result, creds) =>
                  handleServerTestSuccess(result, creds as ServerCredentials)
                }
                onTestInvalidated={handleTestInvalidated}
              />
            </WizardStep>
            {testPassed && (
              <div className="flex justify-end mt-5">
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 bg-brand-surface-hover hover:bg-brand-surface-hover text-slate-200 font-medium rounded-lg py-2.5 px-5 text-sm transition-all duration-200 border border-brand-border"
                >
                  Next
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}

        {currentStep === 2 && (
          <>
            <WizardStep title="Destination Connection" subtitle="Company Jira Cloud">
              <ConnectionForm
                connectionType="cloud"
                onTestSuccess={(result, creds) =>
                  handleCloudTestSuccess(result, creds as CloudCredentials)
                }
                onTestInvalidated={handleTestInvalidated}
              />
            </WizardStep>
            {testPassed && (
              <div className="flex justify-end mt-5">
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 bg-brand-surface-hover hover:bg-brand-surface-hover text-slate-200 font-medium rounded-lg py-2.5 px-5 text-sm transition-all duration-200 border border-brand-border"
                >
                  Next
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}

        {currentStep === 3 && serverConnection && cloudConnection && (
          <WizardStep title="All Set" subtitle="">
            <SummaryStep
              serverConnection={serverConnection}
              cloudConnection={cloudConnection}
              onDone={handleDone}
            />
          </WizardStep>
        )}
      </div>
    </div>
  );
}
