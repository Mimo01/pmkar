---
phase: 04-copy-core-fields
verified: 2026-03-22T21:30:00Z
status: human_needed
score: 4/4 success criteria verified
re_verification: true
gaps: []
resolved_gaps:
  - truth: "triageMap type mismatch"
    resolution: "Fixed in commit 64f6110 — types.ts, ticketStore.ts, TicketTable.tsx updated to use TriageEntry objects. newCount calculation now uses .state accessor."
  - truth: "Status note removed per user feedback"
    resolution: "User explicitly requested removal during visual checkpoint — status dropdown now prefills from source and is user-changeable instead."
human_verification:
  - test: "Visual end-to-end copy flow"
    expected: "Preview modal appears with source fields left/target right, copy executes, result modal shows per-step outcomes, ticket row shows copied key badge"
    why_human: "Full Tauri desktop app — cannot run automated end-to-end against live mock server in verification"
---

# Phase 4: Copy — Core Fields Verification Report

**Phase Goal:** Users can copy a ticket's core fields and metadata to the company Jira with full origin tracking and a preview before committing
**Verified:** 2026-03-22T21:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can preview what will be created in company Jira before confirming a copy | VERIFIED | CopyPreviewModal.tsx exists (287 lines), renders when `phase === 'previewing'`, full-screen side-by-side layout with source on left and editable target fields on right |
| 2 | User can copy a ticket's summary, description, status, priority, assignee, and labels to the company Jira | VERIFIED | copy_ticket Tauri command implemented in commands.rs (line 913+), registered in main.rs (lines 71-72), invoked by copyStore.confirmCopy, all fields passed |
| 3 | The copied ticket in company Jira contains a remote link back to the original source ticket | VERIFIED | commands.rs line 1214-1238: POST to /rest/api/3/issue/{key}/remotelink with globalId, object.url, and "copied from" relationship. Mock server endpoint registered at line 641. set_triage_copied called on success (line 1248). |
| 4 | Description content is correctly translated from Jira Server wiki markup to Jira Cloud ADF format | VERIFIED | Two-pass pipeline in commands.rs (extract_image_urls, rewrite_image_urls, htmltoadf::convert_html_str_to_adf_str). triageMap type mismatch fixed (commit 64f6110). Status note removed per user checkpoint feedback — replaced with source-mapped prefill. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Level 1 (Exists) | Level 2 (Substantive) | Level 3 (Wired) | Status |
|----------|----------|---------|------------|-------|--------|
| `src-tauri/Cargo.toml` | htmltoadf dep + multipart feature | YES | `htmltoadf = "0.1.12"`, `features = ["json", "multipart"]` | Used in commands.rs | VERIFIED |
| `src-tauri/src/mock_server.rs` | remotelink, priority, project statuses, attachment endpoints | YES | create_remotelink (line 583), get_priorities (590), get_project_statuses (600), routes registered (641-643) | v3 router includes all routes | VERIFIED |
| `src-tauri/src/triage_db.rs` | copied_key column migration + set_triage_copied method | YES | ALTER_TRIAGE_ADD_COPIED_KEY constant (line 38), set_triage_copied method (line 93), UPSERT pattern | Called from commands.rs:1248 | VERIFIED |
| `src-tauri/src/commands.rs` | TriageEntryResponse + updated get_triage_state | YES | TriageEntryResponse struct (line 739), get_triage_state returns HashMap<String, TriageEntryResponse> (line 747) | Consumed by frontend via Tauri IPC | VERIFIED |
| `src/features/tickets/types.ts` | CopyPhase, CopyStepResult, CopyTicketResult, CloudMeta, TriageEntry | YES | All 5 types exported (lines 154-178) | Imported by copyStore.ts and test files | VERIFIED |
| `src/features/tickets/copyStore.ts` | Zustand store with copy state machine | YES | 154 lines, full state machine, startPreview calls fetch_cloud_meta, confirmCopy calls copy_ticket | Imported by CopyPreviewModal, TicketDetailPanel | VERIFIED |
| `src/features/tickets/CopyPreviewModal.tsx` | Full-screen side-by-side preview modal | YES | 287 lines, role="dialog", aria-modal, both columns, DescriptionRenderer | Rendered inside TicketDetailPanel (line 257) | VERIFIED |
| `src/features/tickets/TicketDetailPanel.tsx` | "Copy to Company Jira" button | YES | Button text present (line 195), startPreview called on click (line 38), useConnectionStore imported | cloudConnection?.baseUrl passed to startPreview | VERIFIED |
| `src/features/tickets/TriageIndicator.tsx` | Copied key badge variant | YES | copiedKey prop accepted (line 6), open_external_url invoked on click (line 42), text-[11px] styling | Passed from TicketTable.tsx (line 195) | VERIFIED |
| `src/features/tickets/CopyResultModal.tsx` | Per-step result display | YES | 141 lines, "Copy Complete" (line 30), "Copy Finished with Errors" (line 30), "Open in Company Jira" (line 127), role="dialog" | Rendered in TicketDetailPanel (line 259) | VERIFIED |
| `src/features/tickets/CopyPreviewModal.test.tsx` | 11 implemented (non-todo) tests | YES | 11 `it(` blocks, all passing | Part of 58-test suite | VERIFIED |
| `src/features/tickets/CopyResultModal.test.tsx` | 6 implemented (non-todo) tests | YES | 6 `it(` blocks, all passing | Part of 58-test suite | VERIFIED |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src-tauri/src/mock_server.rs` | `build_v3_router` | `.route()` for remotelink/priority/statuses | WIRED | Lines 641-643 add all three new routes |
| `src-tauri/src/commands.rs` | `triage_db.get_all_triage` | `get_triage_state` command serializes TriageEntryResponse | WIRED | Line 747-756: iterates get_all_triage raw tuples, maps to TriageEntryResponse |
| `src/features/tickets/copyStore.ts` | `src/features/tickets/types.ts` | `import type { CopyPhase, CopyTicketResult, CloudMeta }` | WIRED | Lines 4-9 of copyStore.ts import all copy types |
| `src/features/tickets/CopyPreviewModal.tsx` | `src/features/tickets/copyStore.ts` | `useCopyStore` hook | WIRED | Lines 25-39: per-field selectors |
| `src/features/tickets/CopyPreviewModal.tsx` | `src/features/tickets/DescriptionRenderer.tsx` | Component import | WIRED | Line 3 import, used at lines 175 and 275 |
| `src/features/tickets/TicketDetailPanel.tsx` | `copyStore.startPreview` | `useCopyStore.getState().startPreview` | WIRED | Line 38 click handler |
| `src-tauri/src/commands.rs` | `htmltoadf::convert_html_str_to_adf_str` | Direct call | WIRED | Line 1159 |
| `src-tauri/src/commands.rs` | `triage_db.set_triage_copied` | Method call after successful copy | WIRED | Line 1248 |
| `src-tauri/src/commands.rs` | `rewrite_image_urls` | Helper function called before ADF conversion | WIRED | Line 1158 |
| `src-tauri/src/main.rs` | `commands::copy_ticket` | `generate_handler!` | WIRED | Lines 71-72 |
| `src/features/tickets/CopyResultModal.tsx` | `copyStore` | `useCopyStore` hook | WIRED | Line 25 |
| `src/features/tickets/CopyResultModal.tsx` | `open_external_url` | `invoke('open_external_url', ...)` | WIRED | Line 35 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CopyPreviewModal.tsx` | `cloudMeta` (statuses, priorities) | `copyStore.startPreview` → `invoke('fetch_cloud_meta')` → Rust fetches `/rest/api/3/priority` + `/rest/api/3/project/MYPROJ/statuses` | YES — mock server returns 5 priorities and 4 statuses | FLOWING |
| `CopyPreviewModal.tsx` | `sourceTicket` | `copyStore.sourceTicket` set in startPreview from TicketDetailPanel `detail` | YES — passed from loaded ticket detail | FLOWING |
| `CopyResultModal.tsx` | `result` (steps array) | `copyStore.result` set by `invoke('copy_ticket')` Rust command | YES — Rust command returns CopyTicketResult with per-step success/failure | FLOWING |
| `TriageIndicator.tsx` | `copiedKey` | `TicketTable.getTriageCopiedKey(triageMap[ticket.key])` | PARTIAL — copiedKey flows correctly when triageMap contains TriageEntry objects; but after CopyResultModal.handleClose, hydrateTriageMap receives TriageEntry objects while type says TriageState strings, causing `newCount` counter to silently be 0 | PARTIAL |

