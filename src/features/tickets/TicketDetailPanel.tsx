import { invoke } from '@tauri-apps/api/core';
import { ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../../lib/format';
import { useConnectionStore } from '../connections/connectionStore';
import { useCopyStore } from './copyStore';
import { AttachmentsTab } from './tabs/AttachmentsTab';
import { CommentsTab } from './tabs/CommentsTab';
import { HistoryTab } from './tabs/HistoryTab';
import { OverviewTab } from './tabs/OverviewTab';
import { WorkLogTab } from './tabs/WorkLogTab';
import { useTicketStore } from './ticketStore';
import type { JiraTicketDetail } from './types';

type TabId = 'overview' | 'comments' | 'worklog' | 'attachments' | 'history';

interface TicketDetailPanelProps {
  issueKey: string;
  baseUrl: string;
  onClose: () => void;
}

export function TicketDetailPanel({ issueKey, baseUrl, onClose }: TicketDetailPanelProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<JiraTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const copyPhase = useCopyStore((s) => s.phase);
  const copyError = useCopyStore((s) => s.error);
  const cloudBaseUrl = useConnectionStore((s) => s.cloudConnection?.baseUrl ?? '');
  const sourceProjectName = useConnectionStore((s) => s.sourceProjectName);
  const targetProjectName = useConnectionStore((s) => s.targetProjectName);
  const triageEntry = useTicketStore((s) => s.triageMap[issueKey]);
  const isCopied = triageEntry?.state === 'copied';
  const isIgnored = triageEntry?.state === 'ignored';

  const handleStartCopy = () => {
    if (detail) {
      useCopyStore.getState().startPreview(detail, baseUrl, cloudBaseUrl);
    }
  };

  const handleIgnore = () => {
    invoke('set_triage_state', { ticketKey: issueKey, state: 'ignored' }).catch(() => {});
    useTicketStore.getState().hydrateTriageMap({
      ...useTicketStore.getState().triageMap,
      [issueKey]: { state: 'ignored', copiedKey: null },
    });
  };

  const handleUnignore = () => {
    invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
    useTicketStore.getState().hydrateTriageMap({
      ...useTicketStore.getState().triageMap,
      [issueKey]: { state: 'seen', copiedKey: null },
    });
  };

  const handleOpenInJira = () => {
    invoke('open_external_url', { url: `${baseUrl}/browse/${issueKey}` });
  };

  const handleOpenInCloudJira = () => {
    if (triageEntry?.copiedKey && cloudBaseUrl) {
      invoke('open_external_url', { url: `${cloudBaseUrl}/browse/${triageEntry.copiedKey}` });
    }
  };

  // Fetch detail on mount or key change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    setActiveTab('overview');

    async function fetchDetail() {
      try {
        const result = await invoke<JiraTicketDetail>('fetch_ticket_detail', {
          baseUrl,
          issueKey,
        });
        if (!cancelled) {
          setDetail(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [issueKey, baseUrl]);

  // Focus close button when detail loads
  useEffect(() => {
    if (detail && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [detail]);

  // Escape key closes panel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const tabs: { id: TabId; label: string }[] = detail
    ? [
        { id: 'overview', label: t('detail.tab.overview') },
        {
          id: 'comments',
          label: `${t('detail.tab.comments')} (${detail.fields.comment.comments.length})`,
        },
        { id: 'worklog', label: t('detail.tab.worklog') },
        {
          id: 'attachments',
          label: `${t('detail.tab.attachments')} (${detail.fields.attachment.length})`,
        },
        { id: 'history', label: t('detail.tab.history') },
      ]
    : [];

  return (
    <aside className="flex flex-col h-full" aria-label="Ticket detail">
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-brand-border">
        {loading ? (
          /* Skeleton loading state */
          <div aria-busy="true">
            <div className="flex justify-end mb-2">
              <div className="w-8 h-8 animate-pulse bg-brand-surface-hover rounded-lg" />
            </div>
            <div className="animate-pulse bg-brand-surface-hover rounded h-3 w-20 mb-2" />
            <div className="animate-pulse bg-brand-surface-hover rounded h-5 w-full mb-2" />
            <div className="flex gap-2">
              <div className="animate-pulse bg-brand-surface-hover rounded-full h-6 w-16" />
              <div className="animate-pulse bg-brand-surface-hover rounded-full h-6 w-16" />
            </div>
          </div>
        ) : detail ? (
          <>
            <div className="flex items-center justify-end mb-2">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-brand-muted hover:text-brand-text hover:bg-brand-surface-hover rounded-lg transition-colors duration-150"
                aria-label={t('detail.close')}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-brand-muted">{detail.key}</span>
              <span className="text-[10px] text-brand-muted/60">·</span>
              <span className="text-[10px] text-brand-muted/60">
                {t('tickets.card.updated', { time: formatRelativeTime(detail.fields.updated) })}
              </span>
            </div>
            <div className="text-xl font-semibold text-brand-text leading-tight line-clamp-2">
              {detail.fields.summary}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {isCopied && triageEntry?.copiedKey ? (
                <>
                  <button
                    type="button"
                    onClick={handleOpenInJira}
                    className="px-3 py-1.5 rounded-md text-sm font-medium border border-brand-border bg-brand-surface hover:bg-brand-surface-hover hover:border-brand-text/30 text-brand-text transition-colors duration-150 flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('detail.openInSourceJira', { name: sourceProjectName || t('wizard.source.subtitle') })}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInCloudJira}
                    className="px-3 py-1.5 rounded-md text-sm font-medium border border-brand-border bg-brand-surface hover:bg-brand-surface-hover hover:border-brand-text/30 text-brand-text transition-colors duration-150 flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('detail.openInCompanyJira', { name: targetProjectName || t('wizard.destination.subtitle') })}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenInJira}
                  className="px-3 py-1.5 rounded-md text-sm font-medium border border-brand-border bg-brand-surface hover:bg-brand-surface-hover hover:border-brand-text/30 text-brand-text transition-colors duration-150 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('detail.openInJira')}
                </button>
              )}
              {isCopied ? null : isIgnored ? (
                <button
                  type="button"
                  onClick={handleUnignore}
                  className="px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors"
                >
                  {t('detail.ignored')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleIgnore}
                  className="px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors"
                >
                  {t('detail.ignore')}
                </button>
              )}
              {isCopied ? (
                <span className="px-3 py-1 rounded text-sm font-semibold text-emerald-400 border border-emerald-400/30">
                  {t('detail.copied')}
                  {triageEntry?.copiedKey ? ` \u2192 ${triageEntry.copiedKey}` : ''}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleStartCopy}
                  disabled={copyPhase === 'loading_preview'}
                  className="px-3 py-1 rounded text-sm font-semibold text-white bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {copyPhase === 'loading_preview' ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
                    t('detail.copy', { name: targetProjectName || t('wizard.destination.subtitle') })
                  )}
                </button>
              )}
            </div>
            {copyError && <p className="text-xs text-red-400 mt-1">{copyError}</p>}
          </>
        ) : (
          <div className="text-xs text-red-400">{t('detail.failedToLoad')}</div>
        )}
      </div>

      {/* Tab bar */}
      {detail && (
        <div className="flex border-b border-brand-border px-5" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`text-sm py-2 mr-4 border-b-2 transition-colors duration-150 ${
                activeTab === tab.id
                  ? 'text-brand-text font-semibold border-brand'
                  : 'font-normal text-brand-muted hover:text-brand-text border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      {detail && (
        <div className="overflow-y-auto flex-1" role="tabpanel" id={`tabpanel-${activeTab}`}>
          {activeTab === 'overview' && <OverviewTab detail={detail} baseUrl={baseUrl} />}
          {activeTab === 'comments' && <CommentsTab comments={detail.fields.comment.comments} />}
          {activeTab === 'worklog' && <WorkLogTab issueKey={issueKey} baseUrl={baseUrl} />}
          {activeTab === 'attachments' && <AttachmentsTab attachments={detail.fields.attachment} />}
          {activeTab === 'history' && <HistoryTab issueKey={issueKey} baseUrl={baseUrl} />}
        </div>
      )}

    </aside>
  );
}
