import { invoke } from '@tauri-apps/api/core';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConnectionForm } from './ConnectionForm';
import { useConnectionStore } from './connectionStore';
import { StepProgress } from './StepProgress';
import { SummaryStep } from './SummaryStep';
import type { ConnectionMeta, ConnectionTestResult } from './types';
import { WizardStep } from './WizardStep';

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
  const { t } = useTranslation();
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
      meta: {
        connectionType: 'server',
        baseUrl,
        username,
        serverVersion,
        lastTestedAt: meta.lastTestedAt,
        status: 'ok',
      },
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
      meta: {
        connectionType: 'cloud',
        baseUrl,
        username,
        serverVersion,
        lastTestedAt: meta.lastTestedAt,
        status: 'ok',
      },
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
      {/* Top bar with brand accent */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="h-[2px] bg-gradient-to-r from-brand via-brand/60 to-transparent" />
      </div>

      <div className="relative max-w-[440px] w-full px-6 py-10">
        <StepProgress currentStep={currentStep} />

        {currentStep === 1 && (
          <>
            <WizardStep title={t('wizard.source.title')} subtitle={t('wizard.source.subtitle')}>
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
                  className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white font-semibold rounded-md px-4 py-2 text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  {t('wizard.next')}
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}

        {currentStep === 2 && (
          <>
            <WizardStep
              title={t('wizard.destination.title')}
              subtitle={t('wizard.destination.subtitle')}
            >
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
                  className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white font-semibold rounded-md px-4 py-2 text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  {t('wizard.next')}
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}

        {currentStep === 3 && serverConnection && cloudConnection && (
          <WizardStep title={t('wizard.allSet.title')} subtitle="">
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
