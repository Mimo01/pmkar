import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../../../lib/format';
import type { JiraComment } from '../types';

interface CommentsTabProps {
  comments: JiraComment[];
}

export function CommentsTab({ comments }: CommentsTabProps) {
  const { t } = useTranslation();

  if (comments.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-brand-muted">{t('detail.tab.comments')}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-brand-border-subtle px-5">
      {comments.map((comment) => (
        <div key={comment.id} className="py-3">
          <div className="flex items-center gap-2 pb-1">
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
  );
}
