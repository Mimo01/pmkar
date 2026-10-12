---
phase: 28-foundations
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - src-tauri/Cargo.toml
  - src-tauri/src/groups_commands.rs
  - src-tauri/src/groups_db.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/main.rs
  - src/App.tsx
  - src/features/connections/SettingsPage.tsx
  - src/features/connections/SetupWizard.test.tsx
  - src/features/connections/SetupWizard.tsx
  - src/features/connections/__tests__/SettingsPage.test.tsx
  - src/features/groups/__tests__/colors.test.ts
  - src/features/groups/__tests__/groupStore.test.ts
  - src/features/groups/__tests__/validation.test.ts
  - src/features/groups/colors.ts
  - src/features/groups/groupStore.ts
  - src/features/groups/types.ts
  - src/features/groups/validation.ts
  - src/features/tickets/CopyResultModal.test.tsx
  - src/features/tickets/CopyResultModal.tsx
  - src/features/tickets/CopyResultPage.tsx
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/features/tickets/LinkedTicketsPage.tsx
  - src/features/tickets/TicketListPage.tsx
  - src/features/tickets/__tests__/CopyResultPage.test.tsx
  - src/features/tickets/__tests__/copyStepLabel.test.ts
  - src/features/tickets/__tests__/copyStepSync.test.ts
  - src/features/tickets/__tests__/ticketListParity.test.tsx
  - src/features/tickets/__tests__/ticketListUtils.test.ts
  - src/features/tickets/copyStepLabel.ts
  - src/features/tickets/ticketListUtils.ts
  - src/features/tickets/types.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
  - src/index.css
  - src/test-fixtures/group-vectors.json
findings:
  critical: 0
  warning: 4
  info: 11
  total: 15
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-10-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the phase diff (`2db2acf..HEAD`): the new Rust groups data layer and commands, the TS group store, validation and palette, the source-change re-hydration wiring in SettingsPage and SetupWizard, the extraction of the ticket-list filter/sort helpers, and the shared copy-step label resolver.

The Rust layer is solid. SQL is fully parameterised. Scope is derived only on the Rust side. The triage and groups locks are never held together. Bulk add validates every item before it writes, and the delete/remove paths garbage-collect orphaned snapshots inside a single transaction. The ticket-list refactor matches the old inline logic.

The Zustand rule holds. `selectGroupIdsForIssue` returns `null` (not `?? []`) as its fallback, and a test pins this. No consumer in scope allocates a fallback inside a selector.

No blockers. The main concerns are all in the frontend store and the TS/Rust validation mirror:
- `hydrate` has no request sequencing. Overlapping hydrations can commit stale or torn state.
- Any transient hydrate failure silently replaces the user's groups with an empty list.
- The TS mirror and Rust disagree on whitespace trimming.
- Neither layer rejects names made only of invisible characters.

## Warnings

### WR-01: `hydrate` has no request sequencing, so overlapping calls can commit stale or torn state

**File:** `src/features/groups/groupStore.ts:84-111` (callers: `:65`, `:75-82`, `src/App.tsx:81-87`)
**Issue:** `hydrate` is called from several places:
- after every successful mutation (`mutate`)
- from `rehydrateAfter` on a source change
- once at startup

Nothing orders these calls. Whichever `set(...)` runs last wins, by completion order rather than by the order the calls started. Two concrete failure modes:
1. **Scope switch.** If the startup hydrate or a mutation's hydrate is still in flight when the user saves a new server URL, the older response can resolve after the `rehydrateAfter` one. The new connection would then show the previous scope's groups.
2. **Torn snapshot.** `list_groups` and `list_group_memberships` are two separate IPC calls. A mutation can land between them, for example a delete, or an add from a second rapid click. One `set` then combines `groups` from before the mutation with `memberships` from after it. `memberCount` would disagree with `memberKeysByGroup`, and `groupIdsByIssue` could reference a group id that is missing from `groups`.

**Fix:** Add a generation counter and drop stale results. Ideally, also return both lists from one Rust command, read under a single groups lock.
```ts
let hydrateSeq = 0;
hydrate: async () => {
  const seq = ++hydrateSeq;
  try {
    const [rawGroups, rawMemberships] = await Promise.all([...]);
    if (seq !== hydrateSeq) return; // a newer hydrate superseded this one
    ...
    set({ groups, memberKeysByGroup, groupIdsByIssue, hydrated: true });
  } catch {
    if (seq !== hydrateSeq) return;
    ...
  }
}
```

### WR-02: A transient hydrate failure wipes all groups from the UI with no signal

**File:** `src/features/groups/groupStore.ts:108-110`, `:65`
**Issue:** On any error (an IPC failure, `Internal` from a poisoned lock, or a malformed payload), the `catch` block sets `groups: []`, empty indexes and `hydrated: true`. The UI can't tell "you have no groups" apart from "loading groups failed".

