import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Terminal } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

interface AppShellProps {
  children: ReactNode;
  onGearClick?: () => void;
  activeTab?: 'new' | 'not-mine' | 'linked';
  onTabChange?: (tab: 'new' | 'not-mine' | 'linked') => void;
  auditCount?: number;
  onAuditClick?: () => void;
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
        <span className="text-xs font-semibold tracking-tight text-brand-text">
          <span className="text-brand">pm</span>kar
        </span>

        {/* Header icon toolbar */}
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={300}>
            {onAuditClick && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onAuditClick}
                    aria-label={t('audit.open')}
                    className="relative flex items-center justify-center w-7 h-7 text-brand-muted hover:text-brand-text rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <Terminal className="w-[15px] h-[15px]" aria-hidden="true" />
                    {(auditCount ?? 0) > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-brand text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center pointer-events-none">
                        {auditCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent aria-hidden="true">{t('audit.open')}</TooltipContent>
              </Tooltip>
            )}
            {onGearClick && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onGearClick}
                    aria-label={t('common.settings')}
                    className="flex items-center justify-center w-7 h-7 text-brand-muted hover:text-brand-text rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <Settings className="w-[15px] h-[15px]" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent aria-hidden="true">{t('common.settings')}</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
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
              className={`text-sm py-2 mr-4 border-b-2 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                activeTab === tab.id
                  ? 'text-brand-text font-semibold border-brand'
                  : 'text-brand-muted font-normal hover:text-brand-text border-transparent'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}
      <div className="flex-1 flex flex-col overflow-hidden" role="main">
        {children}
      </div>
    </div>
  );
}
