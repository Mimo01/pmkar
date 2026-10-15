---
phase: quick-261015-lwy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/triageActions.ts
  - src/features/tickets/__tests__/triageActions.test.ts
  - src/features/tickets/TicketListPage.tsx
  - src/features/tickets/TicketDetailPage.tsx
  - src/features/tickets/TicketDetailPanel.tsx
  - src/features/groups/GroupViewPage.tsx
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/lib/focusRing.ts
  - src/features/tickets/copyStore.ts
  - src/features/tickets/__tests__/copyStore.test.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
  - src/i18n/__tests__/a11yLocale.test.ts
  - src/i18n/__tests__/detailLocale.test.ts
  - .planning/phases/37-consistency-accessibility-and-uat/37-HUMAN-UAT.md
autonomous: true
requirements: [TECH-DEBT-v0.5.1]

must_haves:
  truths:
    - "Clicking Undo on a deny toast after the ticket was restored, handled or relinked does nothing (it does not overwrite the newer state)"
    - "Restore and Mark handled dismiss the open deny-KEY Undo toast"
    - "Two overlapping triage actions on one key never leave the UI showing a state the DB never held"
    - "Link without a server connection shows a not-connected error and returns 'failed'; a startPreview rejection is caught and returns 'failed'"
    - "A ticket with state 'copied' but no copiedKey shows the Copy button on the detail page and panel"
    - "SK Dismiss and Deny buttons have different labels"
    - "The deny toast, the failure toasts and the screen-reader announcement all name the same tab (nav.notMine: Dismissed / Zamietnuté)"
    - "Selecting a ticket in the list marks it seen through triageActions.markSeen, not a direct invoke"
    - "A copy refused with 'already linked to KEY' shows a localized message telling the user to use Link, not the raw backend string"
  artifacts:
    - path: "src/features/tickets/triageActions.ts"
      provides: "per-key serialized applyState, guarded undoDeny, markSeen helper, UNDO_TOAST_MS"
      exports: ["denyTicket", "restoreTicket", "markHandled", "linkTicket", "markSeen", "UNDO_TOAST_MS"]
    - path: "src/lib/focusRing.ts"
      provides: "shared FOCUS_RING class string"
      exports: ["FOCUS_RING"]
  key_links:
    - from: "src/features/tickets/TicketListPage.tsx"
      to: "triageActions.markSeen"
      via: "handleSelectTicket"
      pattern: "markSeen\\(key\\)"
    - from: "src/features/tickets/copyStore.ts"
      to: "copy.alreadyLinked i18n key"
      via: "confirmCopy catch branch"
      pattern: "already linked to"
---

<objective>
Close the code-level tech debt in the v0.5.1 milestone audit (`.planning/v0.5.1-MILESTONE-AUDIT.md` `tech_debt`). The work covers triage-action robustness (35 WR-01/02/03, 37 IN-02, cross-phase W-1), detail-view correctness and styling (36 WR-02, 37 WR-03, 37 IN-01, plus the one-line fixes 36 WR-03 and WR-05 in files this plan already touches), and wording plus copy-refusal UX (36 WR-01, 37 WR-02, cross-phase W-2).

Purpose: every triage write goes through one module and cannot clobber newer state. The UI wording is consistent in EN and SK.
Output: code and test changes only. No Rust changes.

Verified against the current code at planning time:
- 37 WR-01 (announcer remount) is already fixed in 250881a. Skip it.
- 37 WR-03's re-entry concern is already handled: `useTriageDetailActions.handleLink` guards with `linkingRef` (a ref). Only the hover-styling part remains.
- 37 WR-02: the reviewer suggested "Ignored", but the visible tab is `nav.notMine` ("Dismissed" / "Zamietnuté"). `nav.ignored` is not used outside the locale files, and `a11yLocale.test.ts` already asserts that `a11y.denied` contains `nav.notMine`. The fix is therefore the reverse of the suggestion: change the `triage.*` toast strings to the `nav.notMine` label.
- W-2: no frontend code parses "already linked" today. The error reaches `CopyResultPage` raw through `confirmCopy`'s `String(err)`.

