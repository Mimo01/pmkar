# Quick Task 261109-f5i: Prefix copied summary with source key - Research

**Researched:** 2026-11-09
**Domain:** Frontend copy store (Zustand), no backend change
**Confidence:** HIGH (all findings verified by codebase grep)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Format: plain key + single space: source `PROJ-12` "Fix login" -> target summary `PROJ-12 Fix login`.
- Prefill in the Copy Preview: `copyStore.startPreview` seeds `targetSummary` as `${ticket.key} ${ticket.fields.summary}`.
- The user sees the prefix in the Summary field and can edit or remove it. No enforcement at submit time.
- Sub-tasks: parent only. Copied sub-tasks (copy_pipeline.rs sub-task creation) keep their original summaries unchanged.

### Claude's Discretion
- Avoid double prefix if the source summary already starts with the source key (e.g. `PROJ-12 ...` or `PROJ-12: ...`) — reasonable guard, planner decides exact rule.
- Applies to any copy entry point that uses `startPreview` (single and bulk if it goes through the same path).
- Update affected tests (copyStore.test.ts, CopyPreviewPage tests) that assert the prefilled summary.

### Deferred Ideas (OUT OF SCOPE)
None listed.
</user_constraints>

## Summary

There is exactly one seed point for the target summary: `src/features/tickets/copyStore.ts:95` (`targetSummary: ticket.fields.summary` inside `startPreview`). Every copy entry point funnels through it, and nothing else writes `targetSummary` except the input `onChange` (`setTargetSummary`) and `reset()`. Changing that one line (plus a small helper for the double-prefix guard) covers all paths. Only one test asserts the seeded value.

**Primary recommendation:** Add a pure helper `prefixSummaryWithKey(key, summary)` in copyStore.ts (exported for testing), use it at line 95, update `copyStore.test.ts:140-146`, add guard tests. No Rust changes.

## Entry Points (all verified to call `startPreview`)

| Caller | Location | Notes |
|--------|----------|-------|
| Ticket detail panel | `src/features/tickets/TicketDetailPanel.tsx:54` | single copy |
| Ticket detail page | `src/features/tickets/TicketDetailPage.tsx:56` | single copy |
| Triage "link" fallback | `src/features/tickets/triageActions.ts:261` | returns `'needs-copy'`; used by `useTriageDetailActions.ts` |
| Bulk / SelectionBar | `src/features/groups/SelectionBar.tsx` | **no copy action exists** — nothing to change |

UI: `CopyPreviewPage.tsx` (routed from `App.tsx:27`) and `CopyPreviewModal.tsx` (not imported outside tests — legacy) both only read `targetSummary` and write via `setTargetSummary` on input change. `summary` is excluded from overrideValues prefill (`PREFILL_EXCLUDED_TARGET_FIELDS`, Page:120 / Modal:109), so the D-PREFILL effect will not overwrite the prefixed value. Issue-type / project change does not reset `targetSummary` (verified: no other writers).

## Backend (no change needed)

- `confirmCopy` sends `overrideValues.summary = state.targetSummary` (copyStore.ts:272), placed last so it wins.
- `commands.rs:1755` merges `override_values` on top of mapped fields -> prefixed summary reaches Jira create.
- `commands.rs:1712` `source_summary` (read from the source issue) is only used for the remote-link title `"{source_key}: {source_summary}"` (`copy_pipeline.rs:52`) — leave it, otherwise the link title would show the key twice.
- Sub-tasks: `copy_pipeline.rs:507-514` use `st["fields"]["summary"]` directly — unchanged, matching the locked decision.

## Tests to Update

| File | Line | Change |
|------|------|--------|
| `src/features/tickets/__tests__/copyStore.test.ts` | 140-146 | expect `'PROJ-1 Summary for PROJ-1'` (fixture summary is `` `Summary for ${key}` ``, line 45) |
| same file | new | guard cases: `PROJ-1 Foo` -> unchanged; `PROJ-1: Foo` -> unchanged; `PROJ-10 Foo` with key `PROJ-1` -> prefixed; empty summary -> `PROJ-1` (trimmed) |

No change needed: `CopyPreviewPage.test.tsx` (147), `CopyPreviewModal.test.tsx` (121, 193, 280), `TicketDetailPage.test.tsx` (108) and the other copyStore tests all seed `targetSummary` directly with `setState`, so they bypass `startPreview`. Rust tests (`commands.rs:2762`) test mapping, not the prefix. Mock fixtures: no change (summary comes from the frontend override).

## Common Pitfalls

1. **Double prefix:** use a boundary-aware check, not a bare `startsWith(key)`. Otherwise `PROJ-1` matches `PROJ-12 ...` and the prefix gets skipped. Suggested rule: skip the prefix when `new RegExp('^' + escape(key) + '(?![0-9])')` matches the trimmed summary. This covers `PROJ-12 x` and `PROJ-12: x`; `[PROJ-12] x` is not covered, which is acceptable. Keys match `[A-Z][A-Z0-9_]*-\d+` and contain no regex metacharacters, but escaping is cheap insurance.
2. **255-char Jira summary limit** `[ASSUMED: Jira Cloud summary max 255 chars — training knowledge]`: the prefix adds `key.length + 1` chars. Neither input sets `maxLength`, and there is no truncation anywhere today. A source summary near 255 could make create_issue fail. Recommendation: do not truncate silently (the user can edit). Optionally `slice(0, 255)`. Planner decides; low practical risk.
3. **Empty/whitespace summary:** `${key} ` leaves a trailing space. Trim the result.
4. **Remote-link title:** do not "fix" `copy_pipeline.rs:52` to use the target summary; it already includes the key.

## Code Example

```typescript
// copyStore.ts
export function prefixSummaryWithKey(key: string, summary: string): string {
  const s = (summary ?? '').trim();
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^${esc}(?![0-9])`).test(s)) return s;
  return `${key} ${s}`.trim();
}
// in startPreview:
targetSummary: prefixSummaryWithKey(ticket.key, ticket.fields.summary),
```

## Validation

- Quick: `npx vitest run src/features/tickets/__tests__/copyStore.test.ts`
- Full: `npx vitest run src/features/tickets` (no Rust run needed — nothing changes in src-tauri)
- Manual (mock server): open Copy on a ticket -> Summary input shows `KEY Original summary`. Create -> target issue has the prefixed summary, sub-tasks are unprefixed, remote link title unchanged.

## Security
Not applicable — string prefill of a user-editable field. The existing Jira API JSON encoding handles the value.

## Assumptions Log
| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | Jira summary max 255 chars | Low — only affects very long summaries, user can edit |
