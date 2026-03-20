import { type ReactNode } from 'react';

interface WizardStepProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function WizardStep({ title, subtitle, children }: WizardStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold leading-tight text-slate-950 dark:text-slate-50">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm font-normal leading-normal text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
