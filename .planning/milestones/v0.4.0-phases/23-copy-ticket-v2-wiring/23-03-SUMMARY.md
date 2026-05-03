---
phase: 23-copy-ticket-v2-wiring
plan: "03"
subsystem: copy-command
tags:
  - copy-ticket-v2
  - apply-mapping
  - audit-hooks
  - command-cutover
  - frontend-ipc-swap
  - phase-23
dependency_graph:
  requires:
    - 23-01  # copy_pipeline.rs with CopyContext + 5 helpers
    - 23-02  # insert_mapping_audit + hash_field_value + redact_credential_value + get_audit_verbose
  provides:
    - copy_ticket_v2 Tauri command (CUTV-01)
    - audit logging of every mapping decision (CUTV-03)
    - target_project_key from settings (CUTV-04)
    - frontend confirmCopy IPC swap (D-03)
  affects:
    - src-tauri/src/commands.rs
    - src-tauri/src/main.rs
    - src/features/tickets/copyStore.ts
tech_stack:
  added: []
  patterns:
    - "CopyTicketV2Args single-struct args pattern (D-02) — State injection via 4 params: args + 3 Arc<Mutex<Db>>"
    - "Two-phase apply_mapping pipeline: UserResolver.resolve_batch then apply_mapping"
    - "Audit loop: per-row SHA-256 hash with credential redaction, verbose toggle (raw= prefix)"
    - "Override merge: resolved.fields extended with args.override_values after audit phase"
    - "Soft-error vs hard-error: HTTP step failures return Ok(CopyTicketResult{target_key:None,...}); infrastructure failures return Err(AppError)"
key_files:
  created: []
  modified:
    - src-tauri/src/commands.rs
    - src-tauri/src/main.rs
    - src/features/tickets/copyStore.ts
    - src/features/tickets/CopyPreviewModal.test.tsx
decisions:
  - "[Phase 23-03] copy_ticket_v2 uses crate::copy_pipeline:: fully-qualified paths rather than use imports — avoids collision with plan-01 use crate::copy_pipeline imports already at top of file"
  - "[Phase 23-03] rewrite_image_urls and extract_image_urls removed — only used by old copy_ticket; the new v2 path does not do two-pass image URL rewriting (images are handled via copy_pipeline helpers)"
  - "[Phase 23-03] Pre-existing clippy errors in test files (probe_createmeta.rs, field_transform tests) are out of scope — confirmed pre-existing via git stash check; lib target passes cleanly"
  - "[Phase 23-03] CopyPreviewModal.test.tsx 17 failures pre-existing (computeGapFields undefined length) — confirmed identical count before and after our changes"
metrics:
  duration: "28 min"
  completed: "2026-04-28T19:10:37Z"
  tasks: 2
  files: 4
---

# Phase 23 Plan 03: copy_ticket_v2 Cutover + Frontend IPC Swap Summary

One-liner: `copy_ticket_v2` Tauri command driving the full mapping pipeline end-to-end — apply_mapping, audit logging with credential redaction, override merge, and CopyContext helper delegation — replacing `copy_ticket` at all call sites.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add copy_ticket_v2 command + remove old copy_ticket | 1421518 | commands.rs, main.rs |
| 2 | Frontend confirmCopy IPC swap | 6f29eed | copyStore.ts, CopyPreviewModal.test.tsx |

## Final Shape of CopyTicketV2Args

```rust
#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CopyTicketV2Args {
    pub source_key: String,
    pub source_base_url: String,
    pub target_base_url: String,
    pub target_issue_type_id: String,
    pub override_values: serde_json::Map<String, serde_json::Value>,
}
```

## copy_ticket_v2 Function Size

~305 LOC (function body; `#[allow(clippy::too_many_lines)]` applied per plan)

## Frontend Test Files Updated

- `src/features/tickets/copyStore.ts` — invoke call replaced with `copy_ticket_v2` + single `args` object
- `src/features/tickets/CopyPreviewModal.test.tsx` — test description string updated (no behavioral mock changes needed; tests use `mockConfirmCopy` not direct invoke assertions)

## MYPROJ Literal Check

```
grep -c "MYPROJ" src-tauri/src/commands.rs
0
```

No MYPROJ literal in commands.rs. `target_project_key` flows from `triage_db.get_target_project_key()` through `CopyContext` to all helpers and the create-issue POST body.

## Test Results Post-Cutover

- Rust tests: all pass (75/75)
- Frontend tests: 682 passed, 17 pre-existing failures in CopyPreviewModal.test.tsx (computeGapFields TypeError — pre-existing, confirmed via stash check)
- TypeScript: 1 pre-existing error in connectionStore.probe.test.ts (unused import)
- Clippy lib target: passes cleanly; pre-existing errors in test files unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed dead helper functions after copy_ticket deletion**
- **Found during:** Task 1
- **Issue:** `rewrite_image_urls` and `extract_image_urls` were only used by the old `copy_ticket`. After deleting the function, these became dead code that would trigger clippy warnings.
- **Fix:** Removed both functions and the `// --- Copy ticket command ---` section comment.
- **Files modified:** `src-tauri/src/commands.rs`
- **Commit:** 1421518

**2. [Rule 1 - Bug] Removed unused copy_pipeline wildcard import**
- **Found during:** Task 1
- **Issue:** The `use crate::copy_pipeline::{add_remote_link, copy_attachments, ...}` import at line 6-8 was added by Plan 23-01 for the old `copy_ticket`. The new `copy_ticket_v2` uses fully-qualified `crate::copy_pipeline::` paths, making the import unused.
- **Fix:** Removed the import block. Used fully-qualified paths in copy_ticket_v2 body.
- **Files modified:** `src-tauri/src/commands.rs`
- **Commit:** 1421518

**3. [Rule 1 - Bug] Fixed doc_markdown clippy warnings in new doc comments**
- **Found during:** Task 1 (clippy run)
- **Issue:** Function names like `copy_ticket_v2`, `apply_mapping`, `override_values`, `target_project_key`, `mapping_audit_log` in doc comments need backticks per `clippy::doc_markdown`.
- **Fix:** Wrapped all bare identifiers in backticks in the new doc comments.
- **Files modified:** `src-tauri/src/commands.rs`
- **Commit:** 1421518

## Known Stubs

None. `copy_ticket_v2` is fully wired: it loads real mapping rows from FieldMappingDb, calls the real `apply_mapping` pipeline, inserts real audit rows, and creates a real issue in Cloud Jira.

## Threat Surface Scan

No new threat surface introduced beyond what is documented in the plan's threat_model. The command registers as a Tauri IPC endpoint (`copy_ticket_v2`) which was the intended replacement. All mitigations from T-23-11 through T-23-16 are implemented:
- T-23-11: `redact_string_in_value` walks full JSON tree before hashing and before raw-string serialization
- T-23-12: `get_target_project_key` returns Err when NULL; no frontend-supplied project key
- T-23-14: `let _ = mdb.insert_mapping_audit(...)` — audit failures silent, copy proceeds
- T-23-15: `&s[..s.len().min(4096)]` cap on verbose-mode raw values

## Self-Check: PASSED

- FOUND: src-tauri/src/commands.rs
- FOUND: src-tauri/src/main.rs
- FOUND: src/features/tickets/copyStore.ts
- FOUND commit: 1421518 (feat(23-03): add copy_ticket_v2...)
- FOUND commit: 6f29eed (feat(23-03): swap frontend confirmCopy...)
