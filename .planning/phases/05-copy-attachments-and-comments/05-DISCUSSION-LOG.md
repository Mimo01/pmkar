# Phase 5: Copy — Attachments and Comments - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-22
**Phase:** 05-copy-attachments-and-comments
**Areas discussed:** Comment attribution, Attachment copy scope, Sub-task copy behavior, Linked issue handling

---

## Comment Attribution

### Q1: How should original author and date be shown in copied comments?

| Option | Description | Selected |
|--------|-------------|----------|
| Bold prefix line | Each comment starts with: **[Author] — date** followed by body on next line | ✓ |
| Blockquote wrapper | Original comment in a blockquote with attribution header | |
| Inline prefix | Compact single-line prefix: [Author, date]: then body | |

**User's choice:** Bold prefix line
**Notes:** Clean and scannable format preferred

### Q2: Should comment bodies be converted from wiki markup to ADF?

| Option | Description | Selected |
|--------|-------------|----------|
| Wiki→ADF conversion | Same renderedFields HTML→ADF pipeline as descriptions, reuses Phase 4 converter | ✓ |
| Plain text only | Strip all formatting, copy as plain text | |
| You decide | Claude picks the best approach | |

**User's choice:** Wiki→ADF conversion

### Q3: Should all comments be copied, or should the user choose which ones?

| Option | Description | Selected |
|--------|-------------|----------|
| All comments automatically | Every comment copied, matches 'full mirror copy' principle | ✓ |
| User selects per-comment | Checkboxes on each comment in preview | |

**User's choice:** All comments automatically

### Q4: Should comments be posted in chronological order?

| Option | Description | Selected |
|--------|-------------|----------|
| Chronological order | Posted oldest-first so thread reads naturally, each has original timestamp in attribution | ✓ |
| Single combined comment | All comments merged into one long comment with separator lines | |

**User's choice:** Chronological order

---

## Attachment Copy Scope

### Q1: Should all attachments be copied automatically, or should the user select which ones?

| Option | Description | Selected |
|--------|-------------|----------|
| All attachments automatically | Every attachment downloaded and uploaded, matches 'full mirror copy' | ✓ |
| User selects in preview | Checkboxes per attachment in preview modal | |
| All with size limit | Copy all under configurable size threshold | |

**User's choice:** All attachments automatically

### Q2: How should attachment progress be reported during copy?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-file status in result modal | Same result modal pattern as Phase 4 D-11, each attachment as a step | ✓ |
| Live progress during upload | Real-time upload progress bar per file | |
| You decide | Claude picks the approach | |

**User's choice:** Per-file status in result modal

---

## Sub-task Copy Behavior

### Q1: How much content should be copied for each sub-task?

| Option | Description | Selected |
|--------|-------------|----------|
| Core fields only | Sub-tasks get summary, description, status, priority — no attachments/comments | |
| Full mirror | Each sub-task also gets attachments, comments, work log | |
| You decide | Claude picks based on trade-offs | |

**User's choice:** Other — "Subtasks shouldn't be copied in full, only mentioned in the copy"
**Notes:** User wants sub-tasks referenced but not created as child issues

### Q2: How should sub-tasks be mentioned in the copied ticket?

| Option | Description | Selected |
|--------|-------------|----------|
| List in description footer | Append a 'Sub-tasks' section at bottom of description listing key + summary | ✓ |
| Separate comment | Add a comment listing all sub-tasks | |
| Skip sub-tasks entirely | No sub-task reference at all | |

**User's choice:** List in description footer

---

## Linked Issue Handling

### Q1: How should linked issues be represented in the copied ticket?

| Option | Description | Selected |
|--------|-------------|----------|
| List in description footer | Append a 'Linked Issues' section listing link type + key + summary | ✓ |
| Remote links on target ticket | Create Jira remote links pointing back to each linked issue | |
| Both (description + remote links) | Description footer AND remote links | |

**User's choice:** List in description footer

---

## Claude's Discretion

- Attachment download/upload concurrency strategy
- Error handling for individual failures within partial-success model
- Mock server enhancements for testing
- Preview modal display of attachment/comment/sub-task/linked-issue counts
- Work log API details and mock support

## Deferred Ideas

None — discussion stayed within phase scope