`mutate` makes this worse. After a *successful* `createGroup`, `addToGroup` and so on, it calls `hydrate()`. If that refresh fails, the user's groups disappear right after a write that succeeded, and the caller still gets `{ ok: true }`. Later phases that render group tabs from this state will make it look like data was lost.
**Fix:** Keep the last good state on failure and expose the error state, for example with a `hydrateError: boolean` field. Only reset to empty when the scope is actually gone, which Rust already signals by returning `[]` with no error.
```ts
} catch {
  set({ hydrated: true, hydrateError: true }); // keep previous groups/indexes
}
```

### WR-03: The TS validation mirror trims different characters than Rust, so the two can disagree on `empty`, `duplicate` and the stored display name

**File:** `src/features/groups/validation.ts:12` vs `src-tauri/src/groups_db.rs:125`
**Issue:** JS `String.prototype.trim()` strips U+FEFF (ZWNBSP/BOM) but not U+0085 (NEL). Rust `str::trim()` uses `White_Space`, so it does the reverse: it strips U+0085 and keeps U+FEFF. Examples:
- `"\uFEFF"` → TS returns `empty`, while Rust accepts it and stores an invisible name.
- `"\uFEFFTeam"` alongside an existing `"Team"` → TS reports `duplicate`, Rust accepts it because the keys differ.
- `"Team\u0085"` → TS accepts it as a different name from `"Team"`, Rust rejects it as `duplicate`.

The file header says it is "Verified against group-vectors.json", but the vectors only cover ASCII spaces, so this divergence goes untested.
**Fix:** Define one explicit trim set in both languages, for example strip `White_Space` plus U+FEFF on both sides. Add vectors for `"\uFEFF"`, `"\uFEFFa"` and `"a\u0085"` to `src/test-fixtures/group-vectors.json`.
```rust
pub fn normalize_group_name(raw: &str) -> String {
    raw.trim_matches(|c: char| c.is_whitespace() || c == '\u{FEFF}').nfc().collect()
}
```
```ts
return raw.replace(/^[\s\u0085\uFEFF]+|[\s\u0085\uFEFF]+$/gu, '').normalize('NFC');
```

### WR-04: Names made only of invisible characters pass validation, and zero-width characters bypass the duplicate check

**File:** `src-tauri/src/groups_db.rs:168-187`, `src/features/groups/validation.ts:39-51`
**Issue:** Neither layer rejects or strips format characters (Cf), such as U+200B ZERO WIDTH SPACE, U+200C/U+200D, U+2060 or U+00AD soft hyphen. Two effects:
- `"\u200B"` is accepted as a group name. The resulting tab label renders blank.
- `"Team\u200B"` is accepted next to `"Team"`, because their keys differ. The user then sees two visually identical tabs, which defeats the purpose of D-17's duplicate rule.

**Fix:** Strip `\p{Cf}` (and optionally `\p{Cc}`) when building the comparison key, and reject names whose visible content is empty. Mirror this in TS and add vectors.
```rust
let stripped: String = display.nfd()
    .filter(|c| !is_combining_mark(*c) && !matches!(*c, '\u{200B}'..='\u{200F}' | '\u{2060}'..='\u{2064}' | '\u{00AD}' | '\u{FEFF}'))
    .collect();
```
and in `validate_group_name`, return `Empty` if `key.is_empty()`.

## Info

### IN-01: A panic in `reserved_name_keys` runs while the groups mutex is held and would poison it for the rest of the session

**File:** `src-tauri/src/groups_db.rs:138-159` (reached via `groups_commands.rs:85`, `:95`)
**Issue:** `validate_group_name` runs inside `lock_groups(...)?.create_group(...)`. If a locale key is renamed, the `expect` or `panic!` fires lazily on the first create or rename, while the guard is held. Every later group command then returns `Internal`. The `reserved_keys` test does catch this today, so the risk is low.
**Fix:** Build the reserved keys at startup, before any lock is taken. Alternatively, degrade gracefully by skipping missing keys and logging, instead of panicking.

### IN-02: `map_write_error` reports every constraint violation as `Duplicate`

**File:** `src-tauri/src/groups_db.rs:404-412`
**Issue:** `NOT NULL`, `FOREIGN KEY` and `CHECK` failures all map to `ErrorCode::ConstraintViolation`, so they would surface as "name already exists". Today only the UNIQUE constraint can fire on these statements, but that is fragile.
**Fix:** Match on the extended code `SQLITE_CONSTRAINT_UNIQUE` (2067) via `f.extended_code`.

### IN-03: `normalize_scope` lower-cases the context path, and its fallback keeps userinfo and query text

**File:** `src-tauri/src/groups_db.rs:104-120`
**Issue:**
- `out.to_lowercase()` also lower-cases the path. Tomcat context paths are case-sensitive, although a collision is unlikely in practice.
- When `Url::parse` fails (for example a bare `jira.example.com` with no scheme), the fallback stores the whole lower-cased string. Any `user:pass@`, query or fragment is kept, and the doc comment promises these are dropped.
- `http://` and `https://` forms of the same host produce different scopes, so groups disappear if the user switches scheme.

**Fix:** Lower-case only the scheme and host. In the fallback, prepend `https://` and re-parse before falling back to the raw string. Document the scheme sensitivity in D-02, or normalise it away.

### IN-04: `add_members` does not check `ticket_json` against `issue_key`, and accepts lower-case keys

