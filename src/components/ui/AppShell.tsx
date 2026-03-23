import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface AppShellProps {
  children: ReactNode;
  onGearClick?: () => void;
  activeTab?: 'new' | 'not-mine' | 'linked';
  onTabChange?: (tab: 'new' | 'not-mine' | 'linked') => void;
  auditCount?: number;
  onAuditClick?: () => void;
}

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function AppShell({ children, onGearClick, activeTab, onTabChange, auditCount, onAuditClick }: AppShellProps) {
  const { t } = useTranslation();

  const NAV_TABS: { id: 'new' | 'not-mine' | 'linked'; label: string }[] = [
    { id: 'new', label: t('nav.new') },
    { id: 'not-mine', label: t('nav.notMine') },
    { id: 'linked', label: t('nav.linked') },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
      <header className="relative flex items-center justify-between px-5 py-2.5 bg-brand-surface border-b border-brand-border">
        <span className="text-[13px] font-semibold tracking-tight text-brand-text">
          <span className="text-brand">pm</span>kar
        </span>

        {/* Always reserve space for gear icon to prevent height jump */}
        <div className="w-7 h-7 flex items-center justify-center">
          {onGearClick && (
            <button
              type="button"
              onClick={onGearClick}
              aria-label={t('common.settings')}
              className="flex items-center justify-center w-7 h-7 text-brand-muted hover:text-brand-text rounded transition-all duration-200"
            >
              <GearIcon />
            </button>
          )}
        </div>

        {/* Brand accent underline */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand via-brand/60 to-transparent" />
      </header>
      {onTabChange && (
        <nav className="flex px-4 bg-brand-surface border-b border-brand-border" aria-label="Main navigation">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`text-sm py-2 mr-4 border-b-2 transition-colors duration-150 ${
                activeTab === tab.id
                  ? 'text-brand-text font-semibold border-brand'
                  : 'text-brand-muted hover:text-brand-text border-transparent'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
      {onAuditClick && (
        <button
          type="button"
          onClick={onAuditClick}
          className="px-4 py-2 bg-brand-surface border-t border-brand-border text-xs text-brand-muted hover:text-brand-text transition-colors duration-150 text-left"
          aria-label={t('audit.open')}
        >
          {t('nav.apiCalls', { count: auditCount ?? 0 })}
        </button>
      )}
    </div>
  );
}
