---
phase: 25-preview-time-resolution
verified: 2026-05-05T14:22:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open copy preview for a ticket with description HTML (multi-paragraph). Confirm a read-only description block renders in the target panel (greyed out, capped height, shows formatted content — not raw JSON)."
    expected: "Description block visible with label 'Description (will be copied)', prose-formatted content, opacity-75 styling, not editable."
    why_human: "ADF-rendered prose layout cannot be asserted in unit tests; DescriptionRenderer output is visual."
  - test: "Open copy preview for a ticket with a mapped assignee. Confirm the user picker on the target side shows the pre-resolved Cloud user's displayName before any interaction."
    expected: "UserPickerRenderer input shows the resolved user name (e.g. 'Alice') before the user touches it."
    why_human: "Pre-filled picker state is visual/interactive; unit tests mock setOverrideValue but cannot verify the picker renders the resolved name in its input field."
  - test: "Pre-fill effect, then edit the description in a text area (if one is visible), then click Copy. Confirm the copied Jira issue contains the EDITED description, not the original."
    expected: "Copied issue has user-edited description — override flows verbatim via overrideValues."
    why_human: "End-to-end UI flow with real Jira connections required; cannot simulate in automated tests."
---

# Phase 25: Preview-Time Resolution Verification Report

**Phase Goal:** Resolve `description` (wiki_to_adf) and all `user`-type fields at copy-preview-open time so users can review and edit resolved values in the copy preview modal before clicking Copy.
**Verified:** 2026-05-05T14:22:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `resolve_description_to_adf` Tauri command takes an HTML string and returns a valid ADF object `{ version: 1, type: 'doc', content: [...] }` | ✓ VERIFIED | `commands.rs:1204` — calls `convert_and_postprocess(&html, &HashMap::new())`. 3 unit tests pass: `resolve_description_to_adf_returns_doc_for_html`, `_returns_empty_doc_for_empty_html`, `_paragraph_content_non_empty`. |
| 2 | `resolve_users_preview` Tauri command takes a list of `{ username, email }` pairs and returns full Cloud user objects using domain-batched HTTP | ✓ VERIFIED | `commands.rs:1222–1305` — groups by email domain, calls `resolver.fetch_users_by_domain(domain)` per domain, falls back to per-username query. 2 domain-grouping unit tests pass. Integration test passes against mock Cloud server at 127.0.0.1:8081. |
| 3 | Both commands are registered in `main.rs` invoke_handler and callable from the frontend | ✓ VERIFIED | `main.rs:252-253` — `commands::resolve_description_to_adf` and `commands::resolve_users_preview` both present in `generate_handler!` macro. |
| 4 | Empty HTML input to `resolve_description_to_adf` returns an empty ADF doc (not an error) | ✓ VERIFIED | `commands.rs:2488` unit test `resolve_description_to_adf_returns_empty_doc_for_empty_html` asserts `result["type"] == "doc"` and `content.is_empty()`. Passes. |
| 5 | An unresolvable user in `resolve_users_preview` returns a null entry (not an error that breaks the whole batch) | ✓ VERIFIED | `commands.rs:1270` — `vec![serde_json::Value::Null; users.len()]` initialised; only resolved entries overwrite null slots. `unwrap_or_default()` on domain fetch prevents propagating HTTP errors. |
| 6 | When the copy preview opens, the pre-fill effect invokes `resolve_description_to_adf` for wiki_to_adf rows and stores the ADF object in `overrideValues.description` | ✓ VERIFIED | `CopyPreviewPage.tsx:254-267` — `invoke<unknown>('resolve_description_to_adf', { html: descHtml })` then `setOverrideValue(descRow.targetFieldId, adf)`. PREV-01 test in `CopyPreviewPage.test.tsx:526` passes (22/22 tests pass). |
| 7 | When the copy preview opens, the pre-fill effect invokes `resolve_users_preview` for all user-kind rows and stores Cloud user objects in `overrideValues[targetFieldId]` | ✓ VERIFIED | `CopyPreviewPage.tsx:343-358` — `invoke<...>('resolve_users_preview', { users: userEntries, cloudBaseUrl })` then `setOverrideValue(row.targetFieldId, resolvedUser)`. PREV-02 test passes. |
| 8 | The description field is excluded from DynamicTargetForm's editable field list | ✓ VERIFIED | `CopyPreviewPage.tsx:467` — `f.fieldId !== 'description' &&` added to `dynamicFormFields` useMemo filter. PREV-03 test passes. |
| 9 | `overrideValues` containing resolved ADF and user objects flows verbatim to `copy_ticket_v2` via `confirmCopy` | ✓ VERIFIED | `copyStore.ts:249` — `...state.overrideValues` spread into `copy_ticket_v2` args. PREV-04 test in `copyStore.test.ts:566` passes asserting `overrideValues.description` (ADF) and `overrideValues.assignee.accountId`. |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/commands.rs` | `resolve_description_to_adf` and `resolve_users_preview` implementations | ✓ VERIFIED | Lines 1204–1310 — substantive implementations with domain-batching, find_best_match helper, PreviewUserEntry struct. |
| `src-tauri/src/main.rs` | Command registration in invoke_handler | ✓ VERIFIED | Lines 252–253 — both commands registered. |
| `src-tauri/src/field_transform/user.rs` | `fetch_users_by_domain` and `fetch_users_by_query` made public | ✓ VERIFIED (deviation accepted) | Both are `pub async fn` (fully public), not `pub(crate)`. Deviation from plan: integration tests in `tests/` are external crates and cannot access `pub(crate)` methods. Functionally equivalent — the methods are gated behind `UserResolver::new` which requires credentials. |
| `src-tauri/tests/resolve_users_preview_integration.rs` | Integration test calling `fetch_users_by_domain` against mock server | ✓ VERIFIED | 72-line file, calls `start_servers_once()` + `resolver.fetch_users_by_domain("example.com")`, asserts non-empty `accountId` and `displayName`. |
| `src/features/tickets/CopyPreviewPage.tsx` | Async pre-fill effect + description read-only display | ✓ VERIFIED | Lines 185–433 — async IIFE with `cancelled` guard, wiki_to_adf and user resolution, `f.fieldId !== 'description'` filter, read-only block at lines 783–802. |
| `src/features/tickets/__tests__/CopyPreviewPage.test.tsx` | PREV-01, PREV-02, PREV-03 tests | ✓ VERIFIED | All 22 tests pass including 3 new Phase 25 tests. |
| `src/features/tickets/__tests__/copyStore.test.ts` | PREV-04 test | ✓ VERIFIED | 34 tests pass including PREV-04. |
| `src/i18n/locales/en.json` | `copy.preview.descriptionReadOnly` and `copy.preview.descriptionReadOnlyHint` keys | ✓ VERIFIED | Lines 135–136 — both keys present. |
| `src/i18n/locales/sk.json` | Same keys in Slovak | ✓ VERIFIED | Lines 135–136 — "Popis (bude skopírovaný)" and "Preložený popis bude skopírovaný ako formátovaný obsah." |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `resolve_description_to_adf` | `wiki_to_adf::convert_and_postprocess` | direct call with empty user_map | ✓ WIRED | `commands.rs:1205-1208` — `crate::field_transform::wiki_to_adf::convert_and_postprocess(&html, &HashMap::new())` |
| `resolve_users_preview` | `UserResolver::fetch_users_by_domain` | domain-batching loop | ✓ WIRED | `commands.rs:1274-1277` — `resolver.fetch_users_by_domain(domain).await.unwrap_or_default()` |
| `CopyPreviewPage pre-fill useEffect` | `overrideValues` (copyStore) | `setOverrideValue(descRow.targetFieldId, adf)` and `setOverrideValue(row.targetFieldId, resolvedUser)` | ✓ WIRED | `CopyPreviewPage.tsx:257` and `353` — both call `setOverrideValue` after invoke resolves |
| `dynamicFormFields filter` | description excluded | `f.fieldId !== 'description'` added to filter predicate | ✓ WIRED | `CopyPreviewPage.tsx:467` — filter predicate confirmed |
| `overrideValues.description` (ADF object) | `copy_ticket_v2` override merge | `confirmCopy → invoke args.overrideValues spread` | ✓ WIRED | `copyStore.ts:249` — `...state.overrideValues` spread; PREV-04 test validates description ADF and assignee accountId are present in invoke args |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `CopyPreviewPage.tsx` pre-fill effect | `overrideValues.description` | `invoke('resolve_description_to_adf', { html: descHtml })` → Rust `convert_and_postprocess` → ADF JSON | Yes — real HTML-to-ADF conversion via `htmltoadf` crate | ✓ FLOWING |
| `CopyPreviewPage.tsx` pre-fill effect | `overrideValues[targetFieldId]` (user fields) | `invoke('resolve_users_preview', { users, cloudBaseUrl })` → Rust domain-batched Cloud API lookup → Cloud user object | Yes — real HTTP calls to Cloud `/rest/api/3/user/search`; returns `{ accountId, displayName, emailAddress }` | ✓ FLOWING |
| `copyStore.ts` `confirmCopy` | `args.overrideValues` | `state.overrideValues` spread into `copy_ticket_v2` invoke args | Yes — overrideValues populated by pre-fill effect; flows verbatim | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 3 ADF unit tests pass | `cargo test resolve_description_to_adf` (run from src-tauri) | 3 passed, 0 failed | ✓ PASS |
| 2 domain-grouping unit tests pass | `cargo test preview_user_domain` (run from src-tauri) | 2 passed, 0 failed | ✓ PASS |
| 22 CopyPreviewPage frontend tests pass | `npx vitest run src/features/tickets/__tests__/CopyPreviewPage.test.tsx` | 22 passed, 0 failed | ✓ PASS |
| 34 copyStore frontend tests pass | `npx vitest run src/features/tickets/__tests__/copyStore.test.ts` | 34 passed, 0 failed | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PREV-01 | 25-01, 25-02 | Pre-fill effect invokes `resolve_description_to_adf` for wiki_to_adf row; ADF stored in overrideValues | ✓ SATISFIED | `CopyPreviewPage.tsx:254-267`; test PREV-01 passes |
| PREV-02 | 25-01, 25-02 | Pre-fill effect invokes `resolve_users_preview` for user rows; Cloud user objects stored in overrideValues | ✓ SATISFIED | `CopyPreviewPage.tsx:343-358`; test PREV-02 passes |
| PREV-03 | 25-02 | Description excluded from DynamicTargetForm; shown read-only with 'will be copied' label | ✓ SATISFIED | `CopyPreviewPage.tsx:467` (filter) and `783-802` (read-only block); test PREV-03 passes |

**Note on PREV requirement origin:** PREV-01, PREV-02, PREV-03 IDs are introduced in Phase 25 plan frontmatter and test code. They do not appear in the main `REQUIREMENTS.md` (which covers v0.4.0 requirements DISC-01 through CUTV-04). PREV requirements are phase-internal contracts, not top-level product requirements — this is not a gap.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CopyPreviewPage.test.tsx` | 543–548 | Dead first `currentStoreState` assignment immediately overwritten | ℹ️ Info | No functional impact; dead code only (flagged as IN-01 in code review) |
| `CopyPreviewPage.tsx` | 264, 360 | Stale `overrideValues` closure read in async `.then()` callbacks affects `wasOverridden` audit flag | ⚠️ Warning | Audit `wasOverridden` field can be incorrect if user edits override values during slow resolution; does not affect copy correctness (flagged as WR-02 in code review) |
| `commands.rs` | 1238 | `cloud_base_url` from frontend used directly without origin validation against stored connection meta | ⚠️ Warning | SSRF risk: a compromised WebView could direct credentials to an attacker-controlled URL (flagged as CR-01 in code review — critical finding by code reviewer) |
| `commands.rs` | 352–353 | `setOverrideValue` call in user resolution does not guard against overwriting user-entered values | ⚠️ Warning | User manually entering a picker value before async resolution returns could have it silently overwritten (flagged as WR-03 in code review) |

