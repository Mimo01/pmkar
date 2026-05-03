# Phase 23: copy_ticket_v2 Wiring + Pipeline Refactor + Audit Hooks - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 23-copy-ticket-v2-wiring
**Areas discussed:** Command cutover strategy, copy_ticket_v2 payload shape, Mapping decision audit design, CopyContext extraction scope

---

## Command Cutover Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Remove copy_ticket entirely | Phase 23 wires confirmCopy → copy_ticket_v2 and deletes the old command + Tauri registration. Clean break. | ✓ |
| Keep both, deprecate copy_ticket | Both commands coexist; old command marked deprecated. Safe fallback but dual-path maintenance debt. | |
| Keep both, no deprecation marker | Silently keep copy_ticket. Leaves dead code and ambiguity about canonical path. | |

**User's choice:** Remove copy_ticket entirely
**Notes:** No dual-path coexistence. Requires verifying no other frontend call sites before deletion.

---

### Input struct vs flat params

| Option | Description | Selected |
|--------|-------------|----------|
| Single input struct | copy_ticket_v2 takes CopyTicketV2Args struct — fixes clippy too_many_arguments lint. | ✓ |
| Flat params like old command | Keep 11+ flat named params with #[allow(clippy::too_many_arguments)]. | |

**User's choice:** Single input struct

---

## copy_ticket_v2 Payload Shape

| Option | Description | Selected |
|--------|-------------|----------|
| No explicit fields — all from overrideValues | Struct carries source_key, URLs, target_issue_type_id, override_values: Map<String, Value>. All field values from mapping engine + overrides. | ✓ |
| Keep explicit fields + add overrideValues | Keep summary, priority_id, labels as named fields + add override_values for the rest. Perpetuates the hybrid model. | |

**User's choice:** No explicit fields — all from overrideValues

---

### Mapping row sourcing

| Option | Description | Selected |
|--------|-------------|----------|
| Load from mapping.db inside the command | copy_ticket_v2 calls get_field_mapping internally via State<MappingDb> injection. | ✓ |
| Frontend passes mapping rows in the struct | Frontend reads mapping rows and passes them to copy_ticket_v2. | |

**User's choice:** Load from mapping.db inside the command

---

## Mapping Decision Audit Design

| Option | Description | Selected |
|--------|-------------|----------|
| New mapping_audit_log table | Separate SQLite table from audit_log HTTP call table. Easier to query and expose separately. | ✓ |
| Same audit_log table, new record type | Reuse AuditDb with a 'type' discriminator. Mixes HTTP calls and mapping decisions. | |

**User's choice:** New mapping_audit_log table

---

### Verbose mode toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent user setting in TriageDb | Boolean flag in TriageDb (audit_verbose). Readable from Settings UI later. | ✓ |
| Environment variable (PMKAR_AUDIT_VERBOSE=1) | Simpler; no DB change. Requires restart to toggle; not UI-accessible. | |

**User's choice:** Persistent user setting in TriageDb

---

## CopyContext Extraction Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Both paths use the shared helpers | Both copy_ticket and copy_ticket_v2 call extracted helpers. Proves helpers before old path is deleted. | ✓ |
| Only copy_ticket_v2 uses extracted helpers | Old copy_ticket stays as-is. Simpler but leaves old monolith unrefactored. | |

**User's choice:** Both paths use shared helpers
**Notes:** Refactoring happens first; then copy_ticket is removed after both paths are verified.

---

### CopyContext struct contents

| Option | Description | Selected |
|--------|-------------|----------|
| Credentials + client + keys (thin struct) | Holds: client, cloud_auth, server_pat, source/target URLs, source_key, target_key, target_project_key. | ✓ |
| Full dependency injection incl. resolvers | Also carries UserResolver, VersionResolver, ComponentResolver from Phase 18. | |

**User's choice:** Credentials + client + keys (thin struct)
**Notes:** Helpers are free functions taking &CopyContext; no methods on CopyContext itself.

---

## Claude's Discretion

- Module placement for CopyContext and helpers (new copy_pipeline.rs or inline in commands.rs)
- Whether mapping_audit_log lives in audit.db or mapping.db
- Exact naming of the audit_verbose column in TriageDb and migration strategy
- Integration test structure (single tokio::test vs split per helper)
- Whether copy_id UUID is generated in Rust or passed from the frontend

## Deferred Ideas

None — discussion stayed within phase scope.
