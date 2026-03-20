import { type ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-50">
      {children}
    </div>
  );
}
