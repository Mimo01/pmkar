import { AlertCircle, Plus } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useGroupStore } from './groupStore';
import type { GroupErrorCode } from './types';
import { validateGroupName } from './validation';

function errorKey(code: GroupErrorCode): string {
  switch (code) {
    case 'duplicate':
      return 'groups.error.duplicate';
    case 'reserved':
      return 'groups.error.reserved';
    case 'too_long':
      return 'groups.error.tooLong';
    case 'no_scope':
      return 'groups.error.noScope';
    default:
      return 'groups.error.internal';
  }
}

export function CreateGroupPopover({ onCreated }: { onCreated: (groupId: number) => void }) {
  const { t } = useTranslation();
  const inputId = useId();
  const errorId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [submitError, setSubmitError] = useState<GroupErrorCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const createdRef = useRef(false);
  const inFlightRef = useRef(false);
  const groups = useGroupStore((s) => s.groups);

  const v = useMemo(
    () =>
      validateGroupName(
        name,
        groups.map((g) => g.name),
      ),
    [name, groups],
  );

  let messageCode: GroupErrorCode | null = null;
  if (submitError) messageCode = submitError;
  else if (!v.ok && v.code !== 'empty') messageCode = v.code;
  const message = messageCode ? t(errorKey(messageCode)) : null;

  function handleOpenChange(next: boolean) {
    if (next) {
      setName('');
      setSubmitError(null);
      setSubmitting(false);
      createdRef.current = false;
      inFlightRef.current = false;
    }
    setOpen(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.ok || submitting || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    try {
      const r = await useGroupStore.getState().createGroup(v.display);
      if (r.ok) {
        createdRef.current = true;
        setOpen(false);
        onCreated(r.value.id);
      } else {
        setSubmitError(r.code);
      }
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('groups.new')}
              className="flex items-center justify-center w-7 h-7 text-brand-muted hover:text-brand-text rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent aria-hidden="true">{t('groups.new')}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        onCloseAutoFocus={(e) => {
          if (createdRef.current) e.preventDefault();
        }}
      >
        <form onSubmit={handleSubmit}>
          <h2 className="text-base font-semibold text-brand-text mb-3">{t('groups.new')}</h2>
          <label htmlFor={inputId} className="sr-only">
            {t('groups.name.label')}
          </label>
          <input
            id={inputId}
            type="text"
            // biome-ignore lint/a11y/noAutofocus: popover input must take focus on open (D-01)
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSubmitError(null);
            }}
            placeholder={t('groups.name.label')}
            aria-invalid={message ? true : undefined}
            aria-describedby={errorId}
            className="w-full rounded-md border border-brand-border bg-transparent px-2 py-1.5 text-sm text-brand-text outline-none focus:border-brand focus:ring-2 focus:ring-brand"
          />
          <p
            id={errorId}
            role="alert"
            className="mt-1 min-h-4 flex items-center gap-1 text-xs text-destructive"
          >
            {message && (
              <>
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                {message}
              </>
            )}
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
              {t('groups.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={!v.ok || submitting}>
              {t('groups.create')}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
