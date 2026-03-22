import { useState } from 'react';
import { AppShell } from './components/ui/AppShell';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { TicketListPage } from './features/tickets/TicketListPage';
import { SetupWizard } from './features/connections/SetupWizard';
import { SettingsPage } from './features/connections/SettingsPage';
import { useConnectionStore } from './features/connections/connectionStore';
import type { ConnectionType } from './features/connections/types';

function App() {
  const hasSetup = useConnectionStore((s) => s.hasCompletedSetup());
  const [showSettings, setShowSettings] = useState(false);
  const [editStep, setEditStep] = useState<ConnectionType | null>(null);

  // Show wizard if not set up OR if user clicked Edit on a connection
  if (!hasSetup || editStep !== null) {
    const initialStep = editStep === 'cloud' ? 2 : 1;
    return (
      <ErrorBoundary>
        <SetupWizard
          initialStep={initialStep}
          onComplete={() => setEditStep(null)}
        />
      </ErrorBoundary>
    );
  }

  if (showSettings) {
    return (
      <ErrorBoundary>
        <AppShell onGearClick={() => setShowSettings(true)}>
          <SettingsPage
            onClose={() => setShowSettings(false)}
            onEdit={(connectionType) => {
              setShowSettings(false);
              setEditStep(connectionType);
            }}
          />
        </AppShell>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppShell onGearClick={() => setShowSettings(true)}>
        <TicketListPage />
      </AppShell>
    </ErrorBoundary>
  );
}

export default App;
