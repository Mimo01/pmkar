import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

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

  function handleHelpClick(e: React.MouseEvent) {
    e.preventDefault();
    invoke('open_external_url', { url: helpUrl }).catch((err) =>
      console.error('Failed to open help URL:', err),
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-sm font-medium text-slate-300"
        >
          {label}
        </label>
        <button
          type="button"
          onClick={handleHelpClick}
          className="text-xs text-slate-500 hover:text-brand transition-colors cursor-pointer"
        >
          {helpLabel}
        </button>
      </div>
      <div className="relative flex items-center">
        <input
          id={id}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={[
            'w-full rounded-lg border border-slate-700/50 bg-slate-800/50',
            'text-slate-100 placeholder-slate-500',
            'px-3 py-2.5 pr-11 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50',
            'transition-all duration-200',
            disabled ? 'opacity-40 cursor-not-allowed' : '',
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
            'text-slate-500 hover:text-slate-300',
            'transition-colors duration-200 rounded-lg',
            disabled ? 'opacity-40 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {revealed ? (
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
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
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
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