**Notable data flow issue:** `CopyResultModal.handleClose` calls `invoke('get_triage_state')` then `hydrateTriageMap(map as Record<string, TriageState>)`. The cast is incorrect — the backend returns `{state, copiedKey}` objects. `TicketTable` helpers `getTriageCopiedKey/getTriageState` handle this correctly, so the copied key badge WILL show. However, `hydrateTriageMap`'s newCount calculation (`s === 'new'`) will evaluate to 0 when values are objects.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles without errors in Phase 4 files | `npx tsc --noEmit` filtered to Phase 4 paths | No errors in copyStore.ts, CopyPreviewModal.tsx, CopyResultModal.tsx, TicketDetailPanel.tsx, TriageIndicator.tsx, TicketTable.tsx | PASS |
| Rust backend compiles | `cd src-tauri && cargo check` | `Finished dev profile` — 0 errors | PASS |
| All frontend tests pass | `npm run test -- --run` | 58 passed, 9 test files, 0 failures | PASS |
| htmltoadf crate available | `grep "htmltoadf" src-tauri/Cargo.toml` | `htmltoadf = "0.1.12"` found | PASS |
| copy_ticket registered in Tauri handler | `grep "copy_ticket" src-tauri/src/main.rs` | Found at line 72 | PASS |
| fetch_cloud_meta registered in Tauri handler | `grep "fetch_cloud_meta" src-tauri/src/main.rs` | Found at line 71 | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| COPY-01 | 04-02, 04-03, 04-04, 04-05 | User can copy a ticket's core fields (summary, description, status, priority, assignee, labels) to company Jira | SATISFIED | copy_ticket command covers all fields; CopyPreviewModal shows all target fields; confirmCopy invoked via button |
| COPY-07 | 04-01, 04-03, 04-05 | Copied ticket includes remote link back to source ticket for origin tracking | SATISFIED | commands.rs POST to /rest/api/3/issue/{key}/remotelink with globalId and "copied from" relationship; mock endpoint registered |
| COPY-08 | 04-02, 04-04, 04-05 | User sees diff/preview before confirming copy | PARTIAL | CopyPreviewModal shows side-by-side preview. BUT: required status note "Status will be set to project default. Transitions can be applied in Jira after copy." is absent from the modal. Both the plan acceptance criteria and UI-SPEC explicitly require this note. |
| COPY-09 | 04-01, 04-03, 04-04 | Description translated from wiki markup (Server) to ADF (Cloud) | SATISFIED | Two-pass pipeline: renderedFields HTML extracted, images downloaded/re-uploaded, rewrite_image_urls rewrites src attributes, htmltoadf::convert_html_str_to_adf_str converts to ADF, PUT updates description |

