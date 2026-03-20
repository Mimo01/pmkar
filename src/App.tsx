import { useState } from 'react';
import { AppShell } from './components/ui/AppShell';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DevStatusPanel } from './features/dev/DevStatusPanel';
import { SetupWizard } from './features/connections/SetupWizard';
import { useConnectionStore } from './features/connections/connectionStore';

function App() {
  const hasSetup = useConnectionStore((s) => s.hasCompletedSetup());
  const [showSettings, setShowSettings] = useState(false);

  if (!hasSetup) {
    return (
      <ErrorBoundary>
        <SetupWizard />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppShell>
        {showSettings ? (
          // Settings page will be implemented in Plan 03
          <div className="flex items-center justify-center min-h-screen">
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-sm text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              Back to app
            </button>
          </div>
        ) : (
          <DevStatusPanel />
        )}
      </AppShell>
    </ErrorBoundary>
  );
}

export default App;
