# Requirements: pmkar

**Defined:** 2026-04-27
**Core Value:** Surface relevant tickets from customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.

## v0.4.0 Requirements

Requirements for Configurable Field Mapping milestone. Each maps to roadmap phases (17–23).

### Field Discovery

- [x] **DISC-01**: User can fetch field schemas from source Jira Server v2 including custom fields with type detection _(17-04)_
- [x] **DISC-02**: User can fetch field schemas from target Jira Cloud v3 including custom fields with type detection _(17-04)_
- [x] **DISC-03**: System fetches target required-field metadata per (project, issue type) via paginated `createmeta/{key}/issuetypes/{id}` endpoint _(17-04)_
- [ ] **DISC-04**: Mock Jira server exposes realistic field schemas including ≥4 custom fields (number, multi-select, user, date) covering renderer registry
- [ ] **DISC-05**: User can manually refresh the schema cache via a button in Settings

### Translation Layer (v2 → v3)

- [ ] **TRAN-01**: System translates source user values (Server `name`/`key`) to target Cloud `accountId` for person fields
- [ ] **TRAN-02**: System translates wiki markup to ADF for text and multi-line text fields
- [ ] **TRAN-03**: System translates source version names to target Cloud version IDs by name lookup
- [ ] **TRAN-04**: System translates source component names to target Cloud component IDs by name lookup
- [ ] **TRAN-05**: System fills documented htmltoadf coverage gaps (links, blockquotes, mentions, hard-break, mediaSingle)
- [ ] **TRAN-06**: System batches user lookups in a single pass to avoid N×M HTTP calls during a copy

### Mapping Persistence

- [ ] **MAP-01**: User has a single global source→target field mapping persisted in a separate `mapping.db` SQLite database
- [ ] **MAP-02**: System ships sensible default mappings on first run (description, labels, priority, assignee, reporter)
- [ ] **MAP-03**: User can add custom-field mappings on top of the defaults
- [ ] **MAP-04**: User can edit or remove any default mapping
- [ ] **MAP-05**: System warns user when a saved mapping references a target field that no longer exists in the schema (drift detection via schema hashes)

### Field-Type Controls

- [ ] **CTRL-01**: User sees a target control matching the field type for: text, multi-line text, URL
- [ ] **CTRL-02**: User sees a target control matching the field type for: single user, multi user, group
- [ ] **CTRL-03**: User sees a target control matching the field type for: single select, multi select, labels
- [ ] **CTRL-04**: User sees a target control matching the field type for: components, versions
- [ ] **CTRL-05**: User sees a target control matching the field type for: date, datetime, number
- [ ] **CTRL-06**: User sees a target control matching the field type for: checkboxes, radio
- [ ] **CTRL-07**: User sees a read-only "Unsupported type" pill when a target field type is not in the renderer registry
- [ ] **CTRL-08**: User combobox/picker performance does not degrade with 5,000+ items (virtualized rendering)

### Mapping Editor (Settings)

- [ ] **EDIT-01**: User can open a "Field Mapping" section in Settings showing the current mapping
- [ ] **EDIT-02**: User sees heuristic name-match suggestions for unmapped source fields
- [ ] **EDIT-03**: User can save mapping changes; changes persist across app restarts

### Person Picker

- [ ] **PERS-01**: Person picker is always visible in person and multi-person fields, even when an exact-email match is found
- [ ] **PERS-02**: Person picker pre-fills the target user when the source user's email exactly matches a target user
- [ ] **PERS-03**: User can search target users by name or email in the picker (reuses Phase 16 search infra)
- [ ] **PERS-04**: User sees the picker with no pre-fill (and no error) when source has no email due to Cloud privacy mode

### Per-Copy Override + Required-Field Gating

- [ ] **OVRD-01**: User picks the target issue type at copy time, defaulting to the source-name match
- [ ] **OVRD-02**: System re-evaluates required-field gating when the user changes the target issue type
- [ ] **OVRD-03**: User can override the saved mapping inline in the Copy Preview without mutating saved config
- [ ] **OVRD-04**: Copy button is disabled until all target-required fields have values
- [ ] **OVRD-05**: System surfaces required-but-unmapped target fields inline in the Copy Preview with a clear "fill in or map" affordance
- [ ] **OVRD-06**: Per-copy overrides do not persist after the Copy Preview modal closes (in-memory only)

### Cutover + Audit + Tech Debt

