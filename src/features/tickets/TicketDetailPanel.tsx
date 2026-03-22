import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { JiraTicketDetail } from './types';
import { OverviewTab } from './tabs/OverviewTab';
import { CommentsTab } from './tabs/CommentsTab';
import { WorkLogTab } from './tabs/WorkLogTab';
import { AttachmentsTab } from './tabs/AttachmentsTab';
import { HistoryTab } from './tabs/HistoryTab';

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
      <div className="px-5 py-4 border-b border-slate-800">
        {loading ? (
          /* Skeleton loading state */
          <div aria-busy="true">
            <div className="flex justify-end mb-2">
              <div className="w-8 h-8 animate-pulse bg-slate-800/60 rounded-lg" />
            </div>
            <div className="animate-pulse bg-slate-800/60 rounded h-3 w-20 mb-2" />
            <div className="animate-pulse bg-slate-800/60 rounded h-5 w-full mb-2" />
            <div className="flex gap-2">
              <div className="animate-pulse bg-slate-800/60 rounded-full h-6 w-16" />
              <div className="animate-pulse bg-slate-800/60 rounded-full h-6 w-16" />
            </div>
          </div>
        ) : detail ? (
          <>
            <div className="flex justify-end">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 rounded-lg transition-colors duration-150"
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
            <div className="text-xs font-semibold text-slate-500 mb-1">
              {detail.key}
            </div>
            <div className="text-xl font-semibold text-slate-100 leading-tight line-clamp-2">
              {detail.fields.summary}
            </div>
            <div className="flex gap-2 mt-2">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                {detail.fields.status.name}
              </span>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                {detail.fields.priority.name}
              </span>
            </div>
          </>
        ) : (
          <div className="text-xs text-red-400">Failed to load ticket detail</div>
        )}
      </div>

      {/* Tab bar */}
      {detail && (
        <div className="flex border-b border-slate-800 px-5" role="tablist">
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
                  ? 'text-slate-200 font-semibold border-red-600'
                  : 'font-normal text-slate-500 hover:text-slate-300 border-transparent'
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
    </div>
  );
}
