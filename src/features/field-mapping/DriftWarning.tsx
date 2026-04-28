import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export interface DriftWarningProps {
  sourceFieldId: string;
  onRemove: () => void;
}

/**
 * Inline amber alert that replaces a row's target combobox when its targetFieldId
 * is no longer present in the target schema cache (CONTEXT.md D-15, MAP-05).
 * role="alert" on container so screen readers announce the drift state.
 */
export function DriftWarning({ sourceFieldId, onRemove }: DriftWarningProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      data-testid={`drift-warning-${sourceFieldId}`}
      className="flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[13px] text-amber-700 dark:text-amber-400"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{t('settings.fieldMapping.driftWarning')}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onRemove}
        className="ml-auto h-6 px-2 text-xs text-destructive hover:text-destructive"
      >
        {t('settings.fieldMapping.driftRemove')}
      </Button>
    </div>
  );
}
