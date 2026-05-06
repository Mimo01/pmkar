# Phase 26: Batch Ticket Fetching per Watched User - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 26-batch-ticket-fetching-per-watched-user
**Areas discussed:** Fetch architecture, Progressive rendering, Concurrency & failure handling, Poll engine scope

---

## Fetch Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend splits — N invoke() calls | TS issues one invoke('fetch_tickets') per user (+ one for 'mine'). No new Rust command. | ✓ |
| New Rust command | Add fetch_tickets_batched to commands.rs, spawns tokio::task per user | |

**User's choice:** Frontend splits — N invoke() calls

### JQL shape per batch

| Option | Description | Selected |
|--------|-------------|----------|
| Same 3 clauses per user (assignee, comment~, description~) | Preserves existing semantics | |
| Assignee only per watched user; assignee + watchedIssues() for mine | Simpler, drops noisy mention searches | ✓ |

**User's choice:** Free text — "Simplify everything to just where watched users are an assignee. For mine, only where I am assignee or watcher. That means you can drop the comment/description search."

---

## Progressive Rendering

### Update strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Append as each batch arrives | Each batch immediately updates store; list grows incrementally | |
| Wait for all, then render | Promise.all waits; single store update at end | ✓ |

**User's choice:** Wait for all, then render

### Loading indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Same spinner as today | No per-user progress | |
| Progress counter ("2/5 users fetched") | Track resolved batch count; give user progress feedback | ✓ |

**User's choice:** Progress counter (e.g. '2/5 users fetched')

---

## Concurrency & Failure Handling

### Concurrency model

| Option | Description | Selected |
|--------|-------------|----------|
| All N in parallel | Promise.all fires all at once; fastest | |
| Bounded concurrency (e.g. 3 at a time) | Rate-limit protection; moderate complexity | |
| One at a time (sequential) | Simple loop; no semaphore | ✓ |

**User's choice:** Free text — "One at a time"

### Failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show partial results, surface per-user error | Continue on failure; warn about failed users | ✓ |
| Fail the whole fetch | Abort on first error; same as today | |

**User's choice:** Show partial results, surface per-user error

### Deduplication

| Option | Description | Selected |
|--------|-------------|----------|
| Dedup by key, first-seen wins | Skip duplicates as they arrive; simple | ✓ |
| Dedup by key, merge extra fields | Check for field conflicts; unnecessary complexity | |

**User's choice:** Dedup by ticket key, first-seen wins

---

## Poll Engine Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Keep poll_engine as-is — combined JQL | Watermark already narrows results; low risk | ✓ (Claude's discretion) |
| Update poll_engine too | Full consistency; per-user watermarks needed | |

**User's choice:** "You decide"

---

## Claude's Discretion

- **Poll engine scope:** Keep `poll_engine.rs` unchanged with combined JQL. The timestamp watermark (`updated >= "<ts>"`) narrows results sufficiently. Per-user watermarks would add complexity that doesn't serve the phase goal.

## Deferred Ideas

- Parallel fetching with bounded concurrency — sequential chosen for now; revisit if load times remain slow with large watch lists
- Poll engine per-user batching — out of scope for Phase 26; could be its own phase
- Per-user custom JQL configuration — out of scope
