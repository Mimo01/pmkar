import { AlertCircle } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useGroupStore } from './groupStore';
import type { GroupErrorCode, GroupResult } from './types';
import { type GroupNameValidation, normalizeGroupName, validateGroupName } from './validation';

export function groupNameErrorKey(code: GroupErrorCode, action: 'create' | 'rename'): string {
  switch (code) {
    case 'duplicate':
      return 'groups.error.duplicate';
    case 'reserved':
      return 'groups.error.reserved';
    case 'too_long':
      return 'groups.error.tooLong';
    case 'no_scope':
      return 'groups.error.noScope';
    case 'not_found':
      return 'groups.error.notFound';
    default:
      return action === 'create' ? 'groups.error.internal' : 'groups.error.rename';
  }
}

export interface UseGroupNameForm {
  name: string;
  setName(v: string): void;
  validation: GroupNameValidation;
  unchanged: boolean;
  message: string | null;
  canSubmit: boolean;
  submitting: boolean;
  submitError: GroupErrorCode | null;
  action: 'create' | 'rename';
  reset(initialName: string): void;
  submit<T>(run: (display: string) => Promise<GroupResult<T>>): Promise<GroupResult<T> | null>;
}

export function useGroupNameForm(opts: {
  action: 'create' | 'rename';
  excludeGroupId?: number;
  originalName?: string;
}): UseGroupNameForm {
  const { action, excludeGroupId, originalName } = opts;
  const { t } = useTranslation();
  const [name, setNameState] = useState('');
  const [submitError, setSubmitError] = useState<GroupErrorCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlightRef = useRef(false);
  // Incremented on every reset (open); a submit that settles after a reopen is stale.
  const openSeq = useRef(0);
  const groups = useGroupStore((s) => s.groups);

  // Self is excluded by id, not by name, so case-only / diacritic-only renames of
  // the group's own name are allowed (D-07).
  const existingNames = useMemo(
    () => groups.filter((g) => g.id !== excludeGroupId).map((g) => g.name),
    [groups, excludeGroupId],
  );

  const validation = useMemo(() => validateGroupName(name, existingNames), [name, existingNames]);

  const unchanged =
    action === 'rename' &&
    originalName !== undefined &&
    normalizeGroupName(name) === normalizeGroupName(originalName);

  let messageCode: GroupErrorCode | null = null;
  if (unchanged) messageCode = null;
  else if (submitError) messageCode = submitError;
  else if (!validation.ok && validation.code !== 'empty') messageCode = validation.code;
  const message = messageCode ? t(groupNameErrorKey(messageCode, action)) : null;

  const canSubmit = validation.ok && !unchanged && !submitting && submitError !== 'not_found';

  function setName(v: string) {
    setNameState(v);
    setSubmitError(null);
  }

  function reset(initialName: string) {
    setNameState(initialName);
    setSubmitError(null);
    openSeq.current += 1;
    // inFlightRef/submitting are deliberately not reset: a submit started before
    // Cancel/Esc may still be pending, and submit stays disabled until it settles.
  }

  async function submit<T>(
    run: (display: string) => Promise<GroupResult<T>>,
  ): Promise<GroupResult<T> | null> {
    if (!canSubmit || inFlightRef.current || !validation.ok) return null;
    inFlightRef.current = true;
    setSubmitting(true);
    const token = openSeq.current;
    try {
      const r = await run(validation.display);
      // The popover was reopened while this request was pending; do not close or
      // navigate under the user, and do not show a stale error.
      if (token !== openSeq.current) return null;
      if (!r.ok) setSubmitError(r.code);
      return r;
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return {
    name,
    setName,
    validation,
    unchanged,
    message,
    canSubmit,
    submitting,
    submitError,
    action,
    reset,
    submit,
  };
}

export function GroupNameForm({
  title,
  submitLabel,
  form,
  onSubmit,
  onCancel,
  selectOnFocus,
  children,
}: {
  title: string;
  submitLabel: string;
  form: UseGroupNameForm;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  selectOnFocus?: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const errorId = useId();

  return (
    <form onSubmit={onSubmit}>
      <h2 className="text-base font-semibold text-brand-text mb-3">{title}</h2>
      <label htmlFor={inputId} className="sr-only">
        {t('groups.name.label')}
      </label>
      <input
        id={inputId}
        type="text"
        // biome-ignore lint/a11y/noAutofocus: popover input must take focus on open (D-01)
        autoFocus
        value={form.name}
        onChange={(e) => form.setName(e.target.value)}
        onFocus={selectOnFocus ? (e) => e.currentTarget.select() : undefined}
        placeholder={t('groups.name.label')}
        aria-invalid={form.message ? true : undefined}
        aria-describedby={errorId}
        className="w-full rounded-md border border-brand-border bg-transparent px-2 py-1.5 text-sm text-brand-text outline-none focus:border-focus-ring focus:ring-2 focus:ring-focus-ring"
      />
      <p
        id={errorId}
        role="alert"
        className="mt-1 min-h-4 flex items-center gap-1 text-xs text-destructive-text"
      >
        {form.message && (
          <>
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            {form.message}
          </>
        )}
      </p>
      {children}
      <div className="flex justify-end gap-2 mt-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('groups.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={!form.canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
