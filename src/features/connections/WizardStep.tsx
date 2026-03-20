import { type ReactNode } from 'react';

interface WizardStepProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function WizardStep({ title, subtitle, children }: WizardStepProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
