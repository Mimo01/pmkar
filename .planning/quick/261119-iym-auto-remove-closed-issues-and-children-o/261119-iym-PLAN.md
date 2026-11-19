---
phase: quick-261119-iym
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/utils.ts
  - src/features/tickets/__tests__/doneStatus.test.ts
  - src/features/groups/missingMembers.ts            # git mv -> src/features/groups/autoPrune.ts
  - src/features/groups/autoPrune.ts
  - src/features/groups/__tests__/missingMembers.test.tsx   # git mv -> __tests__/autoPrune.test.tsx
  - src/features/groups/__tests__/autoPrune.test.tsx
  - src/App.tsx
autonomous: true
requirements: [QUICK-261119-iym]

must_haves:
  truths:
    - "After a complete, eligible fetch, a group member whose live ticket is done (closed/resolved) is silently removed from every group that holds it (e.g. 'Zamietnute')"
    - "After a complete, eligible fetch, a group member whose direct parent is done is silently removed from every group, whether the parent's done state comes from the parent's own live ticket or from the child's fields.parent.status"
    - "Members missing from the live tickets are still removed exactly as before (261109-e83 behavior unchanged)"
    - "Open members with an open parent (or no parent) are never removed"
    - "No pruning happens when the fetch is partial, loading, signature-mismatched, or groups are unhydrated (same gating as before); no extra Jira requests are made"
  artifacts:
    - path: "src/features/tickets/utils.ts"
      provides: "isDoneStatus(status) shared by isDoneTicket"
      contains: "export function isDoneStatus"
    - path: "src/features/groups/autoPrune.ts"
      provides: "computePrunableKeys, readPrunableKeysNow, pruneGroupMembers, useAutoPruneGroupMembers"
      exports: ["EMPTY_PRUNABLE", "computePrunableKeys", "readPrunableKeysNow", "pruneGroupMembers", "useAutoPruneGroupMembers"]
    - path: "src/features/groups/__tests__/autoPrune.test.tsx"
      provides: "Tests for missing, done, done-parent (both sources) and keep-open cases plus all prior gating tests"
  key_links:
    - from: "src/App.tsx"
      to: "src/features/groups/autoPrune.ts"
      via: "useAutoPruneGroupMembers() mounted once"
      pattern: "useAutoPruneGroupMembers\\(\\)"
    - from: "src/features/groups/autoPrune.ts"
      to: "src/features/tickets/utils.ts"
      via: "isDoneStatus for ticket and parent status"
      pattern: "isDoneStatus"
---

<objective>
Closed tickets stay in custom groups because the auto-prune from quick 261109-e83 only removes members that are missing from the live tickets, and Jira still returns closed tickets. Extend the same silent auto-prune so a group member is also removed when its live ticket is done, or when its direct parent is done. This applies to all groups.

Purpose: groups hold only work that is still open. The user report: closed PBIs stay in "Zamietnute", and subtasks of a closed PBI should disappear too.
Output: a generalized prune predicate in a renamed module (`autoPrune.ts`), a shared `isDoneStatus` helper, and updated tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.planning/quick/261109-e83-manually-grouped-tickets-disappear-when-/261109-e83-SUMMARY.md
@src/features/groups/missingMembers.ts
@src/features/groups/__tests__/missingMembers.test.tsx
@src/features/tickets/utils.ts

<interfaces>
From src/features/tickets/types.ts:
- `interface JiraStatus { name: string; id?: string; statusCategory?: { key: string } }`
- `interface JiraRelatedIssue { key: string; fields?: { summary?: string; status?: JiraStatus; priority?: JiraPriority } }`
- `JiraTicket.fields.status: JiraStatus` (required by the type, but test fixtures use `fields: {}`), `JiraTicket.fields.parent?: JiraRelatedIssue`

From src/features/tickets/utils.ts:
- `isDoneTicket(ticket: JiraTicket): boolean`: statusCategory.key === 'done' if a category is present, otherwise the name contains 'done' | 'resolved' | 'closed'.

