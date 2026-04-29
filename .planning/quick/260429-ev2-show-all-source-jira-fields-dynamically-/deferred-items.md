# Deferred Items — 260429-ev2

## Pre-existing Test Failures (out of scope)

These tests in `src/features/tickets/CopyPreviewModal.test.tsx` were failing BEFORE this task
and are not caused by 260429-ev2 changes:

1. "renders editable target fields on right column (COPY-08)" — expects comboboxes/checkboxes that no longer exist in current CopyPreviewModal UI
2. "populates status dropdown from cloudMeta.availableStatuses (COPY-01)" — expects legacy inline status dropdown
3. "populates priority dropdown from cloudMeta.availablePriorities (COPY-01)" — expects legacy inline priority dropdown
4. "renders label checkboxes, all checked by default (COPY-01, D-09)" — expects legacy label checkbox UI
5. "shows 'No labels on source ticket' when ticket has no labels" — expects legacy label UI string

These tests need rewriting to match the current Phase 20/22 DynamicTargetForm architecture.