OUT OF SCOPE (do not touch): W-3 (keep TicketDetailPanel), W-4, 36 WR-04, 36 IN-01..03, 35 IN-01, Nyquist VALIDATION, WebView2 UAT, REQUIREMENTS.md, any Rust change.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/v0.5.1-MILESTONE-AUDIT.md
@.planning/phases/35-shared-triage-actions/35-REVIEW.md
@.planning/phases/36-detail-and-group-ui/36-REVIEW.md
@.planning/phases/37-consistency-accessibility-and-uat/37-REVIEW.md
@src/features/tickets/triageActions.ts

<interfaces>
Current triageActions.ts (140 lines): private notifyError(text), writeEntry(key, entry) using hydrateTriageMap, applyState(key, state, failKey) returning {ok, prev} (optimistic write is synchronous, then awaits invoke('set_triage_state', {ticketKey, state}), and rolls back to prev only if the store entry is still the identical optimistic object), undoDeny(key) (invoke('relink_ticket') then writeEntry copied), and exported denyTicket / restoreTicket / markHandled (Promise of boolean) and linkTicket(key, detail?) returning Promise of LinkResult = 'relinked' | 'needs-copy' | 'failed'. The deny toast uses id `deny-${issueKey}`, duration 8000, and action label i18n 'triage.undo'.

ticketStore: markSeen(key) changes the entry only when its current state is 'new' (it also updates newCount). hydrateTriageMap(map) replaces the map.

TicketListPage.tsx:447-453 handleSelectTicket(key): store.selectTicket(key); store.markSeen(key); invoke('set_triage_state', {ticketKey: key, state: 'seen'}).catch(() => {}).

useTriageDetailActions returns triageEntry, isLinked (state==='copied' && !!copiedKey), isDenied (state==='ignored'), rememberedKey, linking, the refs, and the handlers.

Backend refusal text (src-tauri/src/commands.rs:1097, a stable contract): "Ticket {source_key} is already linked to {existing}. Use Link to restore it instead of copying again."
copyStore.confirmCopy catch (around line 281): sets result.steps = [{ step: 'create_issue', success: false, detail: String(err) }]. CopyResultPage.tsx:81 renders step.detail.

Button default variant (src/components/ui/button.tsx:12): 'bg-primary text-primary-foreground hover:bg-primary/90'. Tailwind v4.

The test file triageActions.test.ts mocks invoke via invokeMock and sonner via toastFn/toastError/toastDismiss, and seeds state with `seed(state, copiedKey)` / `entry()`. Its flush() uses setTimeout 0.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Harden triageActions (WR-01, WR-02, WR-03, IN-02) and route list markSeen through it (W-1)</name>
  <files>src/features/tickets/triageActions.ts, src/features/tickets/__tests__/triageActions.test.ts, src/features/tickets/TicketListPage.tsx, src/i18n/locales/en.json, src/i18n/locales/sk.json</files>
  <behavior>
    - Undo after restore: seed copied CLOUD-1, deny, restoreTicket, then click the Undo action. relink_ticket is NOT invoked and the entry stays 'seen'.
    - restoreTicket success and markHandled success each call toast.dismiss('deny-T-1'). Failure does not.
    - Overlap, first fails then second fails: seed seen. Start denyTicket with set_triage_state rejecting and restoreTicket also rejecting, without awaiting in between. After both settle, the entry equals the original {state:'seen'} entry and not the first optimistic one.
    - Overlap, first fails then second succeeds: the final entry is the second action's state.
    - set_triage_state calls for one key run sequentially: the second invoke starts only after the first settles.
    - The existing synchronous-optimistic assertions (restoreTicket('T-1') then an immediate expect) still pass.
    - linkTicket with serverConnection null and no remembered key: returns 'failed', calls toast.error with the EN 'triage.notConnected' text, and never calls fetch_ticket_detail or startPreview.
    - linkTicket when startPreview rejects: returns 'failed', notifies 'triage.linkFailed', and produces no unhandled rejection.
    - markSeen('T-1') with entry 'new': the store becomes 'seen' and set_triage_state is invoked with seen. With entry 'ignored' or 'copied': no invoke and no change. With no entry: set_triage_state is invoked, which keeps the current list behavior.
  </behavior>
  <action>
