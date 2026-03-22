import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { JiraTicketDetail } from './types';
import { OverviewTab } from './tabs/OverviewTab';
import { CommentsTab } from './tabs/CommentsTab';
import { WorkLogTab } from './tabs/WorkLogTab';
import { AttachmentsTab } from './tabs/AttachmentsTab';
import { HistoryTab } from './tabs/HistoryTab';
import { useCopyStore } from './copyStore';
import { useConnectionStore } from '../connections/connectionStore';
import { CopyPreviewModal } from './CopyPreviewModal';
import { CopyResultModal } from './CopyResultModal';

type TabId = 'overview' | 'comments' | 'worklog' | 'attachments' | 'history';

interface TicketDetailPanelProps {
  issueKey: string;
  baseUrl: string;
  onClose: () => void;
}

export function TicketDetailPanel({
  issueKey,
  baseUrl,
  onClose,
}: TicketDetailPanelProps) {
  const [detail, setDetail] = useState<JiraTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const copyPhase = useCopyStore((s) => s.phase);
  const copyError = useCopyStore((s) => s.error);
  const cloudBaseUrl = useConnectionStore((s) => s.cloudConnection?.baseUrl ?? '');

  const handleStartCopy = () => {
    if (detail) {
      useCopyStore.getState().startPreview(detail, baseUrl, cloudBaseUrl);
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
        { id: 'overview', label: 'Overview' },
        {
          id: 'comments',
          label: `Comments (${detail.fields.comment.comments.length})`,
        },
        { id: 'worklog', label: 'Work Log' },
        {
          id: 'attachments',
          label: `Attachments (${detail.fields.attachment.length})`,
        },
        { id: 'history', label: 'History' },
      ]
    : [];

  return (
    <div className="flex flex-col h-full" role="complementary" aria-label="Ticket detail">
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
                aria-label="Close ticket detail"
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
            <div className="text-xs font-semibold text-brand-muted mb-1">
              {detail.key}
            </div>
            <div className="text-xl font-semibold text-brand-text leading-tight line-clamp-2">
              {detail.fields.summary}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-brand-surface-hover text-brand-text-secondary">
                {detail.fields.status.name}
              </span>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-brand-surface-hover text-brand-text-secondary">
                {detail.fields.priority.name}
              </span>
              <button
                type="button"
                onClick={handleStartCopy}
                disabled={copyPhase === 'loading_preview'}
                className="ml-auto px-3 py-1 rounded text-sm font-semibold text-white bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {copyPhase === 'loading_preview' ? (
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
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
                  'Copy to Company Jira'
                )}
              </button>
            </div>
            {copyError && (
              <p className="text-xs text-red-400 mt-1">{copyError}</p>
            )}
          </>
        ) : (
          <div className="text-xs text-red-400">Failed to load ticket detail</div>
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
        <div
          className="overflow-y-auto flex-1"
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
        >
          {activeTab === 'overview' && (
            <OverviewTab detail={detail} baseUrl={baseUrl} />
          )}
          {activeTab === 'comments' && (
            <CommentsTab comments={detail.fields.comment.comments} />
          )}
          {activeTab === 'worklog' && (
            <WorkLogTab issueKey={issueKey} baseUrl={baseUrl} />
          )}
          {activeTab === 'attachments' && (
            <AttachmentsTab attachments={detail.fields.attachment} />
          )}
          {activeTab === 'history' && (
            <HistoryTab issueKey={issueKey} baseUrl={baseUrl} />
          )}
        </div>
      )}

      {/* Copy preview modal — overlays when copy phase is active */}
      <CopyPreviewModal />
      {/* Copy result modal — overlays after copy completes (z-[60] > z-50 preview) */}
      <CopyResultModal />
    </div>
  );
}