**File:** `src-tauri/src/groups_db.rs:280-294`, `:537-545`
**Issue:**
- The snapshot is only checked to be a JSON object. A `ticket_json` whose `"key"` differs from `issue_key` gets stored under the wrong key.
- `is_valid_issue_key` accepts `abc-1`, so `abc-1` and `ABC-1` can become two separate memberships and snapshots.
- There is no size bound on `ticket_json`.

**Fix:** Require `obj["key"] == issue_key`, uppercase or reject lower-case project keys, and cap the payload size.

### IN-05: The groups schema has no version marker

**File:** `src-tauri/src/groups_db.rs:210-238`, `:316-328`
**Issue:** The schema is created only with `CREATE TABLE IF NOT EXISTS`, and `PRAGMA user_version` is never set. Future phases (28 to 33 all touch groups) will have no reliable way to migrate existing `groups.db` files.
**Fix:** Set `PRAGMA user_version = 1` on creation, and branch migrations on it.

### IN-06: The `Group` value returned by `mutate` skips the color coercion that `hydrate` applies

**File:** `src/features/groups/groupStore.ts:61-66`, `:113-116`
**Issue:** `hydrate` coerces `color` with `isGroupColorToken`, but `createGroup`, `renameGroup` and `setGroupColor` return the raw IPC value, typed as `Group` with `color: GroupColorToken`. Rust validates colors on write, so this is defence in depth only. Still, the type promises something the code does not check.
**Fix:** Run the returned `Group` (or `Group[]` for `moveGroup`) through the same normaliser `hydrate` uses.

### IN-07: Dead `.catch` and a misleading comment in App.tsx

**File:** `src/App.tsx:79-87`
**Issue:**
- `hydrate()` never rejects, so `.catch(() => {})` is dead code.
- The comment says hydration waits for "persisted connection metas" because "Rust derives scope from them". Rust reads `connection_meta` from its own DB, not from the frontend store, so waiting on the frontend `hydrated` flag only delays the call.

**Fix:** Drop the `.catch` and correct the comment, or call `hydrate()` immediately on mount.

### IN-08: `copyStepLabel` has dead branches, and failed steps show their detail twice

**File:** `src/features/tickets/copyStepLabel.ts:19-20`, `:30-34`; `src/features/tickets/CopyResultPage.tsx:79-82`; `src/features/tickets/CopyResultModal.tsx:71-74`
**Issue:**
- Rust no longer emits `convert_description` or `upload_image*`. A grep of `copy_pipeline.rs` and `commands.rs` finds only `fetch_source`, `create_issue`, `add_remotelink`, `update_triage`, `worklog:fetch`, `attach:`, `comment:`, `worklog:` and `subtask:`.
- For failed `attach`, `comment`, `worklog` and `subtask` steps, the label already includes `{{detail}}`, and both views render `step.detail` again underneath. This was the existing behaviour, but it now lives in shared code.

**Fix:** Remove the dead cases (or comment them as legacy), and skip the secondary detail line when the label already contains it.

### IN-09: `copyStepSync.test.ts` only detects ids written in two exact Rust forms

**File:** `src/features/tickets/__tests__/copyStepSync.test.ts:18-24`
**Issue:** The regexes only match `step: "x".to_string()` and `step: format!("kind:{`. A new step written as `"x".into()`, `String::from("x")`, or passed through a helper would silently escape the sync guard.
**Fix:** Also match `step:\s*"([^"]+)"\.(?:into|to_owned)\(\)` and `String::from\("…"\)`, or have Rust export the step ids as constants that the test can read.

### IN-10: The "not eager" assertion in the re-hydration ordering tests is weak

**File:** `src/features/connections/SetupWizard.test.tsx:172-176`, `src/features/connections/__tests__/SettingsPage.test.tsx:691-695`, `:717-721`
**Issue:** The tests yield one microtask before asserting `not.toContain('list_groups')`. An incorrect implementation that hydrates after two or more microtask hops would still pass. The real ordering guarantee comes from the later `indexOf` comparison, and only in the positive tests. The cloud-edit test has no positive counterpart.
**Fix:** Flush with `await new Promise((r) => setTimeout(r, 0))`, or `vi.runAllTimersAsync()`, before the negative assertion.

### IN-11: Comparator robustness in `sortTickets`, and the `TicketListPage` memo is defeated (both pre-existing, now in shared code)

**File:** `src/features/tickets/ticketListUtils.ts:83-88`; `src/features/tickets/TicketListPage.tsx:382-390`
**Issue:**
- A non-numeric `priority.id` (`parseInt` → `NaN`) or an unparseable date makes the comparator return `NaN`, which gives inconsistent ordering. There is also no tie-breaker, so equal items keep whatever order the input had.
- In `TicketListPage`, `candidateTickets` is rebuilt on every render, so the `useMemo` that depends on it recomputes every time.

**Fix:** Coerce `NaN` to `0` (or to a sentinel), add `a.key.localeCompare(b.key)` as a final tie-breaker, and wrap `candidateTickets` in `useMemo([tickets, triageMap])`.

---

_Reviewed: 2026-10-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
