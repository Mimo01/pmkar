# Pitfalls Research

**Domain:** Adding user-defined issue groups (tag-like many-to-many, colored/reorderable tabs, multi-select) to an existing Tauri/React/rusqlite Jira triage app (Pmkar v0.5.0)
**Researched:** 2026-10-11
**Confidence:** MEDIUM. Codebase observations (triage_db.rs, snapshot_db.rs, PROJECT.md, memory notes) are HIGH. UX/a11y guidance (WAI-ARIA tabs, dnd keyboard patterns, WCAG contrast) is from established standards and training knowledge, not re-verified this session. No drag-and-drop library is currently in the repo (grep of package.json/src found none), so the DnD choice is open.

## Critical Pitfalls

### Pitfall 1: Issue identity is a bare `ticket_key`, with no connection or project scope

**What goes wrong:**
Group membership is stored as `(group_id, issue_key)` and looked up by key alone. If the user changes the source connection, project or Jira instance (`app_config.source_project_key`, `connection_meta`), `ABC-12` from the old source collides with `ABC-12` in the new one. Groups then show the wrong issue, or an "orphan" that looks like a live issue.

**Why it happens:**
The existing `triage_state` table is `ticket_key TEXT PRIMARY KEY` with no scope, so copying that shape feels consistent. Triage already has this latent flaw. Groups would inherit it and make it more visible, because groups are long-lived curated data.

**How to avoid:**
- Decide identity explicitly in the first phase. Recommended: store a `source_scope` column (source base-URL hash or a connection id, plus the project key if projects can change) next to `issue_key`. Primary key is `(group_id, scope, issue_key)`.
- Do not change `triage_state` in this milestone, but record the divergence as a known issue. Do not let the group join logic assume triage and group keys share a scope.
- Filter group membership by the current scope at read time. Keep other-scope rows in the DB rather than deleting them, so switching back restores them.
- Test case: switch source project A to B to A, then check that groups are intact and nothing cross-contaminates.

**Warning signs:**
A group tab shows issues whose summary is unrelated to what the user added. Membership count differs from the visible count after a settings change.

**Phase to address:**
Phase 1 (data model and persistence). It is costly to retrofit after users have data.

---

### Pitfall 2: Storing only keys, then losing the issue when it drops out of the fetch (or storing full snapshots and showing stale data)

**What goes wrong:**
There are two opposite failures.
- Keys only: when a grouped issue is missing from the latest fetch (resolved, reassigned, or the watch list changed, or a partial-failure batch from the v0.4.8 per-user fetch), the group card has nothing to render. The issue vanishes, which violates "never silently lose an issue".
- Full snapshots: the card shows stale status or summary with no indication, and it duplicates `snapshot_store`.

A related trap is treating "absent from this fetch" as "gone". The per-user batched fetch can fail partially (v0.4.8 Phase 26), so a failed batch makes grouped issues look "no longer in results" when they are not.

**Why it happens:**
The group view is derived by joining membership with the in-memory fetched list. Absent rows silently drop out of the join. Developers reach for an inner join instead of a left join from membership.

**How to avoid:**
- Drive the group view from membership (left join to fetched issues), never from the fetched list.
- Persist a minimal "last known" stub per membership: key, summary, last known status and `last_seen_at`. Render stubs with a clear "no longer in results" label, and the one-click remove always works.
- Show "no longer in results" only after a complete successful fetch. After a partial-failure fetch, show a neutral "not refreshed" state, or suppress the label. The stub must carry `lastKnown` styling, not look live.
- Do not allow normal card actions (copy, triage) on stubs, or have them re-fetch the issue by key first. Copy from stale data is a fidelity risk.
- Refresh stubs opportunistically from `snapshot_store` when a snapshot exists, instead of duplicating data.
- Never auto-remove membership on a fetch miss, and never clean up orphans in the background.

**Warning signs:**
Group count badge differs from rendered card count. An issue that was in the group yesterday is invisible today. "No longer in results" appears for every issue right after a failed batch.

**Phase to address:**
Phase 2 (group view and missing-issue handling). The stub schema must be decided in Phase 1.

---

### Pitfall 3: SQLite migration done the ad hoc way breaks existing DBs