Write the behavior tests first in triageActions.test.ts. Then change triageActions.ts as follows.

(a) Per D-05 robustness (35 WR-02), serialize per key. Add a module-level Map from key to { base: TriageEntry | undefined; tail: Promise of void; count: number }.
- On applyState, compute `prev` (the store entry now, still used for carrying copiedKey and for the deny toast decision). If no record exists, create one with base = prev.
- Write the optimistic entry synchronously, exactly as now.
- Chain the invoke onto record.tail so invokes for the same key run in order.
- On success, set record.base = optimistic.
- On failure, roll back to record.base (the last persisted entry, not prev) only if the store entry is still this call's optimistic object. Keep the delete-when-undefined behavior.
- Decrement count in finally, and delete the record when count reaches 0.
- Keep the return shape { ok, prev } and all existing toasts and announcements.

(b) 35 WR-01: undoDeny first checks `useTicketStore.getState().triageMap[issueKey]?.state === 'ignored'`. If not, return silently: no invoke and no toast. restoreTicket and markHandled call toast.dismiss(`deny-${issueKey}`) when ok.

(c) 37 IN-02: export const UNDO_TOAST_MS = 8000 and use it for the toast duration. Update the doc comment.

(d) 35 WR-03: in linkTicket, after the relink branch, if useConnectionStore.getState().serverConnection is missing, call notifyError(i18n.t('triage.notConnected')) and return 'failed'. Replace the voided startPreview call with an awaited call inside try/catch. On catch, notifyError(i18n.t('triage.linkFailed')) and return 'failed'. Add 'triage.notConnected' to both locales:
- EN: "Not connected to the source Jira. Check Settings and try again."
- SK: "Nie ste pripojení k zdrojovej Jire. Skontrolujte Nastavenia a skúste to znova."
SK must use "tiket" if it names an issue, never "úloha".

(e) W-1: export function markSeen(issueKey). It reads the current entry. If the entry exists and its state is not 'new', it returns. Otherwise it calls useTicketStore.getState().markSeen(issueKey), then invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }) with a no-op catch, because this is a background persist that never shows a toast. In TicketListPage.handleSelectTicket, keep store.selectTicket(key), replace the store.markSeen and invoke lines with markSeen(key) imported from './triageActions', and remove the invoke import only if it is now unused.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/pmkar && npx vitest run src/features/tickets/__tests__/triageActions.test.ts src/features/tickets/TicketListPage.test.tsx src/features/tickets/__tests__/ src/i18n && npx tsc --noEmit</automated>
  </verify>
  <done>All new behavior tests pass alongside the existing triageActions tests. `grep -n "set_triage_state" src/features/tickets/TicketListPage.tsx` returns nothing. tsc is clean.</done>
</task>

<task type="auto">
  <name>Task 2: Detail UI correctness and styling (36 WR-02, 37 WR-03, 37 IN-01, 36 WR-03, 36 WR-05)</name>
  <files>src/lib/focusRing.ts, src/features/tickets/TicketDetailPage.tsx, src/features/tickets/TicketDetailPanel.tsx, src/features/groups/GroupViewPage.tsx, src/features/tickets/IgnoredTicketsPage.tsx</files>
  <action>
