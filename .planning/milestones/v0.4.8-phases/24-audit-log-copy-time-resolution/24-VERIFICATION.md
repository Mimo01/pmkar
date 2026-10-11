---
phase: 24-audit-log-copy-time-resolution
verified: 2026-05-05T12:00:00Z
status: gaps_found
score: 7/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Copy-time and preview-time audit rows share the same copy_id group for CopyPreviewModal users"
    status: failed
    reason: "CopyPreviewModal.tsx:252 passes null as copyId unconditionally. The backend generates a fresh uuid::Uuid::new_v4() fallback, so copy-time rows land in a different group from any preview-time rows written via the modal flow. The phase design goal of one linked group is broken for the modal entry path."
    artifacts:
      - path: "src/features/tickets/CopyPreviewModal.tsx"
        issue: "handleConfirm calls confirmCopy(sourceBaseUrl, cloudBaseUrl, null) at line 252. Modal has no previewCopyId state and does not call log_preview_transformations, so no preview-time rows exist to link against — but the null also means copy-time rows get a server-generated UUID unrelated to any prior audit context."
    missing:
      - "Add previewCopyId useState and a phase-driven useEffect to CopyPreviewModal (mirrors CopyPreviewPage lines 137-148)"
      - "Pass previewCopyId instead of null in CopyPreviewModal.handleConfirm"
      - "Note: if the modal never calls log_preview_transformations, the linking is partially moot, but the fix still removes the guaranteed null and enables forward compatibility"
human_verification:
  - test: "End-to-end copy via CopyPreviewPage: open preview, copy ticket, open Audit Log -> Field Transformations"
    expected: "Both prefill rows (outcome='skipped', amber badge) AND copy-time rows (outcome='copied', blue badge) appear under one expanded group with the same short copy_id. Group header shows N fields, 0 failed, Y skipped. 'Copied' rows display a blue badge with label 'copied' (EN) or 'skopírované' (SK)."
    why_human: "Requires live Tauri app with mock server. Cannot verify row grouping or badge rendering from static code analysis alone."
---

# Phase 24: Audit Log Copy-Time Resolution — Verification Report

**Phase Goal:** Add copy-time per-field audit entries to `copy_ticket_v2` so the Field Transformations log reflects actual `apply_mapping` resolution outcomes for `wiki_to_adf` and `user` fields — not just the preview-time pre-fill snapshot.

**Verified:** 2026-05-05T12:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `CopyTicketV2Args` has `copy_id: Option<String>` | VERIFIED | `commands.rs:137` — `pub copy_id: Option<String>` with Phase 24 doc comment inside the `#[serde(rename_all = "camelCase")]` struct |
| 2 | `write_copy_time_audit` function exists and writes outcome=copied/skipped/failed rows | VERIFIED | Free fn at `commands.rs:1728-1807`. Outcome logic confirmed: `copied` when `tgt_val` non-null, `skipped` when `src_val` is null, `failed` + `gap_kind` when matching `GapVariant` found |
| 3 | `copyStore.confirmCopy` accepts and passes `copyId` arg | VERIFIED | Interface at `copyStore.ts:49-53` — `copyId: string | null` third param; implementation at line 210 passes it into invoke args at line 253 |
| 4 | `CopyPreviewPage.handleConfirm` threads `previewCopyId` into `confirmCopy` | VERIFIED | `CopyPreviewPage.tsx:368` — `confirmCopy(sourceBaseUrl, cloudBaseUrl, previewCopyId)`. `previewCopyId` is set via `crypto.randomUUID()` when phase enters 'previewing' (lines 137-148) |
| 5 | `AuditLogPage.tsx` has a blue badge branch for `outcome='copied'` | VERIFIED | `AuditLogPage.tsx:766-767` — `row.outcome === 'copied' && 'bg-blue-500/15 text-blue-400 border-blue-500/20'` inserted after the 'ok' branch |
| 6 | `en.json` has `audit.fields.outcome.copied` key | VERIFIED | `en.json:280` — `"audit.fields.outcome.copied": "copied"` |
| 7 | `sk.json` has `audit.fields.outcome.copied` key with Slovak translation | VERIFIED | `sk.json:280` — `"audit.fields.outcome.copied": "skopírované"` |
| 8 | Copy-time and preview-time audit rows share the same copy_id group (CR-01 gap: CopyPreviewModal passes null) | FAILED | `CopyPreviewModal.tsx:252` — `confirmCopy(sourceBaseUrl, cloudBaseUrl, null)`. Backend falls back to `uuid::Uuid::new_v4()` at `commands.rs:1558-1560`, producing an unrelated UUID. The CopyPreviewPage path (truth 4) works correctly; the modal path does not. |

