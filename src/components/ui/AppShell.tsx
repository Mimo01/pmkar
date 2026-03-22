import { type ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
  onGearClick?: () => void;
}

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
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

export function AppShell({ children, onGearClick }: AppShellProps) {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <header className="flex items-center justify-between px-5 py-0 border-b border-brand-border bg-brand-bg">
        <div className="flex items-center gap-0">
          {/* Brand mark — red block with app name */}
          <div className="bg-brand px-4 py-2.5 -ml-5 mr-4">
            <span className="text-sm font-semibold tracking-wider uppercase text-white">pmkar</span>
          </div>
          <span className="text-xs text-brand-muted">Jira Ticket Bridge</span>
        </div>
        {onGearClick && (
          <button
            type="button"
            onClick={onGearClick}
            aria-label="Settings"
            className="flex items-center justify-center w-8 h-8 text-brand-muted hover:text-brand-text hover:bg-brand-surface-hover rounded transition-all duration-200"
          >
            <GearIcon />
          </button>
        )}
      </header>
      {children}
    </div>
  );
}