From src/features/groups/missingMembers.ts (current, to be generalized):
- `EMPTY_MISSING`, `computeMissingKeys(memberKeys, liveKeys: ReadonlySet<string>, eligible)`, `readMissingKeysNow(groupId)`, `pruneMissingMembers()`, `useAutoRemoveMissingMembers()`
- Consumers: only `src/App.tsx` (line ~23 import, ~102 call) and `__tests__/missingMembers.test.tsx`.

Data availability (verified, no Rust change needed):
- `src-tauri/src/jira_client.rs` `LIST_SEARCH_FIELDS` already includes `parent`. Jira search returns `parent.fields.status` (with statusCategory) on both Server v2 and Cloud; mock fixtures (fixtures.rs ~1120) already carry `parent.fields.status`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared isDoneStatus helper</name>
  <files>src/features/tickets/utils.ts, src/features/tickets/__tests__/doneStatus.test.ts</files>
  <behavior>
    - isDoneStatus(undefined) and isDoneStatus(null) return false
    - isDoneStatus({ name: 'Whatever', statusCategory: { key: 'done' } }) returns true; statusCategory 'indeterminate' with name 'Closed' returns false (the category wins)
    - With no statusCategory: the names 'Closed', 'Resolved', 'Done' return true (case-insensitive) and 'In Progress' returns false
    - isDoneTicket keeps its current results for the same inputs
  </behavior>
  <action>In utils.ts, add `export function isDoneStatus(status: JiraStatus | null | undefined): boolean`. Move the current isDoneTicket body into it: the statusCategory check first, then the name fallback. Return false when status is missing or has no string name. Change isDoneTicket to `return isDoneStatus(ticket.fields?.status)` so a malformed ticket returns false instead of throwing. Keep the JSDoc and move the explanation of the category vs name fallback onto isDoneStatus. Import the JiraStatus type. Write the test file first (RED), then implement (GREEN).</action>
  <verify>
    <automated>npx vitest run src/features/tickets/__tests__/doneStatus.test.ts src/features/tickets/__tests__/ticketListUtils.test.ts</automated>
  </verify>
  <done>isDoneStatus is exported and tested. isDoneTicket delegates to it. Existing ticketListUtils tests still pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Generalize auto-prune to remove done members and children of done parents</name>
  <files>src/features/groups/missingMembers.ts -> src/features/groups/autoPrune.ts, src/features/groups/__tests__/missingMembers.test.tsx -> src/features/groups/__tests__/autoPrune.test.tsx, src/App.tsx</files>
  <behavior>
    - Missing key: removed (existing behavior, keep all existing tests and rename them)
    - Live member with a done status: removed
    - Live member whose parent key is a live ticket with a done status: removed, even when the child's own fields.parent.status says open (the live parent ticket wins because it is the authoritative fetched record)
    - Live member whose parent is not in the live tickets but whose fields.parent.status is done-category: removed
    - Live open member with an open parent, or with no parent: kept, and the result is EMPTY_PRUNABLE when nothing qualifies
    - Not eligible / null keys: EMPTY_PRUNABLE (unchanged)
    - pruneGroupMembers with group 1 = ['A','B','C'], where B is done and C's parent is done: one remove_issues_from_group call with issueKeys ['B','C'] (keys in member order)
    - Every existing gating test (no signature, loading, mismatch, partial fetch, unhydrated, mid-prune fetch, re-entrancy, failure swallowing, hook integration) still passes under the new names
  </behavior>
  <action>First run `git mv src/features/groups/missingMembers.ts src/features/groups/autoPrune.ts` and `git mv src/features/groups/__tests__/missingMembers.test.tsx src/features/groups/__tests__/autoPrune.test.tsx`. Rename the symbols so they describe what is pruned: EMPTY_MISSING -> EMPTY_PRUNABLE, computeMissingKeys -> computePrunableKeys, readMissingKeysNow -> readPrunableKeysNow, pruneMissingMembers -> pruneGroupMembers, useAutoRemoveMissingMembers -> useAutoPruneGroupMembers. Update the import and call in src/App.tsx. No other consumers exist; confirm with a grep for the old names over src.