**What goes wrong:**
The repo's migration style is `CREATE TABLE IF NOT EXISTS` plus `let _ = conn.execute_batch("ALTER ...")` (swallows all errors) plus sqlite_master string sniffing. If group tables are added to `triage.db` carelessly, a failed migration is silently ignored and the first group write fails at runtime on real users' DBs. Dev DBs (fresh) pass tests. Putting group tables in the wrong DB also creates cross-domain coupling.

**Why it happens:**
Tests use `open_in_memory()`, which always creates the latest schema. Upgrade-from-v0.4.8 paths are never exercised.

**How to avoid:**
- Follow the db-per-concern decision: create a new `groups.db` (or a clearly separate module), not columns in `triage_state`. This also avoids the table-rebuild migration `MIGRATE_TRIAGE_CHECK_HANDLED`, which runs `DROP TABLE triage_state` and is risky to touch.
- Create tables with `IF NOT EXISTS` only, additive, with no changes to existing tables. Do not use `let _ =` on new migrations. Propagate errors, or use the `ignore_duplicate_column` helper if an ALTER is unavoidable.
- Enable `PRAGMA foreign_keys = ON` per connection (rusqlite does not enable it by default) if using `ON DELETE CASCADE` on membership. Without it, deleting a group leaves orphan membership rows. Test this explicitly.
- Add an upgrade test that opens a file DB created with the v0.4.8 schema, then opens it with the new code, and asserts old data is intact.
- Consider `PRAGMA user_version` for the new DB so later migrations are ordered. Do not retrofit it into the other DBs now.

**Warning signs:**
Tests pass but a real upgraded install shows "no such table/column". Deleting a group does not shrink membership rows.

**Phase to address:**
Phase 1 (persistence).

---

### Pitfall 4: Zustand selector instability and store sprawl (known project pitfall)

**What goes wrong:**
Selectors such as `useGroupStore(s => s.membership[groupId] ?? [])` or `s => s.groups.filter(...)` / `.map(...)` return a new reference every call. React 19 plus Zustand then loops on re-render ("Maximum update depth exceeded"). The project memory records this exact failure (never return `?? []` in a selector).

Related: a per-card `isInGroup(issueKey)` selector that scans all groups makes every card re-render on any membership change.

**Why it happens:**
Group data is naturally list-shaped, so derived lists get created inside selectors.

**How to avoid:**
- Selector returns `null` / module-level `const EMPTY: readonly string[] = []` fallbacks, handled in the component. Prefer the `null` fallback per project convention.
- Derive lists with `useMemo` from stable slices, or use `useShallow` for object/array selections.
- Store membership as `Record<groupId, Set|string[]>` plus a reverse index `Record<issueKey, groupId[]>` maintained in the same reducer, so a card selects only its own entry.
- Add a lint-like test: render a component with an empty group and assert no re-render loop (render count is bounded).

**Warning signs:**
UI freezes when opening an empty group. Console shows "getSnapshot should be cached" or max update depth errors. Card re-render counts spike on selection.

**Phase to address:**
Phase 1 (store design) and verified in every UI phase.

---

### Pitfall 5: Multi-select state leaks across tabs, refetches and group changes

**What goes wrong:**
Selection stored as a flat `selectedKeys` in a shared store survives tab switches, so a bulk "Add to group" applies to hidden items from another tab. Selection also keeps keys that disappeared after a refetch, so the action counts items the user can no longer see. Pressing F5 (manual poll) or the auto-poll resets or retains selection unpredictably. Deleting a group while it is the active tab leaves the active tab pointing at nothing.

**Why it happens:**
Selection is treated as global state instead of view state scoped to a list.

**How to avoid:**
- Key the selection by view: `selection = { viewId, keys }`. Clear on tab change, on group delete, and on source scope change. Intersect with currently visible keys before any bulk action.
- Show the count from the intersected set, and the action target is exactly what is visible.
- Active tab id must be validated against existing groups; fall back to the "New" tab when the group is deleted or renamed away.
- Handle the card-click versus checkbox-click conflict: the checkbox must stop propagation so it does not open the detail panel. Decide whether selection mode is explicit (a toggle) or implicit (checkboxes always visible, which adds card clutter).
- Support Shift-click range select only if a stable ordering exists; otherwise skip it for v0.5.0.
- Do not let existing triage bulk actions (if any) act on the group's selection unintentionally.

**Warning signs:**
"Added 14 issues" toast when 3 were visible. Bulk bar remains after switching tabs.

