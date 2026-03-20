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

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(1);
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

    // Store credential in OS keychain
    try {
      await invoke('store_credential', {
        connectionType: 'jira-server',
        username,
        secret: pat,
      });
    } catch (err) {
      console.error('Failed to store server credential:', err);
    }

    // Update Zustand store with non-secret metadata
    const meta: ConnectionMeta = {
      baseUrl,
      username,
      serverVersion,
      lastTestedAt: new Date().toISOString(),
      status: 'ok',
    };
    setServerConnection(meta);
    setTestPassed(true);
  }

  async function handleCloudTestSuccess(
    result: ConnectionTestResult,
    credentials: CloudCredentials | { baseUrl: string; [key: string]: string },
  ) {
    const { baseUrl, email, apiToken } = credentials as CloudCredentials;
    const username = result.username ?? '';
    const serverVersion = result.serverVersion ?? '';

    // Store credential in OS keychain (use email as the keychain username for Cloud)
    try {
      await invoke('store_credential', {
        connectionType: 'jira-cloud',
        username: email,
        secret: apiToken,
      });
    } catch (err) {
      console.error('Failed to store cloud credential:', err);
    }

    // Update Zustand store with non-secret metadata
    const meta: ConnectionMeta = {
      baseUrl,
      username,
      serverVersion,
      lastTestedAt: new Date().toISOString(),
      status: 'ok',
    };
    setCloudConnection(meta);
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
    // hasCompletedSetup() returns true — App.tsx will re-render the main app
    // No explicit action needed here; the store is already updated
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-[480px] w-full px-4 py-8">
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
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md py-2 px-6 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
                >
                  Next
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
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md py-2 px-6 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
                >
                  Next
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
