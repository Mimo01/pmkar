import { AlertCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useGroupStore } from './groupStore';
import type { GroupErrorCode } from './types';

export interface DeleteGroupTarget {
  id: number;
  name: string;
  memberCount: number;
}

interface DeleteGroupDialogProps {
  target: DeleteGroupTarget | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: number) => void;
  onReturnFocus: (deleted: boolean) => void;
}

export function DeleteGroupDialog({
  target,
  onOpenChange,
  onDeleted,
  onReturnFocus,
}: DeleteGroupDialogProps) {
  const { t } = useTranslation();
  const keepRef = useRef<HTMLButtonElement>(null);
  const deletedRef = useRef(false);
  const inFlightRef = useRef(false);
  const lastTargetRef = useRef<DeleteGroupTarget | null>(null);
  const [error, setError] = useState<GroupErrorCode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (target) lastTargetRef.current = target;
  const snapshot = target ?? lastTargetRef.current;

  const targetId = target?.id;
  useEffect(() => {
    if (targetId !== undefined) {
      deletedRef.current = false;
      setError(null);
    }
  }, [targetId]);

  async function handleConfirm() {
    if (!snapshot || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const r = await useGroupStore.getState().deleteGroup(snapshot.id);
      if (r.ok) {
        deletedRef.current = true;
        onDeleted(snapshot.id);
        onOpenChange(false);
      } else {
        setError(r.code);
      }
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  const count = snapshot?.memberCount ?? 0;
  const message = error
    ? error === 'not_found'
      ? t('groups.error.notFound')
      : t('groups.error.delete')
    : null;

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o && !submitting) onOpenChange(false);
      }}
    >
      <DialogContent
        role="alertdialog"
        hideClose
        className="max-w-[400px] p-6 bg-popover border-brand-border"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          keepRef.current?.focus();
        }}
        onInteractOutside={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onReturnFocus(deletedRef.current);
        }}
      >
        <DialogTitle className="text-base font-semibold leading-tight text-brand-text">
          {t('groups.delete.title', { name: snapshot?.name ?? '' })}
        </DialogTitle>
        <DialogDescription className="mt-4 text-sm text-brand-text-secondary">
          {count === 0 ? t('groups.delete.bodyEmpty') : t('groups.delete.body', { count })}
        </DialogDescription>
        <p role="alert" className="mt-2 min-h-4 flex items-center gap-1 text-xs text-destructive">
          {message && (
            <>
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              {message}
            </>
          )}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            ref={keepRef}
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            {t('groups.delete.keep')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="text-white"
            disabled={submitting}
            onClick={handleConfirm}
          >
            {t('groups.delete.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