**Score:** 7/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/commands.rs` | `CopyTicketV2Args.copy_id` field + `write_copy_time_audit` + 5 unit tests | VERIFIED | `copy_id: Option<String>` at line 137; `write_copy_time_audit` at lines 1728-1807; 5 test functions at lines 2204-2310 |
| `src/features/tickets/copyStore.ts` | `confirmCopy` accepts `copyId: string | null`, passes into invoke | VERIFIED | Interface updated at lines 49-53; invoke args include `copyId` at line 253 |
| `src/features/tickets/CopyPreviewPage.tsx` | `handleConfirm` passes `previewCopyId` | VERIFIED | Line 368 confirmed |
| `src/features/tickets/CopyPreviewModal.tsx` | `handleConfirm` passes `previewCopyId` | FAILED (known gap CR-01) | Line 252 passes `null` hardcoded; modal has no `previewCopyId` state |
| `src/features/tickets/AuditLogPage.tsx` | Blue badge branch for `outcome='copied'` | VERIFIED | Lines 766-767 |
| `src/i18n/locales/en.json` | `audit.fields.outcome.copied` key | VERIFIED | Line 280 |
| `src/i18n/locales/sk.json` | `audit.fields.outcome.copied` SK key | VERIFIED | Line 280 |
| `src/features/tickets/types.ts` | `MappingAuditEntry.outcome` union includes `'copied'` | VERIFIED | Line 219 — `outcome: 'ok' | 'copied' | 'failed' | 'skipped'` |
| `src/features/tickets/__tests__/AuditLogPage.fieldGrouping.test.tsx` | 3 tests for 'copied' outcome | VERIFIED | Describe block at lines 281-342 — groupByCopyId counting, badge text via real i18n, summary header invariant |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CopyPreviewPage.handleConfirm` | `copy_ticket_v2 copy_id arg` | `copyStore.confirmCopy(_, _, previewCopyId)` | WIRED | `CopyPreviewPage.tsx:368` → `copyStore.ts:210,253` → `commands.rs:137,1558` |
| `CopyPreviewModal.handleConfirm` | `copy_ticket_v2 copy_id arg` | `copyStore.confirmCopy(_, _, null)` | BROKEN | `CopyPreviewModal.tsx:252` passes `null`; backend generates random UUID fallback |
| `write_copy_time_audit` | `field_mapping_db.insert_mapping_audit` | called per mapping row after override merge | WIRED | `commands.rs:1791` — `mdb.insert_mapping_audit(copy_id, ...)` inside loop |
| `AuditLogPage.tsx badge switch` | `i18n key audit.fields.outcome.copied` | `t('audit.fields.outcome.copied')` | WIRED | Badge renders `t('audit.fields.outcome.${row.outcome}')` at line 774; key exists in both locale files |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `write_copy_time_audit` | `resolved.fields[target_field_id]` | `apply_mapping` return value (ResolvedFields) | Yes — actual transformer output, not static | FLOWING |
| `groupByCopyId` counter logic | `r.outcome` | DB row outcome string written by `write_copy_time_audit` | Yes — 'copied'/'skipped'/'failed' from real resolution | FLOWING |
| `AuditLogPage.tsx` badge | `row.outcome` | `get_mapping_audit_log_page` Tauri invoke | Yes — outcome from `mapping_audit_log` table | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 5 Rust unit tests exist by name | `grep -c "copy_time_audit_loop_writes_copied\|copy_time_audit_loop_writes_skipped\|copy_time_audit_loop_writes_failed\|copy_time_audit_loop_uses_copy_id\|copy_time_audit_loop_skips_empty" commands.rs` | 5 | PASS |
| `write_copy_time_audit` fn signature present | `grep -n "fn write_copy_time_audit" commands.rs` | line 1728 | PASS |
| Audit loop placed AFTER override merge, BEFORE Phase 6 create_issue | Code position check lines 1548-1567 | override loop ends at 1551, audit block at 1553-1565, Phase 6 starts at 1567 | PASS |
| Blue badge CSS present | `grep -n "bg-blue-500/15" AuditLogPage.tsx` | line 767 | PASS |
| Counting logic excludes 'copied' from failed/skipped | `grep -A2 "outcome.*failed" AuditLogPage.tsx` | lines 268-269 only count 'failed' and 'skipped', not 'copied' | PASS |
| `copyId` in invoke args | `grep -n "copyId," copyStore.ts` | line 253 | PASS |
| CopyPreviewModal passes null | `grep -n "confirmCopy.*null" CopyPreviewModal.tsx` | line 252 | FAIL (known gap CR-01) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CUTV-04 | 24-01, 24-02 | Copy-time audit entries for field transformations | SATISFIED | `write_copy_time_audit` writes per-field rows after `apply_mapping` in `copy_ticket_v2`; 'copied' badge renders correctly in UI |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src-tauri/src/commands.rs` | 1780 | `None => ("skipped", None, Some("source value missing"))` — misleading reason string when gap arm is `None` but source value is not null | Warning | Incorrect `failure_reason` displayed to users reading audit log for fields where `apply_mapping` produced no output for reasons other than null source |
| `src-tauri/src/commands.rs` | 1737, 1806 | `let _ = mdb.begin_transaction()` and `let _ = mdb.commit_transaction()` discard errors silently | Info | If `begin_transaction` fails, rows are auto-committed individually — atomicity lost but rows still written; no user-visible impact in practice |
| `src/features/tickets/CopyPreviewModal.tsx` | 252 | Hardcoded `null` for `copyId` argument | Blocker | Preview-time and copy-time audit rows from modal flow are never linked under same copy_id group — core Phase 24 design promise broken for modal entry path |

---

### Human Verification Required

#### 1. End-to-End Audit Log Group Linkage (CopyPreviewPage path)

**Test:** Open app with mock server. Copy a ticket that has a `description` field mapped via `wiki_to_adf` transformer and an `assignee` mapped via `user` transformer. Open Audit Log > Field Transformations tab. Expand the copy group.

**Expected:** Both prefill entries (outcome='skipped', amber badge) AND copy-time entries (outcome='copied', blue badge) appear under one expanded group with the same 8-char short copy_id prefix. Group header shows "N fields · 0 failed · Y skipped". The 'copied' rows do not increment the skipped counter.

**Why human:** Requires live Tauri app with a running mock server and real SQLite DB. Row grouping by UUID and badge colour cannot be verified from static code analysis.

#### 2. CopyPreviewModal path: copy-time rows get isolated group

**Test:** Open the modal variant (if exposed via a route/shortcut). Copy a ticket. Open Audit Log > Field Transformations tab.

**Expected:** Copy-time rows appear but in a group with a different UUID than any prior preview-time rows (because null copyId triggers server-side fallback UUID). This is the **known CR-01 gap** — rows are still written, just not linked.

**Why human:** Confirms the gap is observable and the fix in the gaps section is necessary before closing the milestone.

---

### Gaps Summary

One blocker gap prevents full goal achievement:

**CR-01 — `CopyPreviewModal` always passes `null` as copyId (`CopyPreviewModal.tsx:252`).**

The phase goal states that copy-time and preview-time entries should share one `copy_id` group. The `CopyPreviewPage` path implements this correctly. The `CopyPreviewModal` path was updated (per 24-01-SUMMARY deviations) to accept the new `copyId` parameter in the `confirmCopy` call, but it was patched to pass `null` as a workaround because the modal lacked `previewCopyId` state. The backend then generates `uuid::Uuid::new_v4()` as a fallback, producing an unrelated UUID for the copy-time rows.

The fix requires two changes to `CopyPreviewModal.tsx`:
1. Add `previewCopyId` state driven by a `phase`-dependent `useEffect` (same pattern as `CopyPreviewPage` lines 137-148).
2. Change `handleConfirm` at line 252 to pass `previewCopyId` instead of `null`.

Note: the modal does not currently call `log_preview_transformations`, so there are no preview-time rows to link against in the modal flow. The fix still eliminates the guaranteed null and enables forward compatibility if `log_preview_transformations` is later added to the modal.

---

_Verified: 2026-05-05T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
