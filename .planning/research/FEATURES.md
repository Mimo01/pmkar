# Feature Research: User-defined issue groups (v0.5.0)

**Domain:** Tag-like user groupings layered on a triage inbox, in a desktop Jira bridge
**Researched:** 2026-10-11
**Confidence:** MEDIUM (product patterns are from training knowledge; Pmkar dependencies come from PROJECT.md)

## How the reference products behave

- **Gmail labels.** A message can have many labels and stays in the inbox. Each label has a color from a palette. Labels appear in the sidebar and as chips on rows. Applying a label is a menu on a selection, with a search box, checkboxes and "create new". Removing is the same menu, or an x on the chip. Deleting a label never deletes mail. Pain points are label sprawl and an unwieldy sidebar.
- **GitHub labels.** Many labels per issue, with a name, color and description. Assigning uses a searchable multi-select popover in the sidebar. Bulk assign works on the list selection. Deleting a label detaches it. Pain points are huge flat lists and near-duplicate colors.
- **Linear.** Labels come in a small set and render as small dots or chips. Hotkey `L` opens a label picker. Multi-select plus a keyboard shortcut or right-click applies labels in bulk. The aesthetic is restrained.
- **Jira.** Labels are free text, which breeds typos and clutter. It is the cautionary example.
- **Things and Todoist.** Both have drag-to-reorder in the sidebar and a color or icon per item. Deleting a container asks for confirmation and states what happens to the items.

**Common shape:** a many-to-many tag model, an explicit picker (search, checkboxes, inline create), bulk apply on a selection, a color from a small palette, reorderable entries, and a non-destructive delete with a clear message.

## Table Stakes

| Feature | Complexity | Notes |
|---|---|---|
| Create group (＋ next to the tabs, name + color) | LOW | Auto-assign the next unused palette color. Validate empty and duplicate names (case-insensitive). |
| Rename group | LOW | Membership is keyed by a stable id, never by name. |
| Delete group ("issues are not deleted") | LOW | Confirm with member count. Detaches membership only. |
| Color per group from a small palette (about 8) | LOW | AA-checked tokens in light and dark mode. Never color-only: the chip always carries the name. |
| Drag-reorder of group tabs | MEDIUM | DnD library with a keyboard alternative; persisted order. |
| Many-to-many membership; issue still shows in its core tab | MEDIUM | `group` and `group_member(group_id, issue_key)` tables. Never touch triage state. |
| "Add to group" button in ticket detail | MEDIUM | Popover picker with search, checkboxes and inline create. Toggling adds or removes. |
| Bulk add from list multi-select | MEDIUM | Checkbox plus shift-click. A selection bar appears only when something is selected. |
| Remove from group (detail picker or chip x; bulk inside a group view) | LOW | The bar action reads "Remove from group". |
| Group chips on cards | LOW | Show at most 2, then "+N" with a tooltip. Never wrap. |
| Group view: flat list plus triage badge; card actions work | MEDIUM | Reuse the existing card. |
| Count on group tab | LOW | Decide whether missing members count. |
| Orphan handling | HIGH | See the orphan section below. |
| Local persistence | MEDIUM | SQLite, following the existing db-per-concern pattern. |
| EN and SK, plus CONI-01 | LOW | |
| Empty states | LOW | An empty group explains how to add issues. |
| Keyboard and a11y (tablist semantics, DnD alternative, focus return) | MEDIUM | WCAG AA is a project constraint. |

## Differentiators

| Feature | Complexity | Notes |
|---|---|---|
| "…" menu on group tab (Rename / Color / Delete) | LOW | Keeps the tab strip tidy. |
| Inline "Create 'xyz'" in picker | LOW | Strongly recommended; removes a flow. |
| Chip click jumps to group | LOW | |
| Keyboard shortcut to open picker | LOW | |
| Missing-member styling plus "Remove all missing" | LOW | |
| Undo toast after bulk or delete actions (sonner) | MEDIUM | |
| Tab overflow (scroll with fade edges, or a "More" menu) | MEDIUM | |

## Anti-Features

| Feature | Why Problematic | Alternative |
|---|---|---|
| Nested groups | Complicates tabs, reorder and semantics | Flat groups |
| Free-text tags | Typos and sprawl | Managed list with inline create |
| Auto-rules (JQL or status based) | Duplicates core triage; hidden membership | Manual membership |
| Exclusive (folder) membership | Contradicts the decided tag model | Tags plus a badge |
| Hover-revealed row icons | Against the user's explicit-actions preference | Detail button plus selection bar |
| Free color picker | Contrast failures and noise | Fixed palette |
| Icons or emoji per group | More UI for little gain | Color plus name |
| Silent orphan pruning | Violates "never silently lose an issue" | Hint plus one-click remove |
| Bulk copy from group | Explicitly out of scope | Copy per card |
| Sync or sharing of groups | Local-only by decision | Later export |

## Orphan handling (highest risk)

- Store the issue key plus a minimal cached snapshot (key, summary, last-known status, triage state at add time) so the card renders when the issue is absent from the fetch.
- Mark an issue missing only after a **fully successful** fetch. A partial-failure fetch (v0.4.8 per-user batches) must not mark issues missing.
- Wording: "no longer in results". Never claim the issue was deleted.
- Orphans keep membership and get a one-click remove. Actions that need full data are disabled. Detail may fetch by key and must handle a 404 or permission error gracefully.

## Feature Dependencies

```
Group CRUD + palette + persistence
  └─ stable group id
      ├─ Membership (group_id, issue_key, snapshot)
      │   ├─ Detail picker ── inline create
      │   ├─ Chips on cards
      │   ├─ Group view (flat + triage badge) ── Orphan handling (snapshot + successful-fetch flag)
      │   └─ Bulk add/remove ── requires list multi-select
      └─ Tab strip with divider + ＋ ── drag-reorder, overflow
Triage state (existing) ── read-only ── badge in group view
```

- Group view joins membership against the latest fetch in the store; misses are orphans.
- Dismissing inside a group view must update the badge live, so it needs a shared triage source.
- Zustand: never return `?? []` inside a selector; use a `null` fallback.
- The v0.3.0 change indicators (blue dots) should also show in the group view.

## Clutter mitigations

1. Tab strip: scrolling strip, name cap of about 24 characters with truncation and tooltip.
2. Cards: at most 2 chips plus "+N"; hide the current group's own chip inside its view.
3. Selection bar: fixed position, no layout shift.
4. Picker: one popover — search, checkboxes, create. No second modal.
5. Color is never the only signal.

## MVP (v0.5.0)

Group CRUD + color + persistence · tab strip with divider, ＋ and overflow · drag-reorder with keyboard alternative · many-to-many membership · detail picker with inline create · multi-select bulk add/remove · chips on cards · group view with triage badge · orphan hint plus remove, with partial-fetch guard · EN+SK · CONI-01.

**Later (v0.5.x):** undo toast, picker shortcut, chip navigation, "Remove all missing".
**Future:** group export (EXPRT-01), per-group notifications, auto-rules.

## Open questions

- Does list multi-select exist today?
- Should orphans count toward the tab count? (Recommend yes, with a separate missing indicator.)
- Does the card's triage state come from a single source shared between core tabs and the group view?
