# Quick Task 261109-f5i: When copying, add the id of the original into the beginning of the summary of the target story - Context

**Gathered:** 2026-11-09
**Status:** Ready for planning

<domain>
## Task Boundary

When copying a ticket (source → target), the target ticket's summary should start with the source ticket's key.

</domain>

<decisions>
## Implementation Decisions

### Format
- Plain key + single space: source `PROJ-12` "Fix login" → target summary `PROJ-12 Fix login`.

### Where applied
- Prefill in the Copy Preview: `copyStore.startPreview` seeds `targetSummary` as `${ticket.key} ${ticket.fields.summary}`.
- The user sees the prefix in the Summary field and can edit or remove it. No enforcement at submit time.

### Sub-tasks
- Parent only. Copied sub-tasks (copy_pipeline.rs sub-task creation) keep their original summaries unchanged.

### Claude's Discretion
- Avoid double prefix if the source summary already starts with the source key (e.g. `PROJ-12 ...` or `PROJ-12: ...`) — reasonable guard, planner decides exact rule.
- Applies to any copy entry point that uses `startPreview` (single and bulk if it goes through the same path).
- Update affected tests (copyStore.test.ts, CopyPreviewPage tests) that assert the prefilled summary.

</decisions>

<specifics>
## Specific Ideas

- Seed point: `src/features/tickets/copyStore.ts:95` (`targetSummary: ticket.fields.summary`).
- Submit point: `copyStore.ts:272` (`summary: state.targetSummary`) — unchanged.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
