---
status: complete
phase: 28-foundations
source: [28-01-SUMMARY.md, 28-02-SUMMARY.md, 28-03-SUMMARY.md, 28-04-SUMMARY.md, 28-05-SUMMARY.md, 28-06-SUMMARY.md]
started: 2026-10-12T00:00:00Z
updated: 2026-10-12T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Quit Pmkar completely, then start it from scratch (`npm run tauri dev`). The app boots without a crash or error toast, the ticket list loads live data, and `~/Library/Application Support/com.pmkar.app/groups.db` now exists next to audit.db / mapping.db.
result: pass

### 2. Copy result step labels (English)
expected: With the UI in English, copy a ticket that has a work log and goes through the origin-link step. On the result screen (modal or page), every step shows a readable label, e.g. "Source ticket loaded", "Core fields copied", "Origin link added", "Work log loaded", "Work log entry 1 copied". No raw ids like `add_remotelink`, `fetch_source`, `worklog:fetch` or `update_triage` appear. The created key reads "Created: KEY-123".
result: pass

### 3. Copy result step labels (Slovak)
expected: Switch the language to Slovak and repeat a copy (or reopen a result). All step lines and the "Created:" label are in Slovak, with no English fallbacks and no raw step ids.
result: pass

### 4. New tickets list filter & sort unchanged
expected: The New tickets list shows the same tickets as before. Sorting by each column (both directions) and the search/filter behave exactly as they did before this phase.
result: pass

### 5. Not mine (ignored) list filter & sort unchanged
expected: The Not mine list shows the same tickets as before. Sorting and filtering behave as they did before.
result: pass

### 6. Linked list filter & sort unchanged
expected: The Linked list shows the same tickets as before. Sorting and filtering behave as they did before.
result: pass

### 7. Switching source connection
expected: In Settings, change the source connection (or run the setup wizard again) and save. The save completes normally, with no error toast and no hang, and the ticket lists reload for the new source.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
