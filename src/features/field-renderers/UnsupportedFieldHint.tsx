import { ExternalLink, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UnsupportedFieldHintProps {
  'data-testid'?: string;
  onMapLink?: () => void;
}

export function UnsupportedFieldHint({
  'data-testid': testId,
  onMapLink,
}: UnsupportedFieldHintProps) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5"
      data-testid={testId}
    >
      <div className="flex items-start gap-2 min-w-0">
        <Info
          className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          {t('copy.preview.unsupportedFieldHint')}
        </p>
      </div>
      {onMapLink && (
        <button
          type="button"
          onClick={onMapLink}
          className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 hover:underline shrink-0 whitespace-nowrap"
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          {t('copy.preview.mapLink')}
        </button>
      )}
    </div>
  );
}
