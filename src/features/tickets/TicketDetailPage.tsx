import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDate, formatRelativeTime } from '../../lib/format';
import { useConnectionStore } from '../connections/connectionStore';
import { useCopyStore } from './copyStore';
import { AttachmentsTab } from './tabs/AttachmentsTab';
import { ChangesTab } from './tabs/ChangesTab';
import { CommentsTab } from './tabs/CommentsTab';
import { HistoryTab } from './tabs/HistoryTab';
import { OverviewTab } from './tabs/OverviewTab';
import { WorkLogTab } from './tabs/WorkLogTab';
import { useTicketStore } from './ticketStore';
import type { JiraTicketDetail } from './types';

type TabId = 'overview' | 'comments' | 'worklog' | 'attachments' | 'history' | 'changes';

interface TicketDetailPageProps {
  issueKey: string;
  onBack: () => void;
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
  const sourceProjectName = useConnectionStore((s) => s.sourceProjectName);
  const targetProjectName = useConnectionStore((s) => s.targetProjectName);
  const triageEntry = useTicketStore((s) => s.triageMap[issueKey]);
  const isCopied = triageEntry?.state === 'copied';
  const isIgnored = triageEntry?.state === 'ignored';
  const isHandled = triageEntry?.state === 'handled';
  const unseenFields = useTicketStore((s) => s.unseenChanges[issueKey]);
  const hasUnseenChanges = !!unseenFields;
  const changeCount = unseenFields?.length ?? 0;

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

  const handleMarkHandled = useCallback(() => {
    invoke('set_triage_state', { ticketKey: issueKey, state: 'handled' }).catch(() => {});
    useTicketStore.getState().hydrateTriageMap({
      ...useTicketStore.getState().triageMap,
      [issueKey]: { state: 'handled', copiedKey: null },
    });
  }, [issueKey]);

  const handleUnhandle = useCallback(() => {
    invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
    useTicketStore.getState().hydrateTriageMap({
      ...useTicketStore.getState().triageMap,
      [issueKey]: { state: 'seen', copiedKey: null },
    });
  }, [issueKey]);

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
    setActiveTab(useTicketStore.getState().unseenChanges[issueKey] ? 'changes' : 'overview');

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
        { id: 'changes' as TabId, label: t('detail.tab.changes') },
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
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Ticket header: summary + updated time */}
        <h1 className="text-base font-semibold text-brand-text mb-1">{detail.fields.summary}</h1>
        <p className="text-xs text-brand-muted mb-6">
          {detail.fields.created && (
            <>
              {t('tickets.card.created', { time: formatDate(detail.fields.created) })}
              {' · '}
            </>
          )}
          {t('tickets.card.updated', { time: formatRelativeTime(detail.fields.updated) })}
        </p>

        {/* Action buttons */}
        <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-3 flex-wrap mb-6">
            {!isCopied && !isIgnored && !isHandled && (
              <Button
                variant="default"
                size="lg"
                onClick={handleStartCopy}
                disabled={copyPhase === 'loading_preview'}
              >
                {copyPhase === 'loading_preview' ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : null}
                {t('detail.copy', {
                  name: targetProjectName || t('wizard.destination.subtitle'),
                })}
              </Button>
            )}
            {isCopied && triageEntry?.copiedKey ? (
              <>
                {/* Linked status badge */}
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default select-none">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  {t('detail.copied')} → {triageEntry.copiedKey}
                </span>
                <Button variant="outline" size="sm" onClick={handleOpenInJira}>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  {sourceProjectName || t('wizard.source.subtitle')}
                </Button>
                <Button variant="outline" size="sm" onClick={handleOpenInCloudJira}>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  {triageEntry.copiedKey}
                </Button>
              </>
            ) : (
              <>
                {isHandled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="secondary" size="lg" onClick={handleUnhandle}>
                        {t('detail.handled')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent aria-hidden="true">
                      {t('detail.handled.tooltip')}
                    </TooltipContent>
                  </Tooltip>
                ) : isIgnored ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="secondary" size="lg" onClick={handleUnignore}>
                        {t('detail.ignored')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent aria-hidden="true">
                      {t('detail.ignored.tooltip')}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="lg" onClick={handleIgnore}>
                          {t('detail.ignore')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent aria-hidden="true">
                        {t('detail.ignore.tooltip')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="lg" onClick={handleMarkHandled}>
                          {t('detail.markHandled')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent aria-hidden="true">
                        {t('detail.markHandled.tooltip')}
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
                <Button variant="outline" size="lg" onClick={handleOpenInJira}>
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  {t('detail.openInJira')}
                </Button>
              </>
            )}
          </div>
        </TooltipProvider>

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
              className={`text-sm py-2 mr-4 border-b-2 transition-colors duration-150 flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'text-brand-text font-semibold border-brand'
                  : 'font-normal text-brand-muted hover:text-brand-text border-transparent'
              }`}
            >
              {tab.label}
              {tab.id === 'changes' && hasUnseenChanges && (
                <Badge className="text-[10px] px-1.5 py-0 min-w-[16px] h-4 leading-none bg-blue-500/15 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400 border-0">
                  {changeCount || '!'}
                </Badge>
              )}
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
          {activeTab === 'changes' && <ChangesTab issueKey={issueKey} />}
        </div>
      </div>
    </div>
  );
}