**Stub classification check:** The `return null;` at `CopyPreviewPage.tsx` line 432 is the cancelled-guard early return in async callbacks — not a stub. All field rendering paths produce real data via Tauri invocations.

**CR-01 SSRF note:** The code review identified this as a critical finding. The Phase 25 code accepts `cloud_base_url` from the frontend and uses it with OS keychain credentials, inconsistent with `fetch_jira_image` which validates URL origin. However:
- The risk requires a compromised WebView (XSS in rendered Jira HTML)
- The copy flow already accepts `target_base_url` from the frontend in `copy_ticket_v2` under the same threat model
- The plan explicitly accepted this as T-25-03 with "same risk profile as copy_ticket_v2 args.target_base_url"

This is a WARNING, not a BLOCKER for the phase goal, but should be addressed in a follow-up security fix.

---

### Human Verification Required

#### 1. Read-Only Description Block Visual Rendering

**Test:** Open copy preview for a ticket that has a multi-paragraph description (HTML in `renderedFields.description`). Observe the target panel.
**Expected:** A read-only block appears with label "Description (will be copied)", showing formatted prose content (not raw JSON), with reduced opacity and no editing affordance. Block appears between GapsSection and DynamicTargetForm.
**Why human:** ADF-to-HTML rendering is visual. Unit tests verify the ADF object reaches overrideValues and the JSX condition is met, but cannot verify DescriptionRenderer renders formatted prose.