**Phase to address:**
Phase 3 (multi-select and entry points).

---

### Pitfall 6: Draggable tabs are inaccessible, break overflow scrolling, or fight the tablist

**What goes wrong:**
- Pointer-only drag reorder fails WCAG 2.1.1 (keyboard) and the project's WCAG AA goal.
- Wrapping a roving-tabindex `role="tablist"` in a sortable library that attaches its own `tabindex`, `role="button"` and `aria-roledescription` produces conflicting semantics. Arrow keys either navigate tabs or reorder, not both.
- Overflow scroll: the active tab is not scrolled into view after creation, keyboard focus or selection. The fixed core tabs plus a divider scroll away with the groups, or the divider is read as a tab by screen readers.
- Drag inside a horizontally scrolling container misbehaves: auto-scroll fights, the drop indicator is clipped by `overflow`, and the drag overlay is clipped.
- Rename or delete controls inside the tab (nested interactive elements inside `role="tab"`) are invalid ARIA.

**Why it happens:**
Drag libraries are added last and tested only with a mouse.

**How to avoid:**
- Core tabs New / Not mine / Linked are not sortable and stay pinned (or at least sticky) outside the scroll region. The divider is `role="separator"` (`aria-orientation="vertical"`), not a tab.
- Provide a keyboard reorder path that is not drag: for example, Alt+Left/Right (or Ctrl+Shift+arrows) on a focused tab, with a live-region announcement ("Moved Billing to position 3 of 5"), plus "Move left/right" in a tab context menu or a Manage Groups dialog. A Manage Groups list with up/down buttons is the simplest accessible fallback and doubles as the home for rename/recolor/delete.
- Use a library with a built-in keyboard sensor and announcements (dnd-kit is the usual React choice, with `KeyboardSensor` and `sortableKeyboardCoordinates`; verify its current React 19 compatibility before adopting, since this was not checked this session). Require a drag activation distance (about 5 px) so a click still selects the tab.
- Keep the tablist keyboard model standard: Left/Right moves focus, Home/End, `aria-selected`, `aria-controls` linked to a panel. Keep rename/delete out of the tab element (use a context menu, a separate button, or the manage dialog).
- Call `scrollIntoView({ inline: "nearest" })` on the active tab. Provide overflow affordance (edge fade or chevrons) and test with 20+ groups and long names (truncate with a tooltip and `title` or `aria-label`).
- Add a reduced-motion check for drag animations.

**Warning signs:**
Cannot reorder with the keyboard. Axe flags nested-interactive or `aria-required-children`. The newly created group tab is off-screen. Screen reader announces the divider as "tab".

**Phase to address:**
Phase 2 (tab bar) for structure and overflow; Phase 4 (reorder and manage groups) for drag and keyboard reorder. Run an a11y check at the end of both.

---

### Pitfall 7: Color contrast fails in one theme, and color is the only signal

**What goes wrong:**
A user-chosen color that works as a dot on light fails as text or a border on dark (or vice versa). Colored text or fill with white or black text drops below 4.5:1 (text) or 3:1 (non-text UI, WCAG 1.4.11). Groups distinguished only by color fail 1.4.1. The selected tab state is shown only by color.

**Why it happens:**
Free-form color pickers, or a palette tuned in one theme only. The project already has a dark mode contrast bar of 4.5:1+.

**How to avoid:**
- Offer a fixed palette (8 to 10 hues), not a free picker. Store a palette token name (`"blue"`), not hex, so each theme maps it to its own tuned value via CSS variables.
- Use color as an accent only (dot or small bar on the tab), and keep the label text in the standard foreground token. Group identity is always the name plus color, never color alone.
- Verify each palette entry in both themes against the actual tab background, the selected and hover states, and the card chip background: at least 3:1 for the dot or indicator, 4.5:1 for any colored text. Add an automated contrast test over the token table.
- Keep the triage badges distinct from group colors (do not reuse the semantic status colors such as red/green/amber for groups, or users will read a group as a status).
- Default a new group to the next unused palette color.

**Warning signs:**
Axe color-contrast violations in one theme only. Two groups that look identical in grayscale.

**Phase to address:**
Phase 1 defines the token palette; Phase 2 verifies it on tabs; Phase 5 verifies it in chips/badges.

---

### Pitfall 8: Group names: duplicates, empties, whitespace, and rename races

