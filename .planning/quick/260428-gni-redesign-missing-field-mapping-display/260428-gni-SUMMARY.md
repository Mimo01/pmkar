---
quick_id: 260428-gni
status: complete
date: 2026-04-28
---

# Summary: Redesign missing field mapping display variants

## What changed

**GapsSection.tsx** — `GapRow` now uses a unified layout for both editable and non-editable states:
- Both states: `label | content area | [Map field button]` on the same row
- Non-editable: replaced heavy `UnsupportedFieldHint` amber box with a clean muted placeholder (`border-border/60 bg-muted/40`) styled like a disabled input — same height (h-9) as real inputs
- Removed the sr-only hidden button workaround; `gap-map-link-{id}` testid is now on the real visible button
- Removed `UnsupportedFieldHint` import from GapsSection

**UnsupportedFieldHint.tsx** — Redesigned from amber to neutral muted:
- Removed: `border-amber-500/40`, `bg-amber-500/10`, `text-amber-700 dark:text-amber-400`
- Added: `border-border/60`, `bg-muted/40`, `text-muted-foreground`
- Map link button now uses `text-muted-foreground hover:text-foreground` instead of amber

**en.json / sk.json** — New translation key `copy.preview.fieldNoManualInput` ("No manual input" / "Bez manuálneho vstupu") for the GapRow placeholder.

## Final iterations (user feedback)
- Removed group container — each field is now independent (no shared amber box)
- Removed "Required fields with no mapping" header — amber cards are self-explanatory
- Label styled standard (`text-xs font-medium text-foreground`) — only content is amber
- Layout changed to label-above-content matching `DynamicTargetForm` exactly
- Non-editable content uses `UnsupportedFieldHint` (amber box) instead of custom placeholder
- `UnsupportedFieldHint` map link button unified to `<Button variant="ghost" size="sm">` so all "Mapovať pole" buttons look identical

## Final commit: f25b566
## Status: Approved

## Test results
18/18 tests pass (GapsSection, DynamicTargetForm).