(a) 36 WR-02: in TicketDetailPage and TicketDetailPanel, delete the local `isCopied`. Use `tri.isLinked` in every place that used `isCopied`: the Copy-button condition (page line ~222, panel line ~378), the linked branch (`isCopied && triageEntry?.copiedKey` becomes `tri.isLinked`; page ~196 and ~237, panel ~250), and the panel `isCopied ? null : ...` at ~310. Where the code derives `isIgnored` from state === 'ignored', replace it with `tri.isDenied`. Keep `isHandled` as it is. Result: a copied entry with no copiedKey shows Copy, Dismiss and Mark handled.

(b) 37 WR-03: on the two aria-disabled Link Buttons in TicketDetailPage (~301 and ~323), extend the className to also include `aria-disabled:hover:bg-primary`, which pins the hover colour to the base colour. On the panel Link button (~150), add `aria-disabled:hover:bg-brand`. Do NOT add pointer-events-none, because the tooltip trigger and the keyboard focus that RTRI-04 relies on need pointer events.

(c) 37 IN-01: create src/lib/focusRing.ts exporting `export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2';` with a one-line doc comment. Replace every exact occurrence of that substring in TicketDetailPanel.tsx, GroupViewPage.tsx and IgnoredTicketsPage.tsx with a template literal or cn() that includes FOCUS_RING. Do not change the different `focus-visible:ring-brand` strings in TicketDetailPage. Tailwind v4 scans src/lib, so the classes still generate.

(d) 36 WR-03: change `restoreTicket(ticket.key)` to `void restoreTicket(ticket.key)` in GroupViewPage.tsx (~168) and IgnoredTicketsPage.tsx (~123).

(e) 36 WR-05: in the TicketDetailPanel Escape handler (~127), add `&& !e.defaultPrevented`, matching the page.

Do not delete TicketDetailPanel (W-3 is out of scope). Do not add drag and drop or hover-revealed actions.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/pmkar && npx tsc --noEmit && npx vitest run src/features/tickets src/features/groups && test "$(grep -c 'focus-visible:ring-focus-ring focus-visible:ring-offset-2' src/features/tickets/TicketDetailPanel.tsx src/features/groups/GroupViewPage.tsx src/features/tickets/IgnoredTicketsPage.tsx | awk -F: '{s+=$2} END {print s}')" = 0 && ! grep -n "isCopied" src/features/tickets/TicketDetailPage.tsx src/features/tickets/TicketDetailPanel.tsx</automated>
  </verify>
  <done>No `isCopied` remains in either detail component. FOCUS_RING is the only source of the ring string in the three files. The Link buttons pin their hover colour while aria-disabled. The ticket and group test suites stay green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Consistent wording and the friendly already-linked copy refusal (36 WR-01, 37 WR-02, W-2)</name>
  <files>src/i18n/locales/en.json, src/i18n/locales/sk.json, src/i18n/__tests__/a11yLocale.test.ts, src/i18n/__tests__/detailLocale.test.ts, src/features/tickets/__tests__/triageActions.test.ts, src/features/tickets/copyStore.ts, src/features/tickets/__tests__/copyStore.test.ts, .planning/phases/37-consistency-accessibility-and-uat/37-HUMAN-UAT.md</files>
  <behavior>
    - detailLocale test: sk 'detail.deny' !== sk 'detail.ignore'. EN stays "Deny" / "Dismiss".
    - a11yLocale test: 'triage.denied', 'triage.denyFailed' and 'triage.undoFailed' each contain the nav.notMine label, in EN and in SK.
    - copyStore test: when copy_ticket_v2 rejects with "Ticket SRC-1 is already linked to CLOUD-9. Use Link to restore it instead of copying again.", result.steps[0].detail equals the EN 'copy.alreadyLinked' text with key SRC-1 and cloudKey CLOUD-9. Any other rejection still yields String(err).
  </behavior>
  <action>
(a) 36 WR-01: set sk.json 'detail.deny' to "Odmietnuť", which differs from 'detail.ignore' "Zamietnuť". Leave the tooltips alone; they already say "tiket".

