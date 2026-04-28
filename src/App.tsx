import './i18n/index';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/ui/AppShell';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import { useConnectionStore } from './features/connections/connectionStore';
import ProbeStatusBanner from './features/connections/ProbeStatusBanner';
import { SettingsPage } from './features/connections/SettingsPage';
import { SetupWizard } from './features/connections/SetupWizard';
import type { ConnectionMeta, ConnectionType } from './features/connections/types';
import { useApplyTheme } from './features/theme/useApplyTheme';
import { AuditLogPage } from './features/tickets/AuditLogPage';
import { CopyPreviewPage } from './features/tickets/CopyPreviewPage';
import { CopyResultPage } from './features/tickets/CopyResultPage';
import { useCopyStore } from './features/tickets/copyStore';
import { IgnoredTicketsPage } from './features/tickets/IgnoredTicketsPage';
import { LinkedTicketsPage } from './features/tickets/LinkedTicketsPage';
import { TicketDetailPage } from './features/tickets/TicketDetailPage';
import { TicketListPage } from './features/tickets/TicketListPage';
import { useTicketStore } from './features/tickets/ticketStore';
import { AboutModal } from './features/update/AboutModal';
import { UpdateModal } from './features/update/UpdateModal';
import { useUpdateStore } from './features/update/updateStore';
import { useUpdateCheck } from './features/update/useUpdateCheck';
import { hydrateLanguage } from './i18n/languageStore';

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
  const targetProjectKey = useConnectionStore((s) => s.targetProjectKey);
  const runProbe = useConnectionStore((s) => s.runProbe);
  const [hydrated, setHydrated] = useState(false);
  useApplyTheme();
  useUpdateCheck();
  const updateStatus = useUpdateStore((s) => s.status);

  useEffect(() => {
    Promise.all([invoke<StoredConnectionMeta[]>('get_all_connection_meta'), hydrateLanguage()])
      .then(([metas]) => {
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
        // Load persisted project config so targetProjectKey is available
        // before the user opens Settings.
        useConnectionStore
          .getState()
          .loadProjectConfig()
          .catch(() => {});
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    | 'source' | 'destination' | 'jql-presets' | 'watched-users'
    | 'field-mapping' | 'polling' | 'notifications' | 'theme'
    | 'language' | 'about'
    | undefined
  >(undefined);
  const [editStep, setEditStep] = useState<ConnectionType | null>(null);
  const [currentTab, setCurrentTab] = useState<'new' | 'not-mine' | 'linked'>('new');
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailTicketKey, setDetailTicketKey] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const unlisten = listen('show-about', () => setShowAbout(true));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Fire probe after setup + project key is available; re-run when targetProjectKey changes
  useEffect(() => {
    if (hasSetup && targetProjectKey) {
      void runProbe();
    }
  }, [hasSetup, targetProjectKey, runProbe]);

  const selectedTicketKey = useTicketStore((s) => s.selectedTicketKey);
  const copyPhase = useCopyStore((s) => s.phase);

  useEffect(() => {
    if (selectedTicketKey) {
      setDetailTicketKey(selectedTicketKey);
      setShowDetail(true);
    }
  }, [selectedTicketKey]);

  const handleDetailBack = useCallback(() => {
    setShowDetail(false);
    setDetailTicketKey(null);
    useTicketStore.getState().selectTicket(null);
  }, []);

  const handleOpenSettingsSection = useCallback(
    (section: 'field-mapping') => {
      setShowDetail(false);
      setDetailTicketKey(null);
      useTicketStore.getState().selectTicket(null);
      setSettingsInitialSection(section);
      setShowSettings(true);
    },
    [],
  );

  // Wait for hydration before deciding what to show
  if (!hydrated) {
    return null;
  }

  const showUpdateModal =
    updateStatus === 'available' ||
    updateStatus === 'downloading' ||
    updateStatus === 'installing' ||
    (updateStatus === 'error' && useUpdateStore.getState().updateInfo !== null);

  // Show wizard if not set up OR if user clicked Edit on a connection
  if (!hasSetup || editStep !== null) {
    const initialStep = editStep === 'cloud' ? 2 : 1;
    return (
      <ErrorBoundary>
        <AppShell>
          <SetupWizard initialStep={initialStep} onComplete={() => setEditStep(null)} />
        </AppShell>
        <UpdateModal open={showUpdateModal} />
        <AboutModal open={showAbout} onOpenChange={setShowAbout} />
        <Toaster />
      </ErrorBoundary>
    );
  }

  if (showSettings) {
    return (
      <ErrorBoundary>
        <AppShell>
          <SettingsPage
            onClose={() => {
              setShowSettings(false);
              setSettingsInitialSection(undefined);
            }}
            onEdit={(connectionType) => {
              setShowSettings(false);
              setSettingsInitialSection(undefined);
              setEditStep(connectionType);
            }}
            initialSection={settingsInitialSection}
          />
        </AppShell>
        <UpdateModal open={showUpdateModal} />
        <AboutModal open={showAbout} onOpenChange={setShowAbout} />
        <Toaster />
      </ErrorBoundary>
    );
  }

  if (showAuditLog) {
    return (
      <ErrorBoundary>
        <AppShell>
          <AuditLogPage onClose={() => setShowAuditLog(false)} />
        </AppShell>
        <UpdateModal open={showUpdateModal} />
        <AboutModal open={showAbout} onOpenChange={setShowAbout} />
        <Toaster />
      </ErrorBoundary>
    );
  }

  if (showDetail && detailTicketKey) {
    return (
      <ErrorBoundary>
        <AppShell>
          {copyPhase === 'loading_preview' ||
          copyPhase === 'previewing' ||
          copyPhase === 'copying' ||
          copyPhase === 'result' ? (
            copyPhase === 'result' ? (
              <CopyResultPage />
            ) : (
              <CopyPreviewPage onOpenSettingsSection={handleOpenSettingsSection} />
            )
          ) : (
            <TicketDetailPage issueKey={detailTicketKey} onBack={handleDetailBack} />
          )}
        </AppShell>
        <UpdateModal open={showUpdateModal} />
        <AboutModal open={showAbout} onOpenChange={setShowAbout} />
        <Toaster />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppShell
        onGearClick={() => {
          setShowDetail(false);
          setDetailTicketKey(null);
          useTicketStore.getState().selectTicket(null);
          setShowSettings(true);
        }}
        activeTab={currentTab}
        onTabChange={setCurrentTab}
        onAuditClick={() => {
          setShowDetail(false);
          setDetailTicketKey(null);
          useTicketStore.getState().selectTicket(null);
          setShowAuditLog(true);
        }}
      >
        <ProbeStatusBanner />
        {currentTab === 'new' && <TicketListPage />}
        {currentTab === 'not-mine' && <IgnoredTicketsPage />}
        {currentTab === 'linked' && <LinkedTicketsPage />}
      </AppShell>
      <UpdateModal open={showUpdateModal} />
      <AboutModal open={showAbout} onOpenChange={setShowAbout} />
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
