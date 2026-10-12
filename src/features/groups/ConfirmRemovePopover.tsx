import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ConfirmRemovePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: string;
  onConfirm: () => Promise<unknown>;
  /** Trigger-anchored variant. */
  trigger?: React.ReactNode;
  /** Virtual-anchor variant (no trigger element). */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** When provided, focus is returned explicitly on close. */
  onReturnFocus?: () => void;
  side?: 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
}

/** Shared destructive confirm popover: Cancel focused on open, in-flight guarded Remove. */
export function ConfirmRemovePopover({
  open,
  onOpenChange,
  question,
  onConfirm,
  trigger,
  anchorRef,
  onReturnFocus,
  side = 'top',
  align,
}: ConfirmRemovePopoverProps) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const inFlightRef = useRef(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {trigger && <PopoverTrigger asChild>{trigger}</PopoverTrigger>}
      {anchorRef && <PopoverAnchor virtualRef={anchorRef} />}
      <PopoverContent
        className="w-70 p-4"
        side={side}
        align={align}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelRef.current?.focus();
        }}
        onCloseAutoFocus={
          onReturnFocus
            ? (e) => {
                e.preventDefault();
                onReturnFocus();
              }
            : undefined
        }
      >
        <p className="text-sm font-semibold text-brand-text mb-3">{question}</p>
        <div className="flex justify-end gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t('groups.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="text-white"
            disabled={busy}
            onClick={handleConfirm}
          >
            {t('groups.confirm.remove')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
