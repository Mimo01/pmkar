import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Equal } from 'lucide-react';

interface PriorityIconProps {
  priority: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function PriorityIcon({ priority, showLabel = true, size = 'sm' }: PriorityIconProps) {
  const lower = priority.toLowerCase();
  const iconClass = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  let Icon = Equal;
  let color = '#ca8a04'; // medium default

  if (lower === 'highest' || lower === 'critical') {
    Icon = ChevronsUp;
    color = '#dc2626';
  } else if (lower === 'high') {
    Icon = ChevronUp;
    color = '#ea580c';
  } else if (lower === 'medium') {
    Icon = Equal;
    color = '#ca8a04';
  } else if (lower === 'low') {
    Icon = ChevronDown;
    color = '#3b82f6';
  } else if (lower === 'lowest') {
    Icon = ChevronsDown;
    color = '#60a5fa';
  }

  return (
    <span className="flex items-center gap-1">
      <Icon className={iconClass} style={{ color }} aria-hidden="true" />
      {showLabel && (
        <span className="text-xs text-brand-text-secondary">{priority}</span>
      )}
    </span>
  );
}