**What goes wrong:**
Two groups named "Billing", or "billing" and "Billing ", confuse users and break any name-based lookup. Empty or whitespace-only names produce a blank tab (inaccessible, no accessible name). Very long names break the tab bar. Rename that validates only in the UI lets the backend persist duplicates. Using the name as an identifier means a rename orphans membership.

**How to avoid:**
- Group `id` is a generated stable ID (UUID or integer). The name is a mutable attribute only.
- Validate on both sides: trim, collapse whitespace, 1 to ~40 chars, unique case-insensitively using NFC-normalized comparison (`UNIQUE` index on `lower(name)` is not Unicode-aware in SQLite for Slovak diacritics, so do the comparison in Rust or store a normalized `name_key`). Return a typed error that the UI maps to an i18n message.
- Reserved names: reject collisions with the core tab labels (New / Not mine / Linked, in both EN and SK).
- Inline validation message uses `aria-describedby` and `aria-invalid`.
- Enforce a soft cap (for example 50 groups) to bound the tab bar and keep the fetch cheap.

**Warning signs:**
Duplicate names in the DB. Blank tab after a rename with spaces. Rename causes membership to disappear.

**Phase to address:**
Phase 1 (backend validation and IDs) and Phase 4 (rename UI).

---

### Pitfall 9: Deleting a group destroys curation without a safety net

**What goes wrong:**
One-click delete removes a group and all memberships. Users lose curated work. A native `window.confirm` is inconsistent with the app and not styled/i18n'd. A confirmation that does not say how many issues are affected is ignored by habit.

