import { useTranslation } from 'react-i18next';
import type { JiraAttachment } from '../types';

interface AttachmentsTabProps {
  attachments: JiraAttachment[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function AttachmentsTab({ attachments }: AttachmentsTabProps) {
  const { t } = useTranslation();

  if (attachments.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-brand-muted">{t('detail.tab.attachments')}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-brand-border-subtle px-5">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center gap-3 py-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-brand-text-secondary truncate">{attachment.filename}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-muted">{formatSize(attachment.size)}</span>
              <span className="text-xs text-brand-muted">{attachment.mimeType}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
