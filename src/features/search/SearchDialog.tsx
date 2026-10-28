import { Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveAnnouncer } from '../../components/LiveAnnouncer';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { GlobalSearch } from './GlobalSearch';
import { shortcutHint, useSearchShortcut } from './shortcut';

interface SearchDialogProps {
  /** Returns true when the host navigated to the ticket, false when it refused. */
  onOpenTicket: (key: string) => boolean;
}

/**
 * Header search icon that opens a command-palette dialog hosting GlobalSearch.
 * Open state is local: every successful navigation closes it, and an AppShell
 * remount resetting it to closed is the desired behaviour. The query itself
 * persists in searchStore.
 */
export function SearchDialog({ onOpenTicket }: SearchDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Radix returns focus to the trigger on close; that focus must not pop the tooltip (cf. 7f5f380).
  const suppressTip = useRef(false);

  function focusInput() {
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  function handleOpenChange(next: boolean) {
    setTipOpen(false);
    if (!next) suppressTip.current = true;
    setOpen(next);
  }

  function handleTipOpenChange(next: boolean) {
    if (next && (open || suppressTip.current)) {
      suppressTip.current = false;
      return;
    }
    setTipOpen(next);
  }

  useSearchShortcut(() => {
    if (open) focusInput();
    else handleOpenChange(true);
  });

  function handleOpenTicket(key: string): boolean {
    const ok = onOpenTicket(key);
    if (ok) handleOpenChange(false);
    return ok;
  }

  const label = t('search.open');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip open={tipOpen && !open} onOpenChange={handleTipOpenChange}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={label}
              aria-keyshortcuts="Control+K Meta+K Control+F Meta+F"
              className="flex items-center justify-center w-7 h-7 text-brand-muted hover:text-brand-text rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <Search className="w-[15px] h-[15px]" aria-hidden="true" />
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent aria-hidden="true">
          {label} {shortcutHint()}
        </TooltipContent>
      </Tooltip>
      <DialogContent
        data-search-dialog=""
        hideClose
        aria-describedby={undefined}
        // Height is capped to the viewport (equal gap above and below) so the results
        // list scrolls inside the palette instead of running off-screen.
        className="top-[clamp(16px,12vh,120px)] translate-y-0 flex flex-col w-full max-w-[min(calc(100vw-32px),720px)] lg:max-w-[880px] max-h-[calc(100dvh-2*clamp(16px,12vh,120px))] p-0 gap-0 bg-brand-surface border-brand-border rounded-lg overflow-hidden"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          focusInput();
        }}
        onCloseAutoFocus={() => {
          // Radix focuses the trigger right after this handler; clear the guard afterwards
          // so a later hover/focus still shows the tooltip.
          setTimeout(() => {
            suppressTip.current = false;
          }, 0);
        }}
      >
        <DialogTitle className="sr-only">{t('search.label')}</DialogTitle>
        <GlobalSearch inputRef={inputRef} onOpenTicket={handleOpenTicket} />
        {/* Radix hides everything outside the modal from AT, including the app-level announcer. */}
        <LiveAnnouncer />
      </DialogContent>
    </Dialog>
  );
}