**How to avoid:**
- Use the existing shadcn `AlertDialog` (focus trapped, default focus on Cancel, Escape cancels) with copy such as: Delete "Billing"? Its 12 issues stay in their New / Not mine / Linked tabs; only the group is removed. Count shown, EN and SK, with plural forms (Slovak has three plural categories in i18next: `_one`, `_few`, `_other`; verify the project's i18next version generates them).
- State clearly that deleting a group never deletes or changes issues in Jira or triage state.
- For small cost, consider soft delete with an Undo toast (sonner is already a dependency). Undo restores the group and memberships. Hard-delete after the toast times out or on app close. Keep this optional; confirmation alone satisfies the requirement.
- After delete, move focus to a sensible element (the previous tab or the first core tab) and announce via a live region.
- Do not cascade into `triage_state`.

**Warning signs:**
Focus lost to `<body>` after delete. Support request "I lost my group".

**Phase to address:**
Phase 4 (manage groups).

---

### Pitfall 10: Group membership and triage state conflated, or coupled in the data model

**What goes wrong:**
Adding a "group" value to the triage state enum (the `CHECK(state IN (...))` constraint would require another table rebuild), or hiding grouped issues from the core tabs, or moving an issue out of New when it is added to a group. The requirement says membership is independent and the issue still appears in its core tab. Also, the group-tab triage badge reads state from a different path than the core tabs and drifts (copied but badge says new).

**How to avoid:**
- Membership is a separate table. Never touch `triage_state` or its CHECK.
- A single selector/function `getTriageState(key)` is used by both core tabs and group cards (shared TicketCard badge component), so they cannot disagree.
- Ignored ("Not mine") and copied/handled ("Linked") issues in a group must still show correctly and remain removable. Check "mark as not mine" while grouped: it stays in the group with a badge (do not auto-remove).
- Define and test the semantics of the Linked tab: an issue that is copied and in a group appears in both tabs.
- Core-tab counters must not include or exclude group membership.

**Warning signs:**
Counts on core tabs change when adding to a group. Badge differs between tab and group view for the same issue.

**Phase to address:**
Phase 1 (model) and Phase 2 (group view reuses shared badge).

---

### Pitfall 11: Clutter on TicketCard and list density regression

**What goes wrong:**
Adding group chips, a checkbox, a "add to group" hover icon, a triage badge and the existing blue dot / change indicators to each card overloads it. Hover-only icons conflict with the user's stated preference for explicit labelled buttons and one entry point per action (memory feedback). Multiple entry points (detail button, bulk bar, context menu) multiply the places where the action must be kept consistent.

**How to avoid:**
- Cards show at most N (about 2) tiny color dots with a "+n" overflow, with full names in the tooltip and `aria-label`; full membership shown in the detail panel as removable chips.
- The triage badge appears on group-tab cards only (core tabs already convey state by tab). Make the badge a prop (`showTriageBadge`).
- No hover-revealed row icons for group actions. Primary entry: a labelled "Groups" button/popover (checkbox list with search, create-new inline) in the detail panel. Secondary: bulk bar in multi-select. Third (optional) entry such as context menu only if it reuses the exact same popover component.
- Checkboxes appear only in selection mode (or on focus-within) to keep the default card clean.
- Virtualized lists, if used, need constant card height, so avoid variable-height chip rows.

**Warning signs:**
Card height grows when memberships are added. Design review: three different ways to do the same thing with different wording.

**Phase to address:**
Phase 2 (card design) and Phase 3 (entry points). Review at milestone end per the user's preferred workflow.

---

### Pitfall 12: Group membership operations are not atomic and the UI goes out of sync with the DB

**What goes wrong:**
Bulk add to a group runs N sequential Tauri invokes, and a failure halfway leaves partial membership. Optimistic UI updates are not rolled back on error. Adding an issue that is already a member throws a UNIQUE constraint error instead of being idempotent. Concurrent poll refresh overwrites the in-memory membership store with a stale read.

**How to avoid:**
- One Tauri command per bulk operation (`add_issues_to_group(group_id, scope, keys[])`) running in a single transaction with `INSERT OR IGNORE`. Same for remove.
- Return the authoritative resulting membership (or a delta) and update the store from it. Roll back optimistic changes on error with a toast.
- Membership lives in its own store, loaded independently of ticket fetch/poll; poll results must never replace membership.
- Rust side: the DB handle is behind a Mutex like other DBs; don't hold the lock across awaits.
- Limit batch size sanity (hundreds fine; SQLite handles it).

**Warning signs:**
UNIQUE constraint errors in logs. UI shows member, DB does not, after restart.

**Phase to address:**
Phase 1 (commands) and Phase 3 (bulk UI).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Key membership by `issue_key` only (copying `triage_state`) | Matches existing shape, simplest queries | Cross-source collisions, no clean path to fix later | Never; add a scope column now |
| Store group names/colors in a JSON blob in `app_config` | No new table | No integrity, no atomic membership, awkward reorder | Never for membership; tolerable only for nothing |
| Store tab order as an array in a JSON column | Easy reorder | Concurrent edits and partial writes | Acceptable if written atomically in one transaction; otherwise use a `position` int column (renumber in a transaction) |
| `position` gaps vs dense renumber | Fewer writes | Drift, duplicates after delete | Use dense renumber in one transaction on reorder/delete |
| Skip keyboard reorder, ship mouse drag only | Faster | Fails WCAG AA, which is a stated product constraint | Never; ship the Manage Groups up/down fallback at minimum |
| `let _ = conn.execute_batch(ALTER...)` for new migrations | Matches existing code | Silent migration failure | Never for new code |
| Persist full issue JSON per membership | Group view always renders | Staleness and duplication of `snapshot_store` | Only a minimal stub (key, summary, last status, last_seen) |
| Hex colors stored per group | Free-form picker | Contrast failures per theme | Never; store palette token |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Fetch pipeline (per-user batched, partial failure) | Treat a missing issue as "gone" after a partial failure | Mark "no longer in results" only after a fully successful fetch; otherwise "not refreshed" |
| Poll engine / snapshot_db | Poll results replace the whole store, wiping membership-derived state; group stubs duplicate snapshots | Membership in an independent store; read stubs, optionally enrich from snapshots |
| triage_db | Extending the `state` CHECK or adding columns to `triage_state` | Separate membership table; leave triage untouched |
| Copy flow (CopyResultModal, copy_ticket_v2) | Allowing copy from a stale stub | Disable or re-fetch by key first; badge updates via the same triage state source after copy |
| Detail panel | Opened for an issue not in the current fetch (stub) and fails to load or renders blank | Fetch detail by key on demand; show error state with remove-from-group still available |
| Settings change of source project/connection | Groups carry over silently | Scope column plus filter; communicate when groups are for a different source |
| i18next EN+SK | Interpolated counts with only `_one/_other`; hardcoded step labels (the CONI-01 symptom) | Add `_few` for Slovak; add keys in both locales in the same change; CONI-01 fix uses a keyed map of step to label with a fallback, plus a test that every step enum value has a key |
| Tauri window state | Selection/active tab persisted across restarts pointing at deleted groups | Validate persisted active tab on boot; fall back to "New" |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-card selector scanning all groups | Whole list re-renders on any membership change | Reverse index `issueKey -> groupIds`, per-key selector | Around 500+ cards with 20+ groups |
| N invokes for bulk add | UI hangs, partial state | Single batched transactional command | Selections above about 20 |
| Recomputing group lists in render | Jank when polling | `useMemo` on stable slices; precompute Sets | Large result sets (1k+ issues) |
| Tab bar re-measuring on every render | Scroll jumps | Measure on resize/groups-change only | 30+ groups |
| Counting membership per tab with a query per tab | Slow startup | One grouped query, `GROUP BY group_id` | 50 groups |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging group names/issue keys with full detail to the audit log | Group names may contain customer info; audit is a PII-sensitive area | Group ops are local only; do not send through the HTTP audit client; if logged, follow hash-based redaction default |
| Trusting frontend-supplied scope or base URL in group commands | Repeats the v0.4.8 CR-01 class of bug | Backend derives scope from stored config/keychain, not the invoke payload |
| Rendering group names unsanitized as HTML | Injection via any future import | Render as text only (React default); never `dangerouslySetInnerHTML` |
| Putting group data in a file outside the app data dir | Leakage | Same app data dir and permissions as other DBs |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| First-run empty state: no groups, no hint | Feature undiscoverable | Empty-state hint plus a "+" tab/button after the divider with an accessible name |
| Creating a group requires leaving context | Friction | Inline "Create group" in the add-to-group popover |
| Empty group tab shows blank list | Looks broken | Empty state explaining how to add issues |
| Adding to a group gives no feedback | Uncertainty | Toast with count and Undo; announce via live region |
| "No longer in results" is vague | Users do not know why | Tooltip: not in the latest fetch (resolved, reassigned, or outside your watch list); one-click Remove, labelled |
| Group tab badge counts include missing issues without distinction | Confusing numbers | Count total, show missing as separate hint in the tab body |
| Colour dot chosen at random with no preview | Unhelpful | Palette swatches with names (`aria-label`), selected check mark |
| Tab names in two locales | N/A (user-entered) | Do not translate user names; only translate chrome |
| Hover-only actions (contradicts stored preference) | Hidden functionality | Labelled buttons in the detail panel |

## "Looks Done But Isn't" Checklist

- [ ] **Persistence:** Upgrade test from a v0.4.8 DB file passes; groups survive an app restart; `PRAGMA foreign_keys` verified so delete cascades.
- [ ] **Identity:** Switching source project and back does not mix or lose memberships.
- [ ] **Missing issues:** Grouped issue absent from fetch appears with "no longer in results" and removable; a partial-failure fetch does not mislabel; nothing is silently dropped.
- [ ] **Selectors:** No `?? []` / fresh array in any Zustand selector; empty-group render test shows no loop.
- [ ] **Selection:** Cleared on tab change, group delete, source change; bulk count equals visible selection.
- [ ] **Keyboard:** Tabs navigable by arrows/Home/End; reorder possible by keyboard; Manage Groups fallback; focus after create/rename/delete is deterministic; live-region announcements.
- [ ] **ARIA:** Axe clean: divider is a separator, no nested interactive in `role="tab"`, tabpanel labelled by tab.
- [ ] **Overflow:** 25 groups with long names; active tab scrolled into view; core tabs not lost; drop indicator not clipped.
- [ ] **Contrast:** Every palette token checked in light and dark at tab, selected, hover, and card chip; not color-only.
- [ ] **Names:** Duplicate (case/diacritic-insensitive), empty, whitespace, over-length, core-tab names rejected on the backend with localized messages.
- [ ] **Delete:** Confirmation with count, safe default focus, focus restoration, issues untouched.
- [ ] **Triage independence:** Core tab counts unchanged by grouping; badge identical in core and group views; ignored/copied issues behave in groups.
- [ ] **Card clutter:** Card height unchanged with 0 versus 5 memberships; no hover-only controls.
- [ ] **i18n:** All new strings in EN and SK including plurals (`_few`); CONI-01 step labels map every step; test fails if a key is missing.
- [ ] **Bulk ops:** Single transactional command; idempotent; rollback on failure.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missing scope column shipped | HIGH | Add column with migration defaulting existing rows to the current scope at upgrade time; risky if the user already switched sources |
| Migration swallowed an error | MEDIUM | Add a repair step on open that checks `PRAGMA table_info` and re-applies; ship as patch release |
| Orphan membership rows (no FK) | LOW | One-time cleanup `DELETE ... WHERE group_id NOT IN (SELECT id FROM groups)` at open |
| Selector loop released | LOW | Hotfix with `null` fallback or `useShallow`; add regression test |
| Duplicate names already persisted | MEDIUM | Migration to suffix duplicates ("Billing (2)"), add normalized unique index |
| Inaccessible drag shipped | MEDIUM | Add Manage Groups dialog with up/down buttons (independent of tab bar) |
| User lost a group by delete | MEDIUM | Undo toast only helps in-session; otherwise no recovery, so prevent with confirmation |

## Pitfall-to-Phase Mapping

Suggested phase shape for v0.5.0 (names indicative):
1. Data model, persistence and store (groups.db, commands, palette tokens, scope, stubs)
2. Tab bar and group view (overflow, divider, badge, missing-issue stubs)
3. Membership entry points (detail button/popover, list multi-select, bulk bar)
4. Manage groups (create/rename/delete/reorder incl. keyboard, confirmation)
5. Polish, a11y/contrast audit, i18n incl. CONI-01

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Issue identity/scope | Phase 1 | Test: source A to B to A keeps and isolates memberships |
| 2 Lost/stale grouped issues | Phase 1 (schema), Phase 2 (UI) | Test: absent issue renders stub; partial-failure fetch shows no false "gone" |
| 3 Migration | Phase 1 | Upgrade test from v0.4.8 file DB; FK cascade test |
| 4 Selector stability | Phase 1, every UI phase | Empty-group render test with bounded renders |
| 5 Selection leakage | Phase 3 | Tests: tab switch, refetch, delete clear/intersect selection |
| 6 Tab a11y/overflow/DnD | Phase 2 and 4 | Axe, keyboard-only walkthrough, 25-group overflow test |
| 7 Contrast/color-only | Phase 1 (tokens), 2, 5 | Automated token contrast test in both themes |
| 8 Names | Phase 1, 4 | Rust unit tests for dup/empty/diacritics/core names |
| 9 Delete safety | Phase 4 | AlertDialog test with count, focus restoration |
| 10 Triage independence | Phase 1, 2 | Test: core counts unchanged; shared badge source |
| 11 Card clutter | Phase 2, 3 | Visual review at milestone end; no hover-only controls |
| 12 Atomic bulk ops | Phase 1, 3 | Transactional command test; idempotent add |
| CONI-01 i18n | Phase 5 (or any small independent phase) | Test: every copy step has EN and SK key |

Research flags: Phase 4 (DnD library choice, React 19 compatibility, keyboard reorder pattern) and Phase 1 (identity/scope decision) warrant deeper phase-level research. Phases 2, 3, 5 follow standard patterns already used in the codebase.

## Sources

- Codebase inspection (HIGH): `/Users/mimo/Documents/Projects/pmkar/src-tauri/src/triage_db.rs` (ticket_key-only PK, CHECK rebuild migration, `let _ =` ALTERs, `ignore_duplicate_column`), `snapshot_db.rs` (additive ALTER migrations), `field_mapping_db.rs` (PRAGMA table_info guard pattern, db-per-concern), `.planning/PROJECT.md` (key decisions, v0.4.8 CR-01, partial-failure fetch).
- Project memory (HIGH): Zustand selector `?? []` loop; prefer explicit labelled buttons over hover icons.
- WAI-ARIA Authoring Practices, Tabs pattern (MEDIUM, training knowledge, not re-fetched).
- WCAG 2.1: 1.4.1 Use of Color, 1.4.3 Contrast, 1.4.11 Non-text Contrast, 2.1.1 Keyboard (MEDIUM, standard).
- dnd-kit keyboard sensor/announcements (LOW to MEDIUM; React 19 compatibility unverified, check at Phase 4).
- SQLite: foreign keys off by default per connection; LOWER() is ASCII-only without ICU (MEDIUM, established behavior).

---
*Pitfalls research for: custom groups / tagging in a desktop Jira triage app (Pmkar v0.5.0)*
*Researched: 2026-10-11*
