# Phase 33 Deferred Items

## Intentional exceptions (D-03)

- src/index.css body.dark `--color-ring` #c02232 -> #e5484d — global (affects all screens' shadcn focus rings), approved by user 2026-10-12; not deferred, applied in 33-02.

## Non-group contrast (D-03)

Pre-v0.5.0 TicketFilterBar controls left unchanged (muted text and brand focus ring); out of scope for group contrast:

- src/features/tickets/TicketFilterBar.tsx:142, 158, 208, 248, 263, 274 (`text-brand-muted`)
- src/features/tickets/TicketFilterBar.tsx:151, 198 (search/sort inputs, `focus:ring-brand`)
- src/components/ui/AppShell.tsx:49, 64 (header icon buttons, `text-brand-muted` and `ring-brand`)

The Select toggle (TicketFilterBar.tsx ~L279) uses the shared shadcn Button ring, fixed by the dark `--color-ring` change in 33-02; no override present.
