import { useState } from 'react';

interface SecretInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  helpUrl: string;
  helpLabel?: string;
}

export function SecretInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
  helpUrl,
  helpLabel = 'Where do I find this?',
}: SecretInputProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-sm font-normal leading-normal text-slate-950 dark:text-slate-50"
        >
          {label}
        </label>
        <a
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-slate-500 hover:text-blue-600 underline"
        >
          {helpLabel}
        </a>
      </div>
      <div className="relative flex items-center">
        <input
          id={id}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={[
            'w-full rounded-md border border-slate-200 dark:border-slate-700',
            'bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50',
            'px-3 py-2 pr-11 text-base font-normal leading-normal',
            'focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          disabled={disabled}
          aria-label={revealed ? 'Hide token' : 'Show token'}
          aria-pressed={revealed}
          className={[
            'absolute right-0 flex items-center justify-center w-11 h-11',
            'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            'focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2',
            'rounded-md',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {revealed ? (
            /* eye-off SVG — field is revealed */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            /* eye-open SVG — field is masked */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