- [ ] **CUTV-01**: A new `copy_ticket_v2` Tauri command consumes the mapping engine end-to-end and replaces the existing `copy_ticket` call site
- [ ] **CUTV-02**: Existing copy paths for comments, attachments, worklogs, sub-tasks, and origin remote link continue to work after cutover (full-pipeline integration test passes)
- [ ] **CUTV-03**: System logs each mapping decision, override, and required-gap fill to the audit log with PII/credential redaction (hash-based default, opt-in verbose mode)
- [ ] **CUTV-04**: System parameterizes the previously-hardcoded `MYPROJ` cloud project key (carries v0.1.0 INT-02 debt forward)

## v0.5.0+ Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Rich-Text Authoring

- **RICH-01**: Real ADF rich-text editor for description and multi-line text fields (Tiptap with custom prosemirror-model schema, or @atlaskit fork)

### Mapping Sophistication

- **MAP2-01**: Value-level select mapping (e.g. source priority "P1" → target "Highest")
- **MAP2-02**: Per-issue-type saved mappings (with explicit config-explosion mitigation)
- **MAP2-03**: Per-project-pair scoped mappings (only meaningful if Pmkar gains multi-connection support)

### Workflow

- **EXPRT-01**: Excel export capability (scope TBD)
- **CONI-01**: CopyResultModal step label i18n coverage (raw strings for some steps)
- **BADGE-01**: Taskbar/dock badge count showing unread change count
- **NHIST-01**: In-app notification history panel

## Out of Scope

Explicitly excluded for v0.4.0. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| `@atlaskit/editor-core` integration | Bundle bomb (2–3 MB+ gzipped, 12 MB total bundle reports), restrictive Atlassian Design Guidelines license, fights shadcn aesthetic. Use textarea + htmltoadf preview instead. |
| Bidirectional sync | Out of scope project-wide (set in v0.1.0); one-time copy with origin tracking remains the model |
| Auto-create custom fields on target | Admin operation, scope creep |
| Persistent per-ticket override drafts | In-memory only is sufficient; persisting drafts adds storage and clearance complexity |
| Conditional mappings ("if X then Y") | Scripting-engine territory; Pmkar avoids the Exalate-style scripted-Groovy direction |
| Scripting engine for transformers | Same as above |
| AI-suggested mappings | Heuristic name-match covers the high-value case; AI is a future polish |
| Bulk apply mapping to multiple tickets | Defeats per-ticket review workflow (already excluded project-wide) |
| Field-history mapping (changelog copy) | Out of scope; origin remote link covers traceability |
| Auto-refresh of schema cache on every modal open | Performance impact; manual refresh + on-launch warm only |
| Real-time mapping validation on every keystroke | Premature optimization; validate on save |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISC-01 | Phase 17 | Pending |
| DISC-02 | Phase 17 | Pending |
| DISC-03 | Phase 17 | Pending |
| DISC-04 | Phase 17 | Pending |
| DISC-05 | Phase 21 | Pending |
| TRAN-01 | Phase 18 | Pending |
| TRAN-02 | Phase 18 | Pending |
| TRAN-03 | Phase 18 | Pending |
| TRAN-04 | Phase 18 | Pending |
| TRAN-05 | Phase 18 | Pending |
| TRAN-06 | Phase 18 | Pending |
| MAP-01 | Phase 19 | Pending |
| MAP-02 | Phase 19 | Pending |
| MAP-03 | Phase 21 | Pending |
| MAP-04 | Phase 21 | Pending |
| MAP-05 | Phase 21 | Pending |
| CTRL-01 | Phase 20 | Pending |
| CTRL-02 | Phase 20 | Pending |
| CTRL-03 | Phase 20 | Pending |
| CTRL-04 | Phase 20 | Pending |
| CTRL-05 | Phase 20 | Pending |
| CTRL-06 | Phase 20 | Pending |
| CTRL-07 | Phase 20 | Pending |
| CTRL-08 | Phase 20 | Pending |
| EDIT-01 | Phase 21 | Pending |
| EDIT-02 | Phase 21 | Pending |
| EDIT-03 | Phase 21 | Pending |
| PERS-01 | Phase 22 | Pending |
| PERS-02 | Phase 22 | Pending |
| PERS-03 | Phase 22 | Pending |
| PERS-04 | Phase 22 | Pending |
| OVRD-01 | Phase 22 | Pending |
| OVRD-02 | Phase 22 | Pending |
| OVRD-03 | Phase 22 | Pending |
| OVRD-04 | Phase 22 | Pending |
| OVRD-05 | Phase 22 | Pending |
| OVRD-06 | Phase 22 | Pending |
| CUTV-01 | Phase 23 | Pending |
| CUTV-02 | Phase 23 | Pending |
| CUTV-03 | Phase 23 | Pending |
| CUTV-04 | Phase 23 | Pending |

**Coverage:**
- v0.4.0 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-27*
*Last updated: 2026-04-27 after initial definition*
