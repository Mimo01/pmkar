---
quick: 261109-f5i
verified: 2026-11-09
status: human_needed
score: 5/5 truths verified in code
---

# Quick 261109-f5i Verification

Goal: prefill the copy target summary with the source key (`PROJ-12 Fix login`), editable, parent only.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Prefill `KEY summary` | VERIFIED | `startPreview` sets `targetSummary: prefixSummaryWithKey(ticket.key, ticket.fields.summary)` in copyStore.ts. Test asserts `PROJ-1 Summary for PROJ-1`. |
| 2 | No double prefix (`PROJ-12 x`, `PROJ-12: x`) | VERIFIED | Anchored regex `^KEY(?![0-9])` with a regex-escaped key; covered by tests. |
| 3 | `PROJ-1` + `PROJ-10 Foo` is prefixed | VERIFIED | The negative lookahead for a digit handles it; test present. |
| 4 | Editable, no submit-time enforcement | VERIFIED | `confirmCopy` still uses `summary: state.targetSummary` (copyStore.ts line 280). It is unchanged by the commit. |
| 5 | Sub-tasks unchanged (no Rust change) | VERIFIED | Commit 3901b35 touches only copyStore.ts and its test (`git diff --stat` shows nothing under src-tauri). |

Additional checks:
- Trim, empty and null summaries yield just the key, and long summaries are not truncated. All have tests.
- `npx vitest run src/features/tickets` passed (44 files, 829 tests). `npx tsc --noEmit` reported no errors.
- I did not run biome.
- Every entry point goes through `startPreview`, so there is a single seed point.

## Human verification (planned `human-check`)
- On the mock server, open Copy on a ticket. The Summary input should show `KEY Original summary` and be editable. The created target should carry the prefixed summary, and its sub-tasks should be unprefixed.

## Gaps
None.
