# Phase 16: Enhanced Watch Configuration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 16-enhanced-watch-configuration
**Areas discussed:** Domain input UX, Resolution & confirmation flow, Privacy warning behavior, Storage & integration

---

## Domain input UX

### Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inside Watched Users section | Add a "By domain" sub-section below the existing individual user search. Keeps all watch config in one place. | ✓ |
| Separate nav section | New "Domain Selectors" nav item in Settings sidebar, alongside Watched Users. | |
| Dialog triggered from Watched Users | A button in Watched Users that opens a modal for domain entry and resolution. | |

**User's choice:** Inside Watched Users section (Recommended)
**Notes:** None

### Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-prepend @ and validate format | User types 'acme.com' or '@acme.com' — both accepted. Invalid formats show inline error. | ✓ |
| Strict @ required | User must type '@acme.com'. Reject without @. | |
| Free text, validate on search | Accept anything, let Jira search results determine if it's valid. | |

**User's choice:** Auto-prepend @ and validate format (Recommended)
**Notes:** None

---

## Resolution & confirmation flow

### Results UI

| Option | Description | Selected |
|--------|-------------|----------|
| Checklist table with select-all | Table showing name, email, avatar. Checkboxes per user with select-all toggle. | |
| Chip list, all pre-selected | Show matched users as removable chips, all selected by default. | |
| Auto-add all, review after | All matched users added immediately. User can remove after. | |

**User's choice:** "You decide"
**Notes:** Deferred to Claude's discretion

### Search UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expansion below input | Results appear in expandable area below domain input field. | |
| Modal dialog | Dialog opens showing search progress and results. | |
| Navigate to results page | Full-page view for reviewing domain matches. | |

**User's choice:** "You decide"
**Notes:** Deferred to Claude's discretion

---

## Privacy warning behavior

### Warning style

| Option | Description | Selected |
|--------|-------------|----------|
| Inline banner with guidance | Yellow warning banner below search results. Non-blocking. | ✓ |
| Modal warning | Blocking dialog explaining the privacy issue. | |
| Toast notification | Brief toast message at the bottom of the screen. | |

**User's choice:** Inline banner with guidance (Recommended)
**Notes:** None

### Warning trigger

| Option | Description | Selected |
|--------|-------------|----------|
| On empty results only | Show warning only when domain search returns zero users. | |
| Always for Cloud connections | Always show a disclaimer that Cloud email privacy may affect results. | |
| Pre-check API capability | Before searching, test if the Cloud instance exposes email fields. | |

**User's choice:** "You decide"
**Notes:** Deferred to Claude's discretion

---

## Storage & integration

### Storage model

| Option | Description | Selected |
|--------|-------------|----------|
| Merge into same watchedUsers list | Domain-resolved users added to the same flat list. Simple, consistent. | |
| Separate domain_selectors + resolved_users | Store domain rules separately. Enables re-resolving later. | |
| Tagged entries | Same list but each entry tracks its source (manual vs domain). | |

**User's choice:** "You decide"
**Notes:** Deferred to Claude's discretion

### Dedup behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Single entry, no duplicates | Dedup silently. One entry per user regardless of source. | ✓ |
| Show both with source tag | Keep both entries visible with different source indicators. | |

**User's choice:** Single entry, no duplicates (Recommended)
**Notes:** None

---

## Claude's Discretion

- Results UI design (table, chips, selection mechanism)
- Search UX (inline, modal, or other)
- Privacy warning trigger timing
- Storage model (flat merge vs separate domain tracking)

## Deferred Ideas

None — discussion stayed within phase scope
