---
quick_id: 260428-e3p
slug: redesign-standard-select-style
status: complete
date: 2026-04-28
commit: 760620e
---

# Quick Task 260428-e3p: Redesign Standard Select Style

## What was done

Replaced both native `<select>` elements in the copy preview flow with `VirtualizedCombobox` — the filterable combobox used throughout the rest of the app.

**Files changed:**
- `src/features/tickets/CopyPreviewModal.tsx` — added VirtualizedCombobox import, replaced `<select id="copy-target-project-modal">`
- `src/features/tickets/CopyPreviewPage.tsx` — added VirtualizedCombobox import, replaced `<select id="copy-target-project">`

## Result

Both target project dropdowns now:
- Show a search input for filtering by name or project key
- Match the visual style of all other dropdowns in the app (outline button trigger + popover with search)
- Wire identically to `useCopyStore.setTargetProjectKey` via `onChange={(p) => setTargetProjectKey(p.key)}`
- Display projects as `{name} ({key})` — same format as before
- Use existing i18n keys (`settings.project.select` for placeholder, `copy.targetProject` for aria label)

TypeScript: no errors introduced. No residual `<select>` elements remain in either file.