Change the signature of computePrunableKeys to `(memberKeys: readonly string[] | null, liveByKey: ReadonlyMap<string, JiraTicket>, eligible: boolean): ReadonlySet<string>`. Inside the loop, a key is prunable if any of these holds: (a) it is not in liveByKey; (b) isDoneStatus(ticket.fields?.status); (c) the ticket has a parent key P, and either the live map has P and isDoneStatus(liveParent.fields?.status) is true, or the live map lacks P and isDoneStatus(ticket.fields.parent.fields?.status) is true. Check only the direct parent; the user asked for "zavrety Parent", and no recursion is needed. Use optional chaining throughout, because test and snapshot tickets can have sparse fields.

Build the map in readPrunableKeysNow as `new Map(tickets.map(t => [t.key, t]))`. Keep every part of the prune loop as it is: the in-flight flag with a single rerun, the hydrated requirement, re-reading readPrunableKeysNow(id) after each await, and failures logged with console.warn only (change the message to 'auto-prune group members failed'). Make no new Jira or invoke calls. Update the module and function doc comments to say that missing, done, and done-parent members are pruned.

Tests: the tk helper currently produces `fields: {}`. Keep it open by default, and add tkDone(key) (status { name: 'Closed', statusCategory: { key: 'done' } }) and tkChild(key, parentKey, parentStatus?). Add the behavior cases above as both computePrunableKeys unit tests and one pruneGroupMembers integration test. Write the new failing cases before the implementation change.

Scope note: groupBadgeKey's 'groups.badge.done' pill in GroupViewPage stays. It is still reachable while pruning is gated off (partial or loading fetch) and for snapshot-only members, so it is not dead UI. Do not touch it. GroupViewPage has no separate Done filter pill. Do not remove or modify `readHintsEligibleNow`.</action>
  <verify>
    <automated>npx vitest run src/features/groups src/features/tickets && npx tsc --noEmit && npx biome check src/features/groups src/features/tickets src/App.tsx && ! grep -rnE "computeMissingKeys|readMissingKeysNow|pruneMissingMembers|useAutoRemoveMissingMembers|EMPTY_MISSING" src</automated>
  </verify>
  <done>Done members and members with a done parent are silently removed from all groups after an eligible fetch. Missing-member removal and all gating are unchanged. The old symbol names are gone from src. App.tsx mounts useAutoPruneGroupMembers. The full pre-commit hook (vitest, tsc, biome) passes without --no-verify.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira response -> frontend store | Ticket and parent status come from the Jira search and drive destructive membership removal |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-iym-01 | Tampering / data loss | computePrunableKeys | mitigate | Removal runs only under the existing readHintsEligibleNow gating (complete, matching-signature, non-loading fetch), and eligibility is re-checked after each await, so a partial or stale fetch never prunes |
| T-iym-02 | Denial of service | pruneGroupMembers | mitigate | Keep the in-flight flag with a single rerun; failures only warn and never loop or retry |
| T-iym-03 | Tampering | malformed snapshot or sparse ticket fields | mitigate | isDoneStatus is null-safe and uses optional chaining, so a missing status means "not done" (kept), never a crash |
</threat_model>

<verification>
- `npx vitest run` (full suite, which is also what the pre-commit hook runs) passes
- `npx tsc --noEmit` and `npx biome check .` are clean
- No Rust changes: `git diff --stat` shows no src-tauri files
</verification>

<success_criteria>
- Closed PBIs disappear from "Zamietnute" and every other group after the next complete fetch
- Subtasks of a closed parent disappear from every group
- Open tickets with open parents remain; missing-member pruning is unchanged
- No new Jira requests and no new UI
</success_criteria>

<output>
Create `.planning/quick/261119-iym-auto-remove-closed-issues-and-children-o/261119-iym-SUMMARY.md` when done
</output>
