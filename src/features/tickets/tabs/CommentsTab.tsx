import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../../../lib/format';
import type { JiraComment } from '../types';
import { UserAvatar } from '../UserAvatar';

interface CommentsTabProps {
  comments: JiraComment[];
}

export function CommentsTab({ comments }: CommentsTabProps) {
  const { t } = useTranslation();
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  if (comments.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-brand-muted">{t('detail.tab.comments')}</p>
      </div>
    );
  }

  const sortedComments = [...comments].sort((a, b) =>
    sortOrder === 'desc'
      ? b.created.localeCompare(a.created)
      : a.created.localeCompare(b.created)
  );

  return (
    <div>
      <div className="flex items-center justify-end px-5 pt-2 pb-1">
        <button
          onClick={() => setSortOrder(o => (o === 'desc' ? 'asc' : 'desc'))}
          className="text-xs text-brand-muted hover:text-brand-text-secondary transition-colors"
          aria-label={t('detail.comments.sortToggle.ariaLabel')}
        >
          {sortOrder === 'desc' ? t('detail.comments.sortNewest') : t('detail.comments.sortOldest')}
        </button>
      </div>
      <div className="divide-y divide-brand-border-subtle px-5">
        {sortedComments.map((comment) => (
          <div key={comment.id} className="py-3">
            <div className="flex items-center gap-1.5 pb-1">
              <UserAvatar user={comment.author} size="sm" />
              <span className="text-xs font-semibold text-brand-text-secondary">
                {comment.author.displayName}
              </span>
              <span className="text-xs text-brand-muted">{formatRelativeTime(comment.created)}</span>
            </div>
            <div className="text-sm text-brand-text-secondary pb-3">
              {typeof comment.body === 'string' ? (
                <span className="whitespace-pre-wrap">{comment.body}</span>
              ) : (
                <pre className="text-xs text-brand-text-secondary font-mono whitespace-pre-wrap">
                  {JSON.stringify(comment.body, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
