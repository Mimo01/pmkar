import { Settings, Terminal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CoreTab, TabId } from '../../features/groups/groupTabs';
import { GlobalSearch } from '../../features/search/GlobalSearch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

interface AppShellProps {
  children: ReactNode;
  onGearClick?: () => void;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
  onAuditClick?: () => void;
  navExtension?: ReactNode;
  onOpenTicket?: (key: string) => boolean;
}

export function AppShell({
  children,
  onGearClick,
  activeTab,
  onTabChange,
  onAuditClick,
  navExtension,
  onOpenTicket,
}: AppShellProps) {
  const { t } = useTranslation();

  const NAV_TABS: { id: CoreTab; label: string }[] = [
    { id: 'new', label: t('nav.new') },
    { id: 'not-mine', label: t('nav.notMine') },
    { id: 'linked', label: t('nav.linked') },
    { id: 'watched', label: t('nav.watched') },
  ];

  // Arrow keys are a focus accelerator only: every tab stays in the Tab order
  // (Phase 29 lock) and activation remains Enter/Space/click.
  function handleNavKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const target = e.target as HTMLElement;
    if (!target.hasAttribute('data-nav-tab')) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-nav-tab]'));
    const current = items.indexOf(target);
    if (current < 0) return;
    let next = current;
    if (e.key === 'ArrowLeft') next = current - 1;
    else if (e.key === 'ArrowRight') next = current + 1;
    else if (e.key === 'Home') next = 0;
    else next = items.length - 1;
    next = Math.max(0, Math.min(items.length - 1, next));
    e.preventDefault();
    if (next === current) return;
    items[next].focus();
    items[next].scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }

  return (
    <div className="h-screen bg-brand-bg text-brand-text flex flex-col overflow-hidden">
      <header className="relative flex items-center justify-between px-5 py-2.5 bg-brand-surface border-b border-brand-border">
        <span className="text-xs font-semibold tracking-tight text-brand-text">
          <span className="text-brand">pm</span>kar
        </span>

        {onOpenTicket && (
          // biome-ignore lint/a11y/useSemanticElements: role=search on a div for webview/jsdom parity
          <div
            role="search"
            aria-label={t('search.regionLabel')}
            className="relative flex-1 min-w-[160px] max-w-[320px] mx-4"
          >
            <GlobalSearch onOpenTicket={onOpenTicket} />
          </div>
        )}

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
        <nav
          className="flex items-stretch px-4 bg-brand-surface border-b border-brand-border"
          aria-label={t('nav.mainAria')}
          onKeyDown={handleNavKeyDown}
        >
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              data-nav-tab=""
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`shrink-0 text-sm px-1.5 py-2 mr-3 border-b-2 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 ${
                activeTab === tab.id
                  ? 'text-brand-text font-semibold border-brand'
                  : 'text-brand-text-secondary font-normal hover:text-brand-text border-transparent'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
          {navExtension}
        </nav>
      )}
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
