import type { JiraComment } from '../types';

interface CommentsTabProps {
  comments: JiraComment[];
}

function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) return `${diffDays}d ago`;
  if (diffHours >= 1) return `${diffHours}h ago`;
  if (diffMins >= 1) return `${diffMins}m ago`;
  return 'just now';
}

export function CommentsTab({ comments }: CommentsTabProps) {
  if (comments.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-brand-muted">No comments</p>
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
            <span className="text-xs text-brand-muted">
              {formatRelativeTime(comment.created)}
            </span>
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
