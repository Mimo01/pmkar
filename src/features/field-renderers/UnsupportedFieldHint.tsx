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
    <div className="flex items-center gap-2" data-testid={testId}>
      <div className="flex-1 flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2">
        <Info
          className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          {t('copy.preview.unsupportedFieldHint')}
        </p>
      </div>
      {onMapLink && (
        <button
          type="button"
          onClick={onMapLink}
          className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline shrink-0 whitespace-nowrap"
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          {t('copy.preview.mapLink')}
        </button>
      )}
    </div>
  );
}
