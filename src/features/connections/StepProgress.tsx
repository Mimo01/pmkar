const STEPS = [
  { label: 'Source', index: 1 },
  { label: 'Destination', index: 2 },
  { label: 'Done', index: 3 },
];

interface StepProgressProps {
  currentStep: number;
}

function getStepState(stepIndex: number, currentStep: number): 'completed' | 'current' | 'upcoming' {
  if (stepIndex < currentStep) return 'completed';
  if (stepIndex === currentStep) return 'current';
  return 'upcoming';
}

function getDotColor(state: 'completed' | 'current' | 'upcoming'): string {
  switch (state) {
    case 'completed':
      return 'bg-green-600 dark:bg-green-400';
    case 'current':
      return 'bg-blue-600 dark:bg-blue-400';
    case 'upcoming':
      return 'bg-slate-300 dark:bg-slate-600';
  }
}

export function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="flex items-start justify-center gap-4 mb-6" role="list">
      {STEPS.map((step) => {
        const state = getStepState(step.index, currentStep);
        return (
          <div
            key={step.index}
            role="listitem"
            aria-label={`Step ${step.index}: ${step.label} — ${state}`}
            className="flex flex-col items-center gap-1"
          >
            <div className={`w-2 h-2 rounded-full ${getDotColor(state)}`} />
            <span className="text-xs font-semibold leading-snug text-slate-500 dark:text-slate-400">
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
