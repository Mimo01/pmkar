---
phase: 28
slug: foundations
status: verified
threats_open: 0
asvs_level: 1
created: 2026-10-12
---

# Phase 28 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Webview to Rust IPC (groups_commands) | Tauri commands take group id, name, color, issue keys, ticket JSON; scope is never an argument | User-entered strings, ticket JSON (local) |
| Rust to groups SQLite DB | rusqlite params only; scope-filtered | Group names, colors, ticket snapshots |
| Stored color to CSS | Token name stored; mapped to CSS var | Color token string |
| Jira error text to UI | step.detail rendered as React text | Raw error strings |
| Cargo registry to build | unicode-normalization crate | Supply chain |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|-----------------------|--------|
| T-28-01 | Tampering | ticketListUtils.ts drift | mitigate | Characterization commit fec1e51 precedes extraction 7673a35 and page rewire 8403f1a (git log) | closed |
| T-28-02 | DoS | sortTickets | accept | See Accepted Risks | closed |
| T-28-03 | Tampering/XSS | copyStepLabel output | mitigate | grep dangerouslySetInnerHTML = 0 in CopyResultModal.tsx and CopyResultPage.tsx | closed |
| T-28-04 | Info Disclosure | step.detail | accept | See Accepted Risks | closed |
| T-28-05 | Silent regression | Rust step id without i18n key | mitigate | copyStepSync.test.ts:37-38 (ids.length >= 8 guard), :55 per-id key mapping EN/SK | closed |
| T-28-06 | Tampering | stored color to CSS | mitigate | colors.ts:40 isGroupColorToken, :44 groupColorVar; groups_db.rs:189 is_group_color whitelist | closed |
| T-28-07 | Spoofing (UI) | red-like color | mitigate | colors.ts palette has no red; colors.test.ts:74-80 forbids brand/destructive hexes (#c02232, #dc2626 match index.css:5,37). Note: forbidden list is hardcoded, not read from index.css (minor) | closed |
| T-28-08 | SQLi | GroupsDb | mitigate | groups_db.rs uses params! throughout (lines 334-593); grep for format!("SELECT/INSERT/UPDATE/DELETE = 0 | closed |
| T-28-09 | Tampering | input validation | mitigate | groups_db.rs:168 validate_group_name, :189 is_group_color, :281 is_valid_issue_key, :541-546 ticket_json must be Object | closed |
| T-28-10 | Info Disclosure | cross-scope bleed | mitigate | scope in all queries (params![scope,...]); ensure_group_in_scope (groups_db.rs:390) called at 353,454,471,485,517,536,573; scope_isolation test :804 | closed |
| T-28-11 | Integrity | orphans/partial batches | mitigate | PRAGMA foreign_keys=ON groups_db.rs:318,325; ON DELETE CASCADE :230; unchecked_transaction at 486,518,547,574; tests fk_cascade :834, add_members_atomic :943 | closed |
| T-28-12 | Info Disclosure | ticket_json local | accept | See Accepted Risks | closed |
| T-28-13 | DoS | unbounded groups | accept | See Accepted Risks | closed |
| T-28-SC | Supply chain | unicode-normalization | mitigate | 28-04-SUMMARY.md:37-38 records human approval before install; Cargo.toml:41 "0.1"; Cargo.lock:5418 v0.1.25 from registry crates.io-index with checksum | closed |
| T-28-14 | Spoofing/Info Disclosure | scope selection | mitigate | groups_commands.rs:25 resolve_scope from connection_meta; no command (lines 53-144) takes scope arg | closed |
| T-28-15 | Tampering | command args | mitigate | Validation delegated to GroupsDb; direction typed as MoveDirection enum (groups_commands.rs:112,207; groups_db.rs:275) | closed |
| T-28-16 | DoS | mutex deadlock | mitigate | resolve_scope releases triage lock before lock_groups (groups_commands.rs:25-46); try_lock test :283 | closed |
| T-28-17 | DoS | poisoned mutex | mitigate | groups_commands.rs:29,46 map poison to internal(); tests :331, :345 | closed |
| T-28-18 | Info Disclosure | IPC error messages | accept | See Accepted Risks | closed |
| T-28-19 | Tampering | color in style attrs | mitigate | groupStore.ts:96 coerces non-token to 'slate' via isGroupColorToken; no raw group-color style interpolation found in src | closed |
| T-28-20 | Tampering | client validation bypass | accept | See Accepted Risks | closed |
| T-28-21 | DoS | render loop | mitigate | groupStore.ts:140 `?? null`; no `?? []` in selectors; no-loop test groupStore.test.ts:84 | closed |
| T-28-22 | Info Disclosure | ticket JSON to Rust | accept | See Accepted Risks | closed |
| T-28-23 | Stale scope | source change | mitigate | groupStore.ts:75 rehydrateAfter; called at SettingsPage.tsx:569 and SetupWizard.tsx:64; App.tsx effect keyed on [hydrated] only (:82-88); ordering tests SettingsPage.test.tsx:645, SetupWizard.test.tsx:148 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-28-01 | T-28-02 | Same O(n log n) sort algorithm as before refactor | Plan 28-01 | 2026-10-12 |
| AR-28-02 | T-28-04 | Raw step.detail already shown (D-13); local single-user app | Plan 28-02 | 2026-10-12 |
| AR-28-03 | T-28-12 | ticket_json is same data already in snapshots.db; never logged | Plan 28-03 | 2026-10-12 |
| AR-28-04 | T-28-13 | No group cap by design (D-15) | Plan 28-03 | 2026-10-12 |
| AR-28-05 | T-28-18 | Only rusqlite/AppError display strings cross IPC | Plan 28-04 | 2026-10-12 |
| AR-28-06 | T-28-20 | Rust is authoritative validator (D-16) | Plan 28-05 | 2026-10-12 |
| AR-28-07 | T-28-22 | Local IPC only | Plan 28-05 | 2026-10-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None (no `## Threat Flags` sections in 28-01..28-06 SUMMARY files).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-12 | 24 | 24 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-12
