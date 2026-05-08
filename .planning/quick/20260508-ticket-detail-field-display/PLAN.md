---
slug: ticket-detail-field-display
title: Enhance ticket detail property display
date: 2026-05-08
status: in-progress
---

# Enhance ticket detail property display

## Goal
Fix two display issues on the ticket detail Overview tab:
1. Unknown custom fields show title "customfield 10608" instead of something readable
2. Some field values render as raw JSON instead of human-readable text

## Root causes
1. `prettifyKey('customfield_10608')` → `"customfield 10608"` (ugly, lowercase, no indication it's an ID)
2. In `renderSourceFieldValue` default (`any`) handler, objects with `value` string property and arrays with `{value}` items fall through to JSON fallback because only `name` property is tried

## Tasks

- [ ] T1: Fix `prettifyKey` in `AllFieldsSection.tsx` — `customfield_NNNN` → `"Custom field NNNN"`
- [ ] T2: Extend array handler in `renderSourceFieldValue` default case — try `.value` after `.name`
- [ ] T3: Add object-with-value handler before JSON fallback in `renderSourceFieldValue`
- [ ] T4: Update tests in `AllFieldsSection.test.tsx` (Tests 1 and 4 assert old format)
- [ ] T5: Add tests in `sourceValueDisplay.test.tsx` for new value rendering paths
- [ ] T6: Commit

## Files
- `src/features/tickets/AllFieldsSection.tsx`
- `src/features/field-renderers/sourceValueDisplay.tsx`
- `src/features/tickets/__tests__/AllFieldsSection.test.tsx`
- `src/features/field-renderers/__tests__/sourceValueDisplay.test.tsx`
