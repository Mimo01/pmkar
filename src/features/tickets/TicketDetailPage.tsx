import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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

interface TicketDetailPageProps {
  issueKey: string;
  onBack: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let className = 'bg-brand-surface-hover text-brand-text-secondary'; // To Do / Open
  if (lower.includes('progress') || lower.includes('review'))
    className = 'bg-blue-600/10 text-blue-600 dark:text-blue-400';
  if (lower.includes('done') || lower.includes('resolved') || lower.includes('closed'))
    className = 'bg-green-600/10 text-green-600 dark:text-green-400';
  if (lower.includes('blocked')) className = 'bg-red-600/10 text-red-600 dark:text-red-400';
  return (
    <Badge variant="outline" className={cn('text-xs', className)}>
      {status}
    </Badge>
  );
}

export function TicketDetailPage({ issueKey, onBack }: TicketDetailPageProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<JiraTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const copyPhase = useCopyStore((s) => s.phase);
  const copyError = useCopyStore((s) => s.error);
  const baseUrl = useConnectionStore((s) => s.serverConnection?.baseUrl ?? '');
  const cloudBaseUrl = useConnectionStore((s) => s.cloudConnection?.baseUrl ?? '');
  const triageEntry = useTicketStore((s) => s.triageMap[issueKey]);
  const isCopied = triageEntry?.state === 'copied';
  const isIgnored = triageEntry?.state === 'ignored';

  const handleStartCopy = useCallback(() => {
    if (detail) {
      useCopyStore.getState().startPreview(detail, baseUrl, cloudBaseUrl);
    }
  }, [detail, baseUrl, cloudBaseUrl]);

  const handleIgnore = useCallback(() => {
    invoke('set_triage_state', { ticketKey: issueKey, state: 'ignored' }).catch(() => {});
    useTicketStore.getState().hydrateTriageMap({
      ...useTicketStore.getState().triageMap,
      [issueKey]: { state: 'ignored', copiedKey: null },
    });
  }, [issueKey]);

  const handleUnignore = useCallback(() => {
    invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
    useTicketStore.getState().hydrateTriageMap({
      ...useTicketStore.getState().triageMap,
      [issueKey]: { state: 'seen', copiedKey: null },
    });
  }, [issueKey]);

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

  // Escape key goes back
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      }
    },
    [onBack],
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Back button header still shows while loading */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-border bg-brand-surface">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {t('detail.back')}
          </button>
          <span className="text-xs font-mono text-brand-muted">{issueKey}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-brand-muted" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-border bg-brand-surface">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {t('detail.back')}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-red-400">{t('detail.failedToLoad')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header with back button */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-border bg-brand-surface">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {t('detail.back')}
        </button>
        <span className="text-xs font-mono text-brand-muted">{issueKey}</span>
        {isCopied && triageEntry?.copiedKey && (
          <Badge variant="outline" className="text-xs font-mono">
            {triageEntry.copiedKey}
          </Badge>
        )}
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6">
          {/* Ticket header: summary + metadata */}
          <h1 className="text-base font-semibold text-brand-text mb-2">{detail.fields.summary}</h1>
          <div className="flex items-center gap-3 mb-6 text-xs text-brand-muted flex-wrap">
            <StatusBadge status={detail.fields.status.name} />
            <span>{detail.fields.priority.name}</span>
            {detail.fields.assignee?.displayName && (
              <span>{detail.fields.assignee.displayName}</span>
            )}
            {detail.fields.reporter?.displayName && (
              <span>{detail.fields.reporter.displayName}</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {!isCopied && (
              <button
                type="button"
                onClick={handleStartCopy}
                disabled={copyPhase === 'loading_preview'}
                className="bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-md px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-1.5"
              >
                {copyPhase === 'loading_preview' ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : null}
                {t('detail.copy')}
              </button>
            )}
            {isCopied && (
              <Badge className="bg-green-600/10 text-green-600 border-green-600/20">
                {t('detail.copied')}
                {triageEntry?.copiedKey ? ` \u2192 ${triageEntry.copiedKey}` : ''}
              </Badge>
            )}
            {!isCopied &&
              (isIgnored ? (
                <button
                  type="button"
                  onClick={handleUnignore}
                  className="text-sm text-brand-muted hover:text-brand-text transition-colors duration-150 px-3 py-1 rounded border border-brand-border hover:border-brand-text"
                >
                  {t('detail.ignored')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleIgnore}
                  className="text-sm text-brand-muted hover:text-brand-text transition-colors duration-150"
                >
                  {t('detail.ignore')}
                </button>
              ))}
          </div>

          {copyError && <p className="text-xs text-red-400 mb-4">{copyError}</p>}

          {/* Tab bar */}
          <div className="flex border-b border-brand-border mb-6" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
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

          {/* Tab content */}
          <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
            {activeTab === 'overview' && <OverviewTab detail={detail} baseUrl={baseUrl} />}
            {activeTab === 'comments' && <CommentsTab comments={detail.fields.comment.comments} />}
            {activeTab === 'worklog' && <WorkLogTab issueKey={issueKey} baseUrl={baseUrl} />}
            {activeTab === 'attachments' && (
              <AttachmentsTab attachments={detail.fields.attachment} />
            )}
            {activeTab === 'history' && <HistoryTab issueKey={issueKey} baseUrl={baseUrl} />}
          </div>
        </div>
      </div>

    </div>
  );
}
