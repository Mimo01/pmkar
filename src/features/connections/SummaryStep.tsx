import { useTranslation } from 'react-i18next';
import type { ConnectionMeta } from './types';

function CheckIcon() {
  return (
    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-400"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}

interface ConnectionSummaryCardProps {
  label: string;
  connection: ConnectionMeta;
}

function ConnectionSummaryCard({ label, connection }: ConnectionSummaryCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-brand-border bg-brand-surface p-4">
      <CheckIcon />
      <div className="min-w-0">
        <p className="text-sm font-medium text-brand-text">{label}</p>
        <p className="text-xs text-brand-muted truncate">{connection.baseUrl}</p>
        <p className="text-xs text-brand-text-secondary">{connection.username}</p>
      </div>
    </div>
  );
}

interface SummaryStepProps {
  serverConnection: ConnectionMeta;
  cloudConnection: ConnectionMeta;
  onDone: () => void;
}

export function SummaryStep({ serverConnection, cloudConnection, onDone }: SummaryStepProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-text-secondary">{t('wizard.bothConfigured')}</p>

      <div className="space-y-3">
        <ConnectionSummaryCard label={t('settings.sourceLabel')} connection={serverConnection} />
        <ConnectionSummaryCard label={t('settings.destLabel')} connection={cloudConnection} />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onDone}
          className="bg-brand hover:bg-brand-light active:bg-brand-dark text-white font-medium rounded-lg py-2.5 px-6 text-sm transition-all duration-200"
        >
          {t('wizard.done')}
        </button>
      </div>
    </div>
  );
}
