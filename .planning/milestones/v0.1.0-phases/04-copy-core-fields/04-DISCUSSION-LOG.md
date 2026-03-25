# Phase 4: Copy — Core Fields - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-22
**Phase:** 04-copy-core-fields
**Areas discussed:** Wiki→ADF translation, Copy preview UI, Field mapping gaps, Copy result feedback

---

## Wiki→ADF Translation

### Translation strategy

| Option | Description | Selected |
|--------|-------------|----------|
| renderedFields HTML→ADF | Use Jira Server's own HTML rendering as intermediate, then convert HTML→ADF nodes | ✓ |
| Wiki markup→ADF directly | Parse wiki markup syntax directly and emit ADF nodes | |
| Plain text fallback | Strip formatting, copy as plain text ADF paragraph | |

**User's choice:** renderedFields HTML→ADF
**Notes:** Leverages Jira's own wiki markup parsing. renderedFields already fetched in Phase 3.

### ADF fidelity level

| Option | Description | Selected |
|--------|-------------|----------|
| Core formatting | Headings, bold/italic, code blocks, links, lists, tables, inline images | ✓ |
| Core + advanced | Above plus mentions, panels, info boxes, macros | |
| Best effort | Convert what we can, pass unrecognized as plain text | |

**User's choice:** Core formatting
**Notes:** Covers 95% of real ticket descriptions.

### Inline image handling

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite URLs to proxy | Keep image refs, rewrite URLs through Rust image proxy | |
| Download and re-upload | Download from source, upload to target, rewrite ADF URLs | ✓ |
| Strip images, note in text | Replace with placeholder text | |

**User's choice:** Download and re-upload
**Notes:** Full fidelity for inline images.

---

## Copy Preview UI

### Preview presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Preview modal | Modal showing target ticket preview with confirm/cancel | |
| Side-by-side diff | Source on left, target on right, highlights differences | ✓ |
| Inline summary card | Summary card below copy button in existing side panel | |

**User's choice:** Side-by-side diff
**Notes:** Makes field mapping gaps immediately visible.

### Diff location

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen modal | Takes over screen, both sides get ~50% width | ✓ |
| Replace side panel | Detail panel transforms into diff view | |
| New page/route | Navigate to dedicated copy preview page | |

**User's choice:** Full-screen modal
**Notes:** Clear focus on the copy decision with enough room for both sides.

### Description preview format

| Option | Description | Selected |
|--------|-------------|----------|
| Rendered HTML | Same renderer as Phase 3 detail view | ✓ |
| Both views | Rendered with toggle to raw ADF JSON | |
| Raw ADF JSON | Show actual ADF structure | |

**User's choice:** Rendered HTML
**Notes:** User sees what ticket will look like, not underlying format.

---

## Field Mapping Gaps

### Status mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Default to 'Open' | Always create with target's default status | |
| Best-effort name match | Try same name, fall back to default | |
| Let user pick | Dropdown in preview for target status selection | ✓ |

**User's choice:** Let user pick
**Notes:** User wants control over all field mappings.

### Assignee mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Leave unassigned + note | No assignee, show warning in preview | |
| Let user pick from target | User dropdown populated from target Jira | |
| Always assign to me | Auto-assign to current user | ✓ |

**User's choice:** Always assign to me
**Notes:** User is copying tickets for their own team's Jira.

### Label handling

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-create labels | Pass through, Jira auto-creates | |
| Skip missing labels | Only copy existing labels | |
| Let user select | Checkboxes in preview, all checked by default | ✓ |

**User's choice:** Let user select
**Notes:** Consistent with user's preference for control over field mappings.

### Priority mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort name match | Try exact match, fall back to default | |
| Let user pick | Dropdown in preview for target priority | ✓ |
| Always use default | Ignore source priority | |

**User's choice:** Let user pick
**Notes:** Consistent with status and label choices — user controls all field mappings.

---

## Copy Result Feedback

### Result presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Result modal with details | Per-item status, link to new ticket | ✓ |
| Toast notification | Brief toast with link, auto-dismisses | |
| Inline on ticket row | Row updates with checkmark and link badge | |

**User's choice:** Result modal with details
**Notes:** Shows exactly what happened during copy.

### Partial failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show partial success | Keep created ticket, show what failed | ✓ |
| Rollback on any failure | Delete ticket if any step fails | |
| Retry failed items | Per-item retry buttons | |

**User's choice:** Show partial success
**Notes:** Created ticket with missing image is better than no ticket.

### Row update after copy

| Option | Description | Selected |
|--------|-------------|----------|
| Triage state + link | Green checkmark + target ticket key badge | ✓ |
| Triage state only | Green checkmark, no link | |
| No row change | Only modal shows result | |

**User's choice:** Triage state + link
**Notes:** Persistent visual record in the ticket list.

---

## Claude's Discretion

- HTML→ADF converter implementation details
- Modal layout, spacing, transition animations
- Loading/progress states during copy
- Error message wording
- Target Jira metadata fetching and caching

## Deferred Ideas

None — discussion stayed within phase scope
