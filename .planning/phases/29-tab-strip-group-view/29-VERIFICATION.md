---
phase: 29-tab-strip-group-view
verified: 2026-10-12T14:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Create a group via the + control, then create 15+ groups with long names"
    expected: "New tab appears and is selected; strip scrolls horizontally with arrows, core tabs stay fixed, long names truncate with tooltip; the active or focused tab is not hidden under the scroll arrows (WR-07)"
    why_human: "Layout, overflow and scroll-into-view behaviour is not testable in jsdom"
  - test: "Open a group with members, then an empty group; triage (dismiss/restore) a card, then switch to core tabs"
    expected: "Badges read New / Dismissed / Already Linked / Done; empty state shown; triage change shows instantly in both views"
    why_human: "Visual and cross-view live behaviour"
---

# Phase 29: Tab Strip & Group View Verification Report

**Phase Goal:** Users can create groups and open each as a flat, filterable list alongside the unchanged core tabs
**Status:** human_needed (all automated checks pass; visual checks remain)
**Re-verification:** No, initial verification

## Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | Plus control, name, new tab; empty/whitespace disables Create; duplicate/reserved/too-long show inline message | VERIFIED | `CreateGroupPopover.tsx`: `validateGroupName` against existing names, `role="alert"` message from `errorKey()` (duplicate, reserved, tooLong); submit guarded by `!v.ok`; `createGroup` then `onCreated` switches tab. Tests pass. |
| 2 | Group tabs right of core tabs after divider, with color and count; horizontal scroll, core tabs fixed, truncation plus tooltip | VERIFIED (visual check pending) | `GroupTabStrip.tsx` renders divider, an `overflow-x-auto` scroller and arrows; `GroupTab.tsx` renders the color dot, `memberCount`, `max-w-[160px] truncate` and a Tooltip. Mounted via `navExtension` in `App.tsx:262`. |
| 3 | Group opens as flat list with New/Dismissed/Already Linked/Done badge; empty group explains how to add | VERIFIED | `groupBadge.ts` uses `nav.new`="New", `nav.notMine`="Dismissed", `nav.linked`="Already Linked", `groups.badge.done`="Done" (en.json); `GroupViewPage.tsx` renders the badge per card and the `groups.empty.*` state. Rendered at `App.tsx:275`. |
| 4 | Search, filter, sort, open detail, copy, dismiss/restore; triage immediate in both views | VERIFIED | `GroupViewPage` uses `TicketFilterBar`, `filterTickets`/`sortTickets`, `selectTicket` (detail/copy via shared App detail flow), and `restoreTicket` from shared `triageActions`. Badges derive from the shared `useTicketStore.triageMap`, so changes appear in both views. |

**Score:** 4/4

## Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|---|---|---|---|
| GRP-01 | 29-01, 03, 04, 06 | SATISFIED | Truth 1 |
| GVIEW-01 | 29-06 | SATISFIED | Truth 2 |
| GVIEW-02 | 29-06 | SATISFIED | Truth 2 (visual pending) |
| GVIEW-03 | 29-05, 06 | SATISFIED | Truth 3 |
| GVIEW-04 | 29-02, 05 | SATISFIED | Truth 4 |
| GVIEW-05 | 29-05, 06 | SATISFIED | Truth 3 |
| GVIEW-06 | 29-05 | SATISFIED | Truth 4 |

All 7 IDs are claimed by plans and mapped to Phase 29 in REQUIREMENTS.md. No orphans. Note: REQUIREMENTS.md still shows these as `[ ]`/Pending and should be ticked. GVIEW-03 wording ("Not mine / Linked") predates the roadmap labels; the roadmap wording (Dismissed / Already Linked) is what is implemented.

## Behavioral Spot-Checks

`npx vitest run src/features/groups src/__tests__/App.test.tsx`: 11 files, 154 tests pass. The full-suite and cargo baseline were reported by the orchestrator (only the 7 known vitest and 2 Rust failures, which predate this phase).

## Review Warnings vs Success Criteria

| ID | Breaks an SC? | Assessment |
|---|---|---|
| WR-01 | No (edge case) | `mutate` awaits `hydrate()`. The create path loses only if another hydrate starts mid-flight (for example the startup hydrate racing a very early create). The normal flow works. Fix recommended before release. |
| WR-02 | No (edge case) | Only when the post-create hydrate fails. Fix recommended. |
| WR-03 | No | Error handling on scope change; not an SC. |
| WR-04 | No | Cancel then reopen during an in-flight create; narrow. |
| WR-05 | No | Hardening gap for look-alike names. Duplicate and empty rejection still work for ordinary input. |
| WR-06 | No, but UX gap | Filter bar still shows `resultCount` 0, so SC4 holds. The list area is blank, with no no-results message. Recommended follow-up. |
| WR-07 | Possibly affects SC2 polish | The arrow overlay may cover the focused tab. Included in the human check. |
| WR-08 | No | Silent failure of restore persistence. |

## Anti-Patterns

No TBD/FIXME/XXX found in the reviewed list per the review report. No blocker stubs: all artifacts are substantive, wired and receive real store data.

## Gaps Summary

No blocking gaps. The goal is achieved in code. Two visual and interactive checks are routed to a human. Recommended follow-ups (non-blocking): WR-01/02 (the App fallback that overwrites `currentTab`), WR-06 (no-results state), WR-07 (scroll padding), and ticking the requirement checkboxes.

_Verified: 2026-10-12T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
