import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export type ConfirmTransitionKind = 'deny' | 'link';

export interface ConfirmTransitionTarget {
  kind: ConfirmTransitionKind;
  ticketKey: string;
  cloudKey: string;
}

export interface ConfirmTransitionDialogProps {
  /** Dialog is open when non-null. */
  target: ConfirmTransitionTarget | null;
  /** Confirm -> true; Cancel or Esc -> false. Parent must then set target to null. */
  onResolve: (confirmed: boolean) => void;
  /** Called after close with the last resolution (focus return / deferred action). */
  onClosed: (confirmed: boolean) => void;
}

export function ConfirmTransitionDialog({
  target,
  onResolve,
  onClosed,
}: ConfirmTransitionDialogProps) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resolvedRef = useRef(false);
  const submittedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  // Keep the last non-null target so content stays stable while the dialog animates out.
  // Derived-state pattern (setState during render) instead of mutating a ref (WR-03).
  const [snapshot, setSnapshot] = useState<ConfirmTransitionTarget | null>(target);
  if (target && target !== snapshot) {
    setSnapshot(target);
    setSubmitting(false);
  }

  useEffect(() => {
    if (target) {
      resolvedRef.current = false;
      submittedRef.current = false;
    }
  }, [target]);

  function handleConfirm() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    resolvedRef.current = true;
    setSubmitting(true);
    onResolve(true);
  }

  function handleCancel() {
    if (submittedRef.current) return;
    resolvedRef.current = false;
    onResolve(false);
  }

  const kind = snapshot?.kind ?? 'deny';
  const vars = {
    key: snapshot?.ticketKey ?? '',
    cloudKey: snapshot?.cloudKey ?? '',
    tab: kind === 'deny' ? t('nav.notMine') : t('nav.linked'),
  };
  const isDeny = kind === 'deny';

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) handleCancel();
      }}
    >
      <DialogContent
        role="alertdialog"
        hideClose
        className="max-w-[400px] p-6 bg-popover border-brand-border"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelRef.current?.focus();
        }}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onClosed(resolvedRef.current);
        }}
      >
        <DialogTitle className="text-base font-semibold leading-tight text-brand-text">
          {isDeny ? t('triage.confirm.deny.title', vars) : t('triage.confirm.link.title', vars)}
        </DialogTitle>
        <DialogDescription className="mt-4 text-sm text-brand-text-secondary">
          {isDeny ? t('triage.confirm.deny.body', vars) : t('triage.confirm.link.body', vars)}
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={handleCancel}
          >
            {t('triage.confirm.cancel')}
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={submitting}
            onClick={handleConfirm}
          >
            {isDeny ? t('triage.confirm.deny.action', vars) : t('triage.confirm.link.action', vars)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
