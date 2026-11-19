---
status: resolved
trigger: "Reported by end user (SK): assigned person is not shown in copy preview (before copying) and therefore is not copied; also the target issue in our Jira is not in status 'Riešime'. PMkar does not load the assignee before copy."
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms

- **Expected:** Copy preview shows the source issue's assignee (resolved to the matching Cloud user) and the copied issue gets that assignee; copied issue ends up in the expected "Riešime" status.
- **Actual:** Assignee is not shown in the preview and the created target issue has no assignee. Target issue is not in "Riešime".
- **Errors:** No error. Copy audit log contains an `assignee [user] skipped` entry with reason "user not resolved in Cloud".
- **Timeline:** Unknown (reported 2026-11-18 from production use).
- **Reproduction:** Copy a Jira Server issue to Cloud via the copy preview flow (source issue of type PBI, target issue type PM).

## Additional Context

PRIVACY: raw log with real user/issue values is stored OUTSIDE git at
`/private/tmp/claude-501/-Users-mimo-Documents-Projects-pmkar/19e9580e-889b-48cd-a8be-8d177d62a8e4/scratchpad/assignee-copy-log.txt`.
Read it for details, but do NOT paste usernames, account IDs, emails, display names or description text into this file or any git-tracked file. Use placeholders (USER_A, USER_VIRTUAL, etc.).

Sanitized observations from the log (one copy run, 20 fields, 2 skipped):
- The log contains TWO blocks of entries for the same fields: block 1 with outcome "copied", block 2 with outcome "ok"/"skipped".
- Block 1: `assignee [user] copied` — source = a real Server user USER_A → resolved to a Cloud user.
- Block 2: `assignee [user] skipped` — source = a DIFFERENT Server user USER_VIRTUAL (a virtual "PM" service account, key `JIRAUSER…`) → target null, "user not resolved in Cloud".
- `description [wiki_to_adf]` also appears in both blocks with different source formats: block 1 raw wiki markup, block 2 rendered HTML (`<p>…</p>`). Suggests the two blocks were built from different source data (raw fields vs renderedFields / different fetch) or different stages (prefill vs submit).
- `summary` is "copied" in block 1 but "skipped — dedicated store property" in block 2 (known by-design pattern, see resolved priority session).
- Static mappings `customfield_10259` / `customfield_10223` set to "Priradené" (= "Assigned") — the status-ish custom fields; user expected status "Riešime" ("In progress") in target.

Open questions for investigation:
1. Which block is the preview/prefill and which is the actual submit? Which source assignee value did the UI actually use?
2. Why do the two stages see different source assignees? (Stale cached issue? Different endpoint? Assignee changed on source between preview and copy? Or a different source field mapped onto target `assignee`?)
3. Why is the preview assignee empty/not displayed — is the "skipped" prefill the one feeding the UI, so the chooser shows nothing and submit sends no assignee?
4. Is the "Riešime" status expectation a separate issue (no transition after create / static mapping value) or a consequence of the missing assignee (e.g., workflow/automation in target keyed on assignee)?

Related: `.planning/debug/resolved/` and `.planning/debug/priority-not-mapped-on-copy.md` (dedicated-store-property pattern in `src/features/tickets/CopyPreviewPage.tsx`).

## Current Focus

hypothesis: "Preview (frontend, block 2) and copy-time audit (backend, block 1) saw different source assignees because the source issue changed between preview-open and confirm (or the preview ticket was stale); the preview then could not resolve USER_VIRTUAL (service account) in Cloud."
test: "Compare mapping_audit_log timestamps of the two blocks and the Jira Server issue history (assignee change) for that copy"
expecting: "Block 2 timestamp earlier than block 1 AND Jira history shows assignee change USER_VIRTUAL -> USER_A in between => stale/changed source; otherwise hypothesis refuted"
next_action: "CHECKPOINT: ask user for audit timestamps, Jira Server assignee history, and what the created Cloud issue's assignee actually is"
reasoning_checkpoint: ""

## Evidence

- checked: raw log vs code. Block 1 (outcome "copied") = write_copy_time_audit in src-tauri/src/commands.rs (copy_ticket_v2, source re-fetched at confirm time, fields/assignee). Block 2 (ok/skipped, "user not resolved in Cloud", summary "dedicated store property") = frontend log_preview_transformations in CopyPreviewPage.tsx written at preview-open from store.sourceTicket.
  found: Both stages use the same Jira endpoint (/rest/api/2/issue/KEY?expand=renderedFields...&fields=*all) and same mapping rows (10 each); the description format difference (wiki vs HTML) is by design (preview uses renderedFields, line ~365). Only the assignee VALUE differs (USER_A vs USER_VIRTUAL).
  implication: Preview and copy saw different assignee data => either source changed in between, or preview used a stale ticket (TicketDetailPanel fetches detail once per open and keeps it).
- checked: preview unresolved path. USER_VIRTUAL unresolved => no overrideValues.assignee seeded => chooser empty; backend would resolve independently at copy time.
  implication: Backend at copy time resolved USER_A and put the Cloud user in create payload (audit written after override merge), so the log does NOT prove the assignee was dropped by PMkar.
- checked: status "Riesime". copy_ticket_v2 never performs a transition; copyStore.targetStatus is set in startPreview but never read/sent anywhere (grep). Statics customfield_10259/10223 are plain custom fields.
  implication: Target status is whatever the Cloud workflow initial status is; separate missing feature, not caused by assignee.
- checked: local dev DB for copy id: 0 rows (log is from end user machine); timestamps unavailable.

## Eliminated

- hypothesis: source assignee changed (by the user) between preview and copy
  evidence: user confirmed nothing was changed; created Cloud issue has the real person (USER_A), so backend copy path works
  timestamp: 2026-11-19

## Resolution

root_cause: "Preview used a source ticket snapshot (TicketDetailPanel/triage detail fetched earlier, passed to copyStore.startPreview, whose sourceBaseUrl param was unused) while copy_ticket_v2 re-fetches the source live. Preview saw USER_VIRTUAL, copy saw USER_A, so preview showed no assignee although the copy set it. Exact trigger of the divergence (stale snapshot vs. Jira-side reassignment) not provable without timestamps; both code paths are otherwise identical."
fix: "startPreview now refetches the source via fetch_ticket_detail (falls back to caller ticket on failure) so preview and copy read the same live assignee. Unresolved user already surfaces as a person gap. Riesime status = separate follow-up (no post-create transition; copyStore.targetStatus unused)."
verification: ""
files_changed: [src/features/tickets/copyStore.ts, src/features/tickets/__tests__/copyStore.test.ts]

<!-- closed 2026-11-19 -->
Resolution note: fix shipped without human verification (user cannot test locally; will observe in production).
Root cause (probable): copy preview used the caller's cached source ticket snapshot while copy_ticket_v2 re-fetches live at confirm time; snapshot carried a different assignee (USER_VIRTUAL) -> preview showed no resolved assignee. Fix: startPreview refetches source via fetch_ticket_detail (fallback to snapshot on failure).
Follow-up (not done): target status "Riešime" — no post-create transition exists; copyStore.targetStatus unused.
