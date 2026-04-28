---
quick_id: 260428-fmd
slug: dropdown-overflow-fix
date: 2026-04-28
status: complete
commit: abf7c99
---

# Quick Task 260428-fmd: Fix field mapping dropdown overflow and sizing in settings

## What was done

Fixed two related dropdown problems in the field mapping settings:

1. **Popup constrained to trigger width** — `VirtualizedCombobox` used `left-0 right-0` which forced the popup to exactly match the trigger button's width. Narrow columns (transformer at 20fr ≈ 144px) produced a squished popup that couldn't show full option text.

2. **Screen overflow for right-side columns** — The transformer column (column 3) sits at ~530px from the left edge. Allowing a popup to expand rightward from `left-0` would overflow the 760px-wide settings panel.

## Changes

### `VirtualizedCombobox.tsx`
- Added `align?: "start" | "end"` prop (default `"start"`) — controls which edge the popup anchors to
- Added `itemHeight?: number` prop (default `36`) — used for both virtualizer `estimateSize` and scroll element height calculation
- Changed popup CSS from `left-0 right-0` to `min-w-full w-max max-w-[360px]` + conditional `left-0` or `right-0` — popup now expands to content width (up to 360px) while always being at least as wide as the trigger
- Removed hardcoded `h-9` from `Command.Item` className (height is already controlled by inline style)

### `MappingRow.tsx`
- Transformer combobox: added `align="end"` (right-anchors popup, expands left, avoids screen overflow) and `itemHeight={52}` (two-line renderItem needs more vertical space)
- Added `py-0.5` padding to transformer renderItem div for better two-line item breathing room
