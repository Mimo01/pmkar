---
status: resolved
trigger: "copy-modal-broken: The copy modal window doesn't display correctly. It needs to be made full-page (like the issue detail view) and fixed up."
created: 2026-03-25T00:00:00Z
updated: 2026-04-26T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — CopyPreviewModal uses Dialog (560px wide overlay) while TicketDetailPage uses flex full-page layout. The fix is to convert CopyPreviewModal from a Dialog into a full-page view rendered at App level (like TicketDetailPage), driven by the copyStore phase.
test: n/a — root cause confirmed by reading both components
expecting: n/a
next_action: Implement fix — convert CopyPreviewModal to full-page layout rendered from App.tsx when phase is previewing/loading_preview/copying; convert CopyResultModal similarly

## Symptoms

expected: Copy modal should open as a full-page view (similar to the issue detail view) and display correctly
actual: Modal opens but displays incorrectly — layout/content is broken
errors: Unknown — need to investigate
reproduction: Open the copy modal in the app
started: Unknown

## Eliminated

## Evidence

- timestamp: 2026-03-25T00:05:00Z
  checked: CopyPreviewModal.tsx
  found: Uses Dialog component with max-w-[560px] max-h-[85vh] — a constrained overlay popup, not a full-page view
  implication: On a small Electron app window this is cramped; two-column layout inside a constrained dialog overflows/clips

- timestamp: 2026-03-25T00:05:00Z
  checked: TicketDetailPage.tsx
  found: Uses div.flex.flex-col.h-full — fills all available space in AppShell; rendered at App.tsx level as a full conditional page replace
  implication: This is the pattern we need to replicate for CopyPreviewModal

- timestamp: 2026-03-25T00:05:00Z
  checked: App.tsx
  found: showDetail state controls rendering TicketDetailPage as a full page; CopyPreviewModal is rendered inside TicketDetailPage and TicketDetailPanel as an overlay Dialog
  implication: Fix requires: (1) reading copyStore phase in App.tsx, (2) rendering CopyPreviewModal as a full page when phase !== idle/result, (3) CopyResultModal can stay as a Dialog since it's a small summary

## Resolution

root_cause: CopyPreviewModal used a Dialog component (constrained to max-w-[560px] max-h-[85vh]) as an overlay on top of other pages. The two-column source/target layout inside this constrained dialog was cramped and clipped on small Electron windows. The TicketDetailPage uses a full-page flex layout instead.

fix: Created CopyPreviewPage.tsx — a full-page component using the same flex/h-full layout pattern as TicketDetailPage. App.tsx now detects when copyPhase is loading_preview/previewing/copying and renders CopyPreviewPage as a full-page view inside AppShell instead of whatever page is currently showing. CopyPreviewModal (the Dialog-based version) is no longer rendered from TicketDetailPage or TicketDetailPanel. CopyResultModal remains as a Dialog since it is a small summary list that is appropriate as an overlay.

verification: TypeScript clean (no new errors), biome lint clean on all changed files
files_changed:
  - src/features/tickets/CopyPreviewPage.tsx (created)
  - src/App.tsx (import CopyPreviewPage + CopyResultModal + useCopyStore; render CopyPreviewPage as full page when copy is active)
  - src/features/tickets/TicketDetailPage.tsx (removed CopyPreviewModal import and usage)
  - src/features/tickets/TicketDetailPanel.tsx (removed CopyPreviewModal import and usage)