(b) 37 WR-02: align the toast wording with the tab label nav.notMine. a11y.denied already uses it, and a11yLocale.test asserts that.
- EN: 'triage.denied' "Moved {{key}} to Dismissed."; 'triage.denyFailed' "Could not move the ticket to Dismissed. Try again."; 'triage.undoFailed' "Could not restore the link to {{key}}. The ticket stays in Dismissed."
- SK: replace "Ignorované" with "Zamietnuté" in the same three keys, for example "Tiket {{key}} presunutý do Zamietnuté.".
- Leave nav.ignored and detail.ignored unchanged.
- Update the expected strings in triageActions.test.ts (lines ~112, 134, 173, 313, 328, 344).
- In 37-HUMAN-UAT.md line ~60, replace the "known mismatch" note with a note that the toast, the announcement and the tab now all say "Dismissed" / "Zamietnuté" (fixed in quick 261015-lwy). The tester confirms this reads naturally.

(c) W-2: add the 'copy.alreadyLinked' key.
- EN: "{{key}} is already linked to {{cloudKey}}. Open the ticket and use Link to restore it instead of copying again."
- SK: "Tiket {{key}} je už prepojený s {{cloudKey}}. Otvorte tiket a použite Prepojiť, aby ste ho obnovili namiesto opätovného kopírovania."
- Before writing the SK text, check the SK label actually used for the Link button (detail.copy / detail.restoreLink in sk.json) and name that label instead of "Prepojiť" if it differs.
- In copyStore.ts, import i18n from '../../i18n/index', the same import triageActions uses. In the confirmCopy catch, compute msg = String(err). Match /already linked to ([A-Z][A-Z0-9_]*-\d+)/. On a match, use detail = i18n.t('copy.alreadyLinked', { key: state.sourceKey, cloudKey: match[1] }). Otherwise keep msg. This is the smallest change. It adds no relink button and changes no Rust contract.
- Keep the translations parity test green by adding every key to both locales.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/pmkar && npx vitest run src/i18n src/features/tickets/__tests__/copyStore.test.ts src/features/tickets/__tests__/triageActions.test.ts src/components && npx tsc --noEmit</automated>
  </verify>
  <done>The SK Dismiss and Deny labels differ. All triage toast strings and a11y.denied contain the nav.notMine label in EN and SK. A refused duplicate copy shows the localized copy.alreadyLinked message. The HUMAN-UAT note is updated. The i18n guards, including the "úloh" ban, pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Rust command → frontend | Error strings from copy_ticket_v2 are parsed in the UI |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-lwy-01 | Tampering | triageActions applyState rollback | mitigate | Per-key serialization, plus rollback to the last persisted base, so the UI never shows a state the DB never held |
| T-lwy-02 | Tampering | undoDeny | mitigate | Relink only when the entry is still 'ignored'. The key still comes only from the DB-returned relink_ticket value (T-35-03) |
| T-lwy-03 | Spoofing | copyStore already-linked parse | accept | The regex only extracts a Jira-key-shaped token for display through i18n interpolation, which React escapes. No action is taken on it |
</threat_model>

<verification>
- `npx tsc --noEmit` is clean.
- `npx vitest run` is green for the whole frontend suite, including src/i18n.
- `grep -rn "invoke('set_triage_state'" src --include=*.tsx` finds nothing outside the tests.
- No Rust files changed, so cargo tests are not needed.
</verification>

<success_criteria>
All nine scoped audit items are addressed or noted. 37 WR-01 and the re-entry part of 37 WR-03 were already fixed and are noted in the SUMMARY. All tests and the type check pass. Out-of-scope items are untouched.
</success_criteria>

<output>
Create `.planning/quick/261015-lwy-address-the-tech-debt/261015-lwy-SUMMARY.md` when done. List each audit item as fixed, already-fixed, or skipped, with the reason.
</output>
