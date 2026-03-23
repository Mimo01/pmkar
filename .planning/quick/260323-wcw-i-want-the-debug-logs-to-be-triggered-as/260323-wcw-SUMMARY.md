---
phase: quick-260323-wcw
plan: "01"
subsystem: ui
tags: [appshell, header, audit-log, icon, ux]
dependency_graph:
  requires: []
  provides: [header-audit-icon]
  affects: [AppShell, audit-log-trigger]
tech_stack:
  added: []
  patterns: [inline-svg-icon, absolute-badge]
key_files:
  created: []
  modified:
    - src/components/ui/AppShell.tsx
decisions:
  - "Used TerminalIcon (>_ prompt symbol) to represent debug/audit log — matches Lucide stroke style"
  - "Badge uses absolute positioning on relative wrapper div — consistent with common badge patterns"
  - "App.tsx required no changes; onAuditClick was already wired at line 123"
metrics:
  duration: "~1 minute"
  completed: "2026-03-23"
  tasks_completed: 1
  files_modified: 1
---

# Phase quick-260323-wcw Plan 01: Debug Log Icon in Header Summary

**One-liner:** Moved audit log trigger from footer bar to header toolbar icon — TerminalIcon with count badge placed left of gear icon.

## What Was Built

The `AppShell` footer contained a full-width button showing "N API calls" that opened the audit log. This was replaced with a compact terminal icon button in the header toolbar, sitting to the left of the existing gear icon. A small count badge (absolute positioned, brand-coloured) appears on the icon when `auditCount > 0`.

## Changes

### src/components/ui/AppShell.tsx

- Added `TerminalIcon` SVG component — 15x15, stroke-based, shows a `>` chevron and `_` underline (terminal prompt motif)
- Replaced the `w-7 h-7 flex` gear icon wrapper with a `flex items-center gap-1` toolbar div containing both icons
- Audit icon renders conditionally when `onAuditClick` is provided; badge renders when `auditCount > 0`
- Removed the `{onAuditClick && (<button ...>{t('nav.apiCalls'...)}</button>)}` footer block entirely

### src/App.tsx

No changes required. `onAuditClick={() => setShowAuditLog(true)}` was already passed to `AppShell` at line 123.

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | Move audit log trigger from footer to header icon | 6cd3e5c |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `/Users/mimo/Desktop/pmkar/src/components/ui/AppShell.tsx` exists and contains `TerminalIcon` and badge logic
- Commit `6cd3e5c` present in git log
- Footer audit button removed
- TypeScript errors in modified files: none (pre-existing errors in unrelated files are out of scope)
