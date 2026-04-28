---
quick_id: 260428-fmd
slug: dropdown-overflow-fix
date: 2026-04-28
description: Fix field mapping dropdown overflow and sizing in settings
status: in_progress
---

# Quick Task 260428-fmd: Fix field mapping dropdown overflow and sizing in settings

## Tasks

### T1 — VirtualizedCombobox: add align + itemHeight props, fix popup sizing
**File:** src/features/field-renderers/components/VirtualizedCombobox.tsx
- Add `align?: "start" | "end"` prop (default "start")
- Add `itemHeight?: number` prop (default 36)
- Change popup div from `left-0 right-0` to content-sized with proper anchoring
- Update virtualizer estimateSize and scroll height calculation to use itemHeight

### T2 — MappingRow: pass align + itemHeight to transformer combobox
**File:** src/features/field-mapping/MappingRow.tsx
- Pass `align="end"` to transformer VirtualizedCombobox (column 3 is right-side)
- Pass `itemHeight={52}` to transformer VirtualizedCombobox (two-line renderItem)
