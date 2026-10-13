import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GROUP_COLOR_TOKENS, type GroupColorToken, groupColorVar } from './colors';

export function GroupColorSwatches({
  value,
  onSelect,
  selectionFollowsFocus,
  autoFocus,
}: {
  value: GroupColorToken;
  onSelect: (token: GroupColorToken) => void;
  selectionFollowsFocus: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [focusedToken, setFocusedToken] = useState<GroupColorToken>(value);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setFocusedToken(value);
  }, [value]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only autofocus
  useEffect(() => {
    if (!autoFocus) return;
    refs.current[GROUP_COLOR_TOKENS.indexOf(value)]?.focus();
  }, []);

  function moveTo(index: number) {
    const n = GROUP_COLOR_TOKENS.length;
    const next = (index + n) % n;
    const token = GROUP_COLOR_TOKENS[next];
    setFocusedToken(token);
    refs.current[next]?.focus();
    if (selectionFollowsFocus) onSelect(token);
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        moveTo(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        moveTo(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        moveTo(0);
        break;
      case 'End':
        e.preventDefault();
        moveTo(GROUP_COLOR_TOKENS.length - 1);
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('groups.color.label')}
      className="grid w-fit grid-cols-6 gap-1"
    >
      {GROUP_COLOR_TOKENS.map((token, index) => {
        const checked = token === value;
        const label = t(`groups.color.${token}`);
        return (
          <Tooltip key={token}>
            <TooltipTrigger asChild>
              {/* biome-ignore lint/a11y/useSemanticElements: roving-tabindex radiogroup of styled buttons (D-09) */}
              <button
                ref={(el) => {
                  refs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={label}
                tabIndex={token === focusedToken ? 0 : -1}
                onClick={() => onSelect(token)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="relative flex h-6 w-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
              >
                <span
                  aria-hidden="true"
                  className={
                    checked
                      ? 'h-4 w-4 rounded-full ring-2 ring-brand-text ring-offset-2 ring-offset-popover'
                      : 'h-4 w-4 rounded-full'
                  }
                  style={{ backgroundColor: groupColorVar(token) }}
                />
                {checked && (
                  <span
                    aria-hidden="true"
                    className="absolute flex h-3 w-3 items-center justify-center rounded-full bg-brand-text"
                  >
                    <Check className="h-3 w-3 text-popover" aria-hidden="true" />
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent aria-hidden="true">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