#### 2. User Picker Pre-Fill Visual State

**Test:** Open copy preview for a ticket with an assignee whose email domain matches a Cloud user. Before clicking any picker, observe the assignee field.
**Expected:** UserPickerRenderer shows the resolved Cloud user's displayName pre-filled in the input (e.g. "Jane Doe") — not an empty picker.
**Why human:** Pre-filled picker state is visual. Unit tests verify `setOverrideValue('assignee', {...})` is called with the resolved user object, but cannot verify UserPickerRenderer actually renders the displayName in its input field.

#### 3. End-to-End Copy With Pre-Resolved Override

**Test:** Open copy preview, wait for pre-fill to complete (description block visible, user picker pre-filled). Click Copy without any edits. Verify in the target Jira issue that the description is formatted (not plain text, not empty) and the assignee is set to the correct Cloud user.
**Expected:** Copied issue has formatted description and correct assignee — no re-resolution needed at copy time since overrideValues already carry the resolved values.
**Why human:** Requires live Jira connections; cannot be automated in unit/integration tests.

---

### Gaps Summary

No automated gaps found. All 9 must-have truths are verified in the codebase. The phase goal is structurally achieved: both Tauri commands exist and are registered, the frontend pre-fill effect invokes them at preview-open time, resolved values flow into overrideValues, and overrideValues reaches copy_ticket_v2 via confirmCopy.

Three warnings from the code review (CR-01: SSRF, WR-02: stale closure, WR-03: override guard) are noted but do not block the phase goal. They should be addressed in a follow-up.

---

_Verified: 2026-05-05T14:22:00Z_
_Verifier: Claude (gsd-verifier)_