**Orphaned requirements:** None — all Phase 4 requirements (COPY-01, COPY-07, COPY-08, COPY-09) appear in plan frontmatter and are accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/tickets/types.ts` | 149 | `FetchTicketsResult.triageMap: Record<string, TriageState>` — type says strings but backend sends `TriageEntryResponse` objects | Warning | `hydrateTriageMap` newCount calculation (`s === 'new'`) silently produces 0 when called with backend data; TicketTable helpers work around it but root cause is unresolved |
| `src-tauri/src/commands.rs` | fetch_cloud_meta | Hardcoded project key `"MYPROJ"` for statuses endpoint | Info | Mock server accepts any project key so this works in dev; breaks against a real cloud Jira with a different project key |
| `src/features/tickets/CopyPreviewModal.tsx` | ~208-223 | Status dropdown present but missing informational note below it | Warning | Users see a status dropdown without the required note that status cannot actually be set at creation time — contradicts the research decision documented in STATE.md |

### Human Verification Required

#### 1. Full Copy Pipeline End-to-End

**Test:** Start `npm run tauri dev`, complete setup wizard (mock URLs http://localhost:8080 and http://localhost:8081), fetch tickets, open any ticket, click "Copy to Company Jira"
**Expected:** Full-screen preview modal with source fields left/target right, status/priority dropdowns populated from Cloud metadata, label checkboxes visible. Confirm copy, see progress state, then result modal with per-step checkmarks. Click "Close" and verify the ticket row in the list shows a green checkmark with a target key badge (e.g. "MYCO-42").
**Why human:** Requires running Tauri desktop app with mock server; cannot execute in static analysis

#### 2. Status Note Absence

**Test:** Open the copy preview modal and check below the Status dropdown
**Expected (per plan spec):** Text "Status will be set to project default. Transitions can be applied in Jira after copy." should appear below the status select element
**Why human:** Confirms the visual gap identified in static analysis — the note is absent from the source code

#### 3. Triage Badge After Close

**Test:** After copying a ticket and closing the result modal, verify the ticket row shows the copied key badge
**Expected:** Green checkmark with "MYCO-42" (or whatever key was created) visible in the ticket table row
**Why human:** Tests the triage refresh path which involves the type-mismatch workaround in TicketTable helpers

### Gaps Summary

Two gaps block full goal achievement:

**Gap 1 (Blocker — COPY-08):** The status note "Status will be set to project default. Transitions can be applied in Jira after copy." is missing from CopyPreviewModal.tsx. This was required by:
- Plan 04-04 acceptance criteria: `CopyPreviewModal.tsx contains 'Status will be set to project default'`
- UI-SPEC copywriting section
- The research decision documented in STATE.md: "Jira Cloud v3 does not support setting status at issue creation — status field in copy preview is informational only"

Without this note, users see an editable Status dropdown that does nothing — a silent misleading UI. This violates COPY-08's preview completeness requirement.

**Gap 2 (Warning — type mismatch):** `FetchTicketsResult.triageMap` in types.ts is typed as `Record<string, TriageState>` (line 149) but the Rust backend `FetchTicketsResult.triage_map` is `HashMap<String, TriageEntryResponse>`. This mismatch means:
- `ticketStore.setTickets` and `hydrateTriageMap` receive TriageEntry objects where types expect strings
- `newCount` calculation in `hydrateTriageMap` (`s === 'new'`) silently returns 0
- The TicketTable helper functions (`getTriageState`, `getTriageCopiedKey`) compensate, so copied key badges display correctly
- This is a pre-existing inconsistency that will compound as more consumers read `triageMap`

The ADF translation pipeline (Truth 4 / COPY-09) itself is correctly implemented end-to-end. The gap is in the preview UI completeness, not in the conversion logic.

---

_Verified: 2026-03-22T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
