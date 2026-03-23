import { useTranslation } from 'react-i18next';

interface StepProgressProps {
  currentStep: number;
}

function getStepState(stepIndex: number, currentStep: number): 'completed' | 'current' | 'upcoming' {
  if (stepIndex < currentStep) return 'completed';
  if (stepIndex === currentStep) return 'current';
  return 'upcoming';
}

function CheckMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function StepProgress({ currentStep }: StepProgressProps) {
  const { t } = useTranslation();

  const STEPS = [
    { label: t('wizard.step.source'), index: 1 },
    { label: t('wizard.step.destination'), index: 2 },
    { label: t('wizard.step.done'), index: 3 },
  ];

  return (
    <div className="flex items-center justify-center gap-0 mb-8" role="list">
      {STEPS.map((step, i) => {
        const state = getStepState(step.index, currentStep);
        return (
          <div key={step.index} className="flex items-center" role="listitem" aria-label={`Step ${step.index}: ${step.label} — ${state}`}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300',
                  state === 'completed' ? 'bg-emerald-500 text-white' : '',
                  state === 'current' ? 'bg-brand text-white ring-4 ring-brand/20' : '',
                  state === 'upcoming' ? 'bg-brand-surface-hover text-brand-muted border border-brand-border' : '',
                ].filter(Boolean).join(' ')}
              >
                {state === 'completed' ? <CheckMark /> : step.index}
              </div>
              <span className={[
                'text-[11px] font-medium tracking-wide uppercase transition-colors duration-300',
                state === 'completed' ? 'text-emerald-400' : '',
                state === 'current' ? 'text-brand' : '',
                state === 'upcoming' ? 'text-brand-muted' : '',
              ].filter(Boolean).join(' ')}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={[
                'w-16 h-px mx-3 mb-5 transition-colors duration-300',
                step.index < currentStep ? 'bg-emerald-500/50' : 'bg-brand-surface-hover',
              ].join(' ')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
