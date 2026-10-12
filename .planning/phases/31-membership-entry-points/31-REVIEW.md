---
phase: 31-membership-entry-points
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/App.tsx
  - src/features/groups/DetailGroupsRow.tsx
  - src/features/groups/detailToTicket.ts
  - src/features/groups/GroupChip.tsx
  - src/features/groups/GroupChips.tsx
  - src/features/groups/GroupPicker.tsx
  - src/features/groups/GroupTabStrip.tsx
  - src/features/groups/GroupViewPage.tsx
  - src/features/groups/membershipActions.ts
  - src/features/groups/NavigationContext.tsx
  - src/features/groups/SelectionBar.tsx
  - src/features/groups/useListSelection.ts
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/features/tickets/LinkedTicketsPage.tsx
  - src/features/tickets/TicketCard.tsx
  - src/features/tickets/TicketDetailPage.tsx
  - src/features/tickets/TicketFilterBar.tsx
  - src/features/tickets/TicketListPage.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-10-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the phase 31 diff (`ddf4a93..HEAD`): the group picker (checkbox and list modes), the selection hook and bar, card and detail chips, cross-tab navigation, and the TicketCard restructure into an overlay button.

Project conventions hold:
- Every Zustand selector returns a `null` fallback (`selectGroupIdsForIssue`), and `?? []` only appears in `useMemo` outside the selector.
- There is no drag and drop.
- Actions are explicit, labelled buttons.

Escape ordering works. Radix registers a capture-phase document listener that calls `preventDefault` before it dismisses, and both `TicketDetailPage` and `useListSelection.handleKeyDown` respect `defaultPrevented`.

I found no blockers. The main problems are:
- a regression that breaks the "Changed" tooltip on every card,
- an Escape key leak in the assignee autocomplete that wipes the selection,
- bulk actions that stay available while the New-tab list is hidden during a refresh,
- the select-mode overlay button not telling screen readers whether a ticket is selected.

## Warnings

### WR-01: "Changed" badge tooltip on ticket cards no longer opens (regression)

**File:** `src/features/tickets/TicketCard.tsx:62-70`
**Issue:** The card content now sits inside `<div className="pointer-events-none relative ...">` so clicks reach the full-card overlay button. Child elements inherit `pointer-events: none`, so the `TooltipTrigger` span for the unseen-changes badge (line 70) never gets `pointerenter`. It also isn't focusable, so keyboard users can't open it either. The tooltip listing the changed fields (`tickets.card.changeTooltip`) now opens no matter what the user does. Before this phase the badge was inside the `<button>` and hovering it opened the tooltip. The actionSlot wrapper (line 89) and the chips (line ~127) were opted back in with `pointer-events-auto relative z-10`, but the badge was missed.
**Fix:** Opt the trigger back in the same way:
```tsx
<TooltipTrigger asChild>
  <span className="pointer-events-auto relative z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ...">
```
Also add a test that hovers the badge and asserts the tooltip content appears.

### WR-02: Escape in the assignee autocomplete also exits select mode and wipes the selection

**File:** `src/features/tickets/TicketFilterBar.tsx:129-131`, `src/features/groups/useListSelection.ts:103-112`
**Issue:** Each list page puts `sel.handleKeyDown` on its wrapper `<div>`. That handler exits select mode unless `e.defaultPrevented` is set. When the assignee suggestion list is open, `handleAssigneeKeyDown` handles Escape by closing the suggestions but never calls `e.preventDefault()`. The event bubbles to the page wrapper, so a single Escape meant to close the dropdown also clears every selected ticket and turns off select mode. All four list pages (New, Not mine, Linked, group view) are affected.
**Fix:**
```ts
} else if (e.key === 'Escape') {
  e.preventDefault();
  setShowSuggestions(false);
  setSelectedIdx(-1);
}
```

### WR-03: New-tab selection bar stays usable while the card list is hidden during a refresh

**File:** `src/features/tickets/TicketListPage.tsx:509, 535, 554-562, 464`
**Issue:** While a fetch runs, the card list is hidden (`hasTickets && !isLoading`) and skeletons show instead. `<SelectionBar>` is rendered outside that condition, and `selectedTickets` comes from `sortedCandidates`, which still holds the previous results. So during a refresh the bar keeps showing "N selected", and "Add to group" adds tickets the user can no longer see. Pruning only happens after the new results arrive. Also, `selectDisabled` only checks `sortedCandidates.length`, so during a load the Select toggle stays enabled even though there are no cards to select. The other three pages render the bar inside the list container and don't have this problem.
**Fix:** Render the bar under the same condition as the list, and disable the toggle while loading:
```tsx
{hasTickets && !isLoading && (
  <SelectionBar ... />
)}
// and
selectDisabled={(sortedCandidates.length === 0 || isLoading) && !sel.selectMode}
```
Alternatively, call `sel.exit()` when a fetch starts.

### WR-04: In select mode the card overlay button toggles selection but doesn't expose selected/not-selected state

