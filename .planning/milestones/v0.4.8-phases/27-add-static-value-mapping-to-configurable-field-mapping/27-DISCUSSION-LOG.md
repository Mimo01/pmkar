# Phase 27: Add static value mapping to configurable field mapping - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 27-add-static-value-mapping-to-configurable-field-mapping
**Areas discussed:** Mapping trigger model, Value authoring UX, Field type scope, GapsSection integration

---

## Mapping trigger model

| Option | Description | Selected |
|--------|-------------|----------|
| Target-only (no source field) | Static rows have no source_field_id — pick target + value only | ✓ |
| Source-linked (source required) | Static rows still require a source field; its value is ignored at runtime | |
| Both — source optional | Source field is optional for static rows | |

**User's choice:** Target-only (no source field)
**Notes:** Pure target assignment — no source field needed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic source_field_id sentinel | `__static__{target_field_id}` keeps existing PK intact | (Claude) |
| Separate static_mapping table | New table keyed on target_field_id | |

**User's choice:** Claude's discretion → synthetic sentinel chosen.

---

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Add static value' button | Dedicated button in FieldMappingSection | (Claude) |
| Same 'Add row' flow, source optional | Extend existing add-row dialog | |
| Transformer-triggered | Pick source, change transformer to Static | |

**User's choice:** Claude's discretion → dedicated button chosen.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Same list, visually distinct | Static badge in source column, same list | ✓ |
| Separate 'Static values' sub-section | Two separate sections in FieldMappingSection | |

**User's choice:** Same list, visually distinct.

---

## Value authoring UX

| Option | Description | Selected |
|--------|-------------|----------|
| Smart widget per field type | Text for strings/numbers; dropdown for option fields | ✓ |
| Plain text always | Single text input for all types | |
| Raw JSON entry | Free-form JSON input | |

**User's choice:** Smart widget per field type.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in MappingRow (4th column) | Value input appears as 4th column in same row | (Claude) |
| Expand-on-click panel below row | Chevron toggle reveals value editor | |

**User's choice:** Claude's discretion → inline 4th column chosen.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Target field first, then value input | Progressive disclosure: target → value widget appears | (Claude) |
| Single form with both inputs | Popover/dialog with target + value together | |

**User's choice:** Claude's discretion → target first, then value input chosen.

---

## Field type scope

| Option | Description | Selected |
|--------|-------------|----------|
| All non-user field types | String, number, date, option, multi-option, labels. Excludes user fields. | ✓ |
| String + option fields only | MVP subset | |
| All types including user | User fields with raw accountId | |

**User's choice:** All non-user field types.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Static priority via override_values (client-side) | Consistent with existing priority handling | |
| Static priority via pipeline (server-side) | Bypass priority skip guard | |
| Exclude priority from Phase 27 | Already has dedicated override mechanism | ✓ |

**User's choice:** Exclude priority from Phase 27.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Comma-separated text input | User types "backend, urgent"; pipeline splits | ✓ |
| Tag/chip input | Chip component for each label | |

**User's choice:** Comma-separated text input for labels.

---

## GapsSection integration

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — include gap resolution | Static mapping removes required field from GapsSection block | |
| No — gap resolution is follow-up | Ship static storage + UI + pipeline; gap wiring later | |

**User's choice:** No extra wiring needed. User clarified: gap resolution now checks actual values (not mapping presence), so static values satisfy gaps naturally through the pipeline.

---

## Claude's Discretion

- **DB primary key:** Synthetic `__static__{target_field_id}` sentinel preserves existing UNIQUE PK without schema migration.
- **Add row UX:** Dedicated "Add static value" button rather than extending the existing add-row flow.
- **Value widget placement:** Inline 4th column in the static row.
- **Add flow sequence:** Target field first, value widget appears after selection (progressive disclosure).

## Deferred Ideas

- Static user field values (assignee/reporter with hardcoded accountId) — accountIds are Cloud-instance-specific, complex to configure.
- Static priority mapping — already has a dedicated override in copy preview; revisit if users request it.
- Per-issue-type static values — global scope is Phase 27; per-issue-type would be a significant extension.
