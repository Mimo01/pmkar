import './i18n/index';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LiveAnnouncer } from './components/LiveAnnouncer';
import { AppShell } from './components/ui/AppShell';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import { useConnectionStore } from './features/connections/connectionStore';
import ProbeStatusBanner from './features/connections/ProbeStatusBanner';
import { SettingsPage } from './features/connections/SettingsPage';
import { SetupWizard } from './features/connections/SetupWizard';
import type { ConnectionMeta, ConnectionType } from './features/connections/types';
import { GroupTabStrip } from './features/groups/GroupTabStrip';
import { GroupViewPage } from './features/groups/GroupViewPage';
import { useGroupStore } from './features/groups/groupStore';
import {
  groupTabId,
  parseGroupTabId,
  resolveActiveTab,
  type TabId,
} from './features/groups/groupTabs';
import { NavigationContext } from './features/groups/NavigationContext';
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
import { WatchedTicketsPage } from './features/tickets/WatchedTicketsPage';
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
  // Track cloud base URL so the probe re-fires when credentials change (WR-07)
  const cloudBaseUrl = useConnectionStore((s) => s.cloudConnection?.baseUrl);
  const [hydrated, setHydrated] = useState(false);
  useApplyTheme();
  useUpdateCheck();
  const updateStatus = useUpdateStore((s) => s.status);
  const updateInfo = useUpdateStore((s) => s.updateInfo);

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

  // Hydrate groups once persisted connection metas are loaded (Rust derives scope from them).
  // Source changes re-hydrate via rehydrateAfter in SettingsPage/SetupWizard.
  useEffect(() => {
    if (!hydrated) return;
    useGroupStore
      .getState()
      .hydrate()
      .catch(() => {});
  }, [hydrated]);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    | 'source'
    | 'destination'
    | 'jql-presets'
    | 'watched-users'
    | 'field-mapping'
    | 'polling'
    | 'notifications'
    | 'theme'
    | 'language'
    | 'about'
    | undefined
  >(undefined);
  const [editStep, setEditStep] = useState<ConnectionType | null>(null);
  const [currentTab, setCurrentTab] = useState<TabId>('new');
  const groupsHydrated = useGroupStore((s) => s.hydrated);
  const groups = useGroupStore((s) => s.groups);
  // Derive the rendered tab only; never write the fallback back into currentTab, so a
  // transient absence of the selected group does not destroy the user's selection.
  const effectiveTab = resolveActiveTab(currentTab, groups, groupsHydrated);
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

  // Fire probe after setup + project key is available; re-run when targetProjectKey or
  // cloudBaseUrl changes so a credential update is reflected in the banner immediately.
  // cloudBaseUrl is intentionally included as a trigger dependency even though it is
  // not referenced in the effect body — runProbe() reads the current cloud connection
  // from the Zustand store internally.
  // biome-ignore lint/correctness/useExhaustiveDependencies: cloudBaseUrl is a trigger dependency
  useEffect(() => {
    if (hasSetup && targetProjectKey) {
      void runProbe();
    }
  }, [hasSetup, targetProjectKey, cloudBaseUrl, runProbe]);

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

  const openTicketFromSearch = useCallback(
    (key: string): boolean => {
      if (
        copyPhase === 'loading_preview' ||
        copyPhase === 'previewing' ||
        copyPhase === 'copying' ||
        copyPhase === 'result'
      ) {
        return false;
      }
      setShowSettings(false);
      setSettingsInitialSection(undefined);
      setShowAuditLog(false);
      setDetailTicketKey(key);
      setShowDetail(true);
      useTicketStore.getState().selectTicket(key);
      return true;
    },
    [copyPhase],
  );

  const [focusRequest, setFocusRequest] = useState<{
    id: number;
    seq: number;
    focus: boolean;
  } | null>(null);

  const navigateToGroup = useCallback((groupId: number, options?: { focusTab?: boolean }) => {
    setShowDetail(false);
    setDetailTicketKey(null);
    // Clear the selection so the selectedTicketKey effect does not re-open detail.
    useTicketStore.getState().selectTicket(null);
    setCurrentTab(groupTabId(groupId));
    setFocusRequest((p) => ({
      id: groupId,
      seq: (p?.seq ?? 0) + 1,
      focus: options?.focusTab ?? true,
    }));
  }, []);

  const handleFocusRequestHandled = useCallback(() => setFocusRequest(null), []);

  const navValue = useMemo(() => ({ navigateToGroup }), [navigateToGroup]);

  const handleOpenSettingsSection = useCallback((section: 'field-mapping') => {
    setShowDetail(false);
    setDetailTicketKey(null);
    useTicketStore.getState().selectTicket(null);
    setSettingsInitialSection(section);
    setShowSettings(true);
  }, []);

  // Wait for hydration before deciding what to show
  if (!hydrated) {
    return null;
  }

  const showUpdateModal =
    updateStatus === 'available' ||
    updateStatus === 'downloading' ||
    updateStatus === 'installing' ||
    (updateStatus === 'error' && updateInfo !== null);

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
        <LiveAnnouncer />
      </ErrorBoundary>
    );
  }

  if (showSettings) {
    return (
      <ErrorBoundary>
        <AppShell onOpenTicket={openTicketFromSearch}>
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
        <LiveAnnouncer />
      </ErrorBoundary>
    );
  }

  if (showAuditLog) {
    return (
      <ErrorBoundary>
        <AppShell onOpenTicket={openTicketFromSearch}>
          <AuditLogPage onClose={() => setShowAuditLog(false)} />
        </AppShell>
        <UpdateModal open={showUpdateModal} />
        <AboutModal open={showAbout} onOpenChange={setShowAbout} />
        <Toaster />
        <LiveAnnouncer />
      </ErrorBoundary>
    );
  }

  if (showDetail && detailTicketKey) {
    return (
      <ErrorBoundary>
        <NavigationContext.Provider value={navValue}>
          <AppShell onOpenTicket={openTicketFromSearch}>
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
        </NavigationContext.Provider>
        <UpdateModal open={showUpdateModal} />
        <AboutModal open={showAbout} onOpenChange={setShowAbout} />
        <Toaster />
        <LiveAnnouncer />
      </ErrorBoundary>
    );
  }

  const activeGroupId = parseGroupTabId(effectiveTab);

  return (
    <ErrorBoundary>
      <NavigationContext.Provider value={navValue}>
        <AppShell
          onOpenTicket={openTicketFromSearch}
          onGearClick={() => {
            setShowDetail(false);
            setDetailTicketKey(null);
            useTicketStore.getState().selectTicket(null);
            setShowSettings(true);
          }}
          activeTab={effectiveTab}
          onTabChange={setCurrentTab}
          navExtension={
            <GroupTabStrip
              activeTab={effectiveTab}
              onTabChange={setCurrentTab}
              focusRequest={focusRequest}
              onFocusRequestHandled={handleFocusRequestHandled}
            />
          }
          onAuditClick={() => {
            setShowDetail(false);
            setDetailTicketKey(null);
            useTicketStore.getState().selectTicket(null);
            setShowAuditLog(true);
          }}
        >
          <ProbeStatusBanner />
          {effectiveTab === 'new' && <TicketListPage />}
          {effectiveTab === 'not-mine' && <IgnoredTicketsPage />}
          {effectiveTab === 'linked' && <LinkedTicketsPage />}
          {effectiveTab === 'watched' && <WatchedTicketsPage />}
          {activeGroupId !== null && groups.some((g) => g.id === activeGroupId) && (
            <GroupViewPage key={activeGroupId} groupId={activeGroupId} />
          )}
        </AppShell>
      </NavigationContext.Provider>
      <UpdateModal open={showUpdateModal} />
      <AboutModal open={showAbout} onOpenChange={setShowAbout} />
      <Toaster />
      <LiveAnnouncer />
    </ErrorBoundary>
  );
}

export default App;
