import { invoke } from '@tauri-apps/api/core';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FOCUS_RING } from '../../lib/focusRing';
import { formatRelativeTime } from '../../lib/format';
import { useConnectionStore } from '../connections/connectionStore';
import { ConfirmTransitionDialog } from './ConfirmTransitionDialog';
import { useCopyStore } from './copyStore';
import { RememberedLinkHint } from './RememberedLinkHint';
import { AttachmentsTab } from './tabs/AttachmentsTab';
import { ChangesTab } from './tabs/ChangesTab';
import { CommentsTab } from './tabs/CommentsTab';
import { HistoryTab } from './tabs/HistoryTab';
import { OverviewTab } from './tabs/OverviewTab';
import { WorkLogTab } from './tabs/WorkLogTab';
import { useTicketStore } from './ticketStore';
import { markHandled, restoreTicket } from './triageActions';
import type { JiraTicketDetail } from './types';
import { useTriageDetailActions } from './useTriageDetailActions';

type TabId = 'overview' | 'comments' | 'worklog' | 'attachments' | 'history' | 'changes';

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
  const tri = useTriageDetailActions(issueKey, detail, closeButtonRef);
  const triageEntry = tri.triageEntry;
  const linkedKey = tri.triageEntry?.copiedKey ?? '';
  const isHandled = triageEntry?.state === 'handled';
  const unseenFields = useTicketStore((s) => s.unseenChanges[issueKey]);
  const hasUnseenChanges = !!unseenFields;
  const changeCount = unseenFields?.length ?? 0;

  const handleStartCopy = () => {
    if (detail) {
      useCopyStore.getState().startPreview(detail, baseUrl, cloudBaseUrl);
    }
  };

  const handleMarkHandled = () => {
    void markHandled(issueKey);
  };

  const handleUnhandle = () => {
    void restoreTicket(issueKey);
  };

  const handleOpenInJira = () => {
    invoke('open_external_url', { url: `${baseUrl}/browse/${issueKey}` });
  };

  const handleOpenInCloudJira = () => {
    if (linkedKey && cloudBaseUrl) {
      invoke('open_external_url', { url: `${cloudBaseUrl}/browse/${linkedKey}` });
    }
  };

  // Auto-switch to Changes tab when ticket has unseen changes
  const initialTabRef = useRef<TabId | null>(null);
  useEffect(() => {
    if (hasUnseenChanges && initialTabRef.current !== issueKey) {
      initialTabRef.current = issueKey as unknown as TabId;
      setActiveTab('changes');
    }
  }, [issueKey, hasUnseenChanges]);

  // Fetch detail on mount or key change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    if (useTicketStore.getState().unseenChanges[issueKey]) {
      setActiveTab('changes');
    } else {
      setActiveTab('overview');
    }

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
  const confirmOpen = tri.confirmDialog.target !== null;
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !e.defaultPrevented &&
        !confirmOpen &&
        !(e.target instanceof Element && e.target.closest('[role="alertdialog"]'))
      ) {
        onClose();
      }
    },
    [onClose, confirmOpen],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const linkBusy = tri.linking || copyPhase === 'loading_preview';
  const restorePrimary = (
    <button
      type="button"
      ref={tri.primaryRef}
      onClick={() => {
        if (linkBusy) return;
        tri.requestLink();
      }}
      aria-disabled={linkBusy}
      className={`px-3 py-1 rounded text-sm font-semibold text-white bg-brand hover:bg-brand/90 aria-disabled:hover:bg-brand aria-disabled:opacity-50 aria-disabled:cursor-not-allowed flex items-center gap-1.5 ${FOCUS_RING}`}
    >
      {linkBusy ? (
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
      ) : tri.rememberedKey ? (
        t('detail.restoreLink', { key: tri.rememberedKey })
      ) : (
        t('detail.copy', { name: targetProjectName || t('wizard.destination.subtitle') })
      )}
    </button>
  );

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
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-2 mt-2">
                {tri.isLinked ? (
                  <>
                    {/* Primary: linked status badge with copied key */}
                    <span
                      ref={tri.badgeRef}
                      tabIndex={-1}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default select-none outline-none"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('detail.copied')} → {linkedKey}
                    </span>

                    {/* Secondary: compact text links to open in each Jira */}
                    <span className="text-brand-muted text-xs">·</span>
                    <button
                      type="button"
                      onClick={handleOpenInJira}
                      className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-150 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      {sourceProjectName || t('wizard.source.subtitle')}
                    </button>
                    <span className="text-brand-muted text-xs">·</span>
                    <button
                      type="button"
                      onClick={handleOpenInCloudJira}
                      className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-150 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      {linkedKey}
                    </button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          ref={tri.denyRef}
                          onClick={tri.requestDeny}
                          className={`px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors ${FOCUS_RING}`}
                        >
                          {t('detail.deny')}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent aria-hidden="true">
                        {t('detail.deny.tooltip', {
                          tab: t('nav.notMine'),
                          key: linkedKey,
                        })}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          ref={tri.watchRef}
                          onClick={tri.requestWatch}
                          className={`px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors ${FOCUS_RING}`}
                        >
                          {t('detail.watch')}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent aria-hidden="true">
                        {t('detail.watch.tooltip')}
                      </TooltipContent>
                    </Tooltip>
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
                {tri.isLinked ? null : isHandled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleUnhandle}
                        className={`px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors ${FOCUS_RING}`}
                      >
                        {t('detail.handled')}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent aria-hidden="true">
                      {t('detail.handled.tooltip')}
                    </TooltipContent>
                  </Tooltip>
                ) : tri.isDenied || tri.isWatched ? (
                  <>
                    {tri.rememberedKey ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{restorePrimary}</TooltipTrigger>
                        <TooltipContent aria-hidden="true">
                          {t('detail.restoreLink.tooltip', { key: tri.rememberedKey })}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      restorePrimary
                    )}
                    {tri.isWatched ? (
                      <>
                        <button
                          type="button"
                          ref={tri.denyRef}
                          onClick={tri.requestDeny}
                          className={`px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors ${FOCUS_RING}`}
                        >
                          {t('detail.deny')}
                        </button>
                        <button
                          type="button"
                          onClick={tri.handleRestore}
                          className={`px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors ${FOCUS_RING}`}
                        >
                          {t('watched.restore')}
                        </button>
                      </>
                    ) : (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              ref={tri.watchRef}
                              onClick={tri.requestWatch}
                              className={`px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors ${FOCUS_RING}`}
                            >
                              {t('detail.watch')}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent aria-hidden="true">
                            {t('detail.watch.tooltip')}
                          </TooltipContent>
                        </Tooltip>
                        <button
                          type="button"
                          onClick={tri.handleRestore}
                          className={`px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors ${FOCUS_RING}`}
                        >
                          {t('ignored.restore')}
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          ref={tri.dismissRef}
                          onClick={tri.handleDismiss}
                          className={`px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors ${FOCUS_RING}`}
                        >
                          {t('detail.ignore')}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent aria-hidden="true">
                        {t('detail.ignore.tooltip')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          ref={tri.watchRef}
                          onClick={tri.requestWatch}
                          className={`px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors ${FOCUS_RING}`}
                        >
                          {t('detail.watch')}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent aria-hidden="true">
                        {t('detail.watch.tooltip')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleMarkHandled}
                          className={`px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors ${FOCUS_RING}`}
                        >
                          {t('detail.markHandled')}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent aria-hidden="true">
                        {t('detail.markHandled.tooltip')}
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
                {tri.isLinked || tri.isDenied || tri.isWatched || isHandled ? null : (
                  <button
                    type="button"
                    onClick={handleStartCopy}
                    disabled={copyPhase === 'loading_preview'}
                    className={`px-3 py-1 rounded text-sm font-semibold text-white bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${FOCUS_RING}`}
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
                      t('detail.copy', {
                        name: targetProjectName || t('wizard.destination.subtitle'),
                      })
                    )}
                  </button>
                )}
              </div>
            </TooltipProvider>
            <RememberedLinkHint entry={tri.triageEntry} variant="detail" />
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
              aria-label={
                tab.id === 'changes' && hasUnseenChanges
                  ? t('detail.tab.changes.ariaLabel', { count: changeCount })
                  : undefined
              }
              onClick={() => setActiveTab(tab.id)}
              className={`text-sm py-2 mr-4 border-b-2 transition-colors duration-150 flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'text-brand-text font-semibold border-brand'
                  : 'font-normal text-brand-muted hover:text-brand-text border-transparent'
              }`}
            >
              {tab.label}
              {tab.id === 'changes' && hasUnseenChanges && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 min-w-[16px] h-4 leading-none"
                >
                  {changeCount || '!'}
                </Badge>
              )}
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
          {activeTab === 'changes' && <ChangesTab issueKey={issueKey} />}
        </div>
      )}
      <ConfirmTransitionDialog {...tri.confirmDialog} />
    </aside>
  );
}