**File:** `src/features/tickets/TicketCard.tsx:50-60`
**Issue:** In select mode each card has two tab stops that do the same thing: the `role="checkbox"` button, and the full-card overlay `<button aria-label={summary}>`. The overlay toggles selection but has no `aria-pressed`/`aria-checked` and keeps its open-detail label. A screen-reader user who activates it hears the ticket summary, gets no feedback that the selection changed, and can't tell whether the ticket is selected.
**Fix:** In select mode, take the overlay out of the tab order and accessibility tree so the checkbox is the only keyboard and AT control. Mouse users can still click anywhere on the card:
```tsx
<button
  type="button"
  aria-label={ticket.fields.summary}
  tabIndex={selectMode ? -1 : undefined}
  aria-hidden={selectMode ? true : undefined}
  ...
/>
```

## Info

### IN-01: actionSlot wrapper creates dead click zones on cards

**File:** `src/features/tickets/TicketCard.tsx:87-93`
**Issue:** The wrapper `<span className="pointer-events-auto relative z-10" onClick={stopPropagation}>` covers non-interactive badges too: the group-view triage badge, the "Handled" badge, and the linked `copiedKey` badge. Clicking those badges now does nothing, where before it opened the detail view (or toggled selection in select mode). The `stopPropagation` isn't needed either, because the overlay is a sibling rather than an ancestor and the real controls (Restore) already stop propagation themselves.
**Fix:** Drop the wrapper's `pointer-events-auto`/`onClick`, and give only the interactive children (for example the Restore button) `pointer-events-auto relative z-10`.

### IN-02: "+N more" chip button has no click action, so hidden groups can't be reached from the card

**File:** `src/features/groups/GroupChips.tsx:28-49`
**Issue:** The overflow `<button>` only stops propagation. The groups beyond `MAX_VISIBLE` appear in a tooltip as plain `GroupChipLabel`s, which aren't buttons, so the user can't navigate to them from the card. The control looks like a button but does nothing when clicked. That conflicts with the project preference for explicit actions over hover-only information.
**Fix:** Turn it into a Popover that lists `CardGroupChip`s (navigable buttons), or make clicking it open the ticket detail, where `DetailGroupsRow` shows every chip.

### IN-03: Picker shows misleading empty/no-match messages for the excluded current group

**File:** `src/features/groups/GroupPicker.tsx:417-426, 137-149`
**Issue:** In list mode inside a group view, `candidates` leaves out the current group. Two cases are misleading:
- If that is the only group, the picker shows "No groups yet. Type a name to create one.", even though a group exists.
- If the user types that group's exact name, validation returns `duplicate` against all groups, so there is no Create row. `defaultActive` then falls back to 0, so the picker shows either "No groups match '…'" or highlights an unrelated substring match (for example "Bugfix" when typing "Bug"), and Enter adds the tickets to that group.

**Fix:** Branch on `excludeGroupId` to show a dedicated message (for example "No other groups"). When the duplicate is the excluded group, set `activeIdx` to -1 so Enter doesn't fall through to an unrelated group.

### IN-04: "Removed 0 issues" success toast when nothing was removed

**File:** `src/features/groups/membershipActions.ts:45`
**Issue:** `removeIssuesWithFeedback` always shows a success toast with `r.value`. If the members were already removed elsewhere (another window, or a concurrent hydrate), the user sees "Removed 0 issues from 'X'". The add path handles its zero case (`allAlreadyIn`), but remove doesn't.
**Fix:** If `r.value === 0`, show an info toast (for example `groups.toast.noneRemoved`) instead of the success toast.

### IN-05: `focusRequest.seq` is effectively dead, and `afterUnmount` is duplicated three times

**File:** `src/App.tsx:159-170`; `src/features/groups/useListSelection.ts:22-25`, `src/features/groups/DetailGroupsRow.tsx:18-21`, `src/features/groups/GroupTabStrip.tsx:247-250`
**Issue:** `handleFocusRequestHandled` resets `focusRequest` to `null` straight after it is consumed, so `(p?.seq ?? 0) + 1` is always 1. The new object identity is what triggers the effect, not `seq`. Separately, the same `afterUnmount` rAF helper is copy-pasted in three files.
**Fix:** Drop `seq`, or document that only object identity matters. Move `afterUnmount` into a shared util (for example `src/lib/focus.ts`).

### IN-06: Slovak announcement wording is inconsistent with the other keys

**File:** `src/i18n/locales/sk.json:551`
**Issue:** `groups.picker.announceRemoved` is "Odstránené zo ‘{{name}}’", while every other Slovak string uses "zo skupiny ‘{{name}}’". "zo" directly before an arbitrary name reads as ungrammatical. `announceAdded` has the same gap ("Pridané do ‘{{name}}’").
**Fix:** Use "Odstránené zo skupiny ‘{{name}}’" and "Pridané do skupiny ‘{{name}}’".

---

_Reviewed: 2026-10-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
