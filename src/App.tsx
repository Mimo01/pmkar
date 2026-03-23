import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppShell } from './components/ui/AppShell';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { TicketListPage } from './features/tickets/TicketListPage';
import { IgnoredTicketsPage } from './features/tickets/IgnoredTicketsPage';
import { AuditLogPage } from './features/tickets/AuditLogPage';
import { SetupWizard } from './features/connections/SetupWizard';
import { SettingsPage } from './features/connections/SettingsPage';
import { useConnectionStore } from './features/connections/connectionStore';
import { useApplyTheme } from './features/theme/useApplyTheme';
import type { ConnectionType, ConnectionMeta } from './features/connections/types';

interface StoredConnectionMeta {
  connectionType: string;
  baseUrl: string;
  username: string;
  serverVersion: string;
  lastTestedAt: string;
  status: string;
}

function App() {
  const hasSetup = useConnectionStore((s) => s.hasCompletedSetup());
  const [hydrated, setHydrated] = useState(false);
  useApplyTheme();

  useEffect(() => {
    invoke<StoredConnectionMeta[]>('get_all_connection_meta')
      .then((metas) => {
        for (const m of metas) {
          const meta: ConnectionMeta = {
            baseUrl: m.baseUrl,
            username: m.username,
            serverVersion: m.serverVersion,
            lastTestedAt: m.lastTestedAt,
            status: m.status as ConnectionMeta['status'],
          };
          if (m.connectionType === 'server') {
            useConnectionStore.getState().setServerConnection(meta);
          } else if (m.connectionType === 'cloud') {
            useConnectionStore.getState().setCloudConnection(meta);
          }
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const [showSettings, setShowSettings] = useState(false);
  const [editStep, setEditStep] = useState<ConnectionType | null>(null);
  const [currentTab, setCurrentTab] = useState<'tickets' | 'ignored'>('tickets');
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditCount, setAuditCount] = useState(0);

  useEffect(() => {
    if (hydrated && hasSetup) {
      invoke<number>('get_audit_count').then(setAuditCount).catch(() => {});
    }
  }, [hydrated, hasSetup]);

  const refreshAuditCount = useCallback(() => {
    invoke<number>('get_audit_count').then(setAuditCount).catch(() => {});
  }, []);

  // Wait for hydration before deciding what to show
  if (!hydrated) {
    return null;
  }

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
        <AppShell>
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

  if (showAuditLog) {
    return (
      <ErrorBoundary>
        <AppShell>
          <AuditLogPage onClose={() => { setShowAuditLog(false); refreshAuditCount(); }} />
        </AppShell>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppShell
        onGearClick={() => setShowSettings(true)}
        activeTab={currentTab}
        onTabChange={setCurrentTab}
        auditCount={auditCount}
        onAuditClick={() => setShowAuditLog(true)}
      >
        {currentTab === 'tickets' && <TicketListPage />}
        {currentTab === 'ignored' && <IgnoredTicketsPage />}
      </AppShell>
    </ErrorBoundary>
  );
}

export default App;
