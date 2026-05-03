# Phase 18: v2→v3 Translation Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the Q&A record.

**Date:** 2026-04-27
**Phase:** 18-v2-v3-translation-layer
**Mode:** discuss (interactive)
**Areas discussed:** User resolution failure mode, ADF mention resolution, Unsupported wiki node handling, Version/component lookup caching

---

## Area 1: User Resolution Failure Mode

### Q1: What does apply_mapping return when user can't be resolved to Cloud accountId?
**Options presented:**
- UnresolvedPerson variant (Recommended) — Pipeline completes, typed gap in ResolvedFields. Phase 22 person picker blocks Copy button.
- Pipeline Err — apply_mapping returns Err immediately. Phase 22 can't recover.
- Null + warning — Emit null, log warning, continue. Contradicts 'fail loudly' principle.

**User selected:** UnresolvedPerson variant (Recommended)

---

### Q2: What does the UnresolvedPerson variant carry?
**Options presented:**
- Source identity payload (Recommended) — Carries { source_username, source_key, source_email } for Phase 22 picker pre-fill.
- Field key only — Just the target field key. Empty picker, no pre-fill hint.

**User selected:** Source identity payload (Recommended)

---

### Q3: For Array<User> fields, if some resolve and some don't?
**Options presented:**
- Partial: resolved users + one UnresolvedPerson (Recommended) — 2 resolved accountIds + one UnresolvedPerson. Phase 22 renders resolved normally + shows 'pick manually' slot.
- Fail the whole field — Mark entire multi-user field as UnresolvedPerson if any item unresolved.
- You decide — Leave to planning.

**User selected:** Partial: resolved users + one UnresolvedPerson (Recommended)

---

### Q4: Continue or next area?
**User selected:** Next area

---

## Area 2: ADF Mention Resolution

### Q1: Should [~jdoe] become a real mention ADF node (with accountId) or plain text fallback?
**Options presented:**
- Real mention node (Recommended) — Post-processor resolves to { type: 'mention', attrs: { id: accountId } }. Correct ADF.
- Plain text @jdoe fallback — Convert to plain text. Documented gap-fill, clean separation.

**User selected:** Real mention node (Recommended)

---

### Q2: If mention can't be resolved to Cloud accountId, what does the post-processor emit?
**Options presented:**
- Plain text @jdoe fallback (Recommended) — That mention degrades to '@jdoe' text. Rest of description converts normally.
- Unresolved annotation — Emit '[unresolved mention: jdoe]' highlighted text.

**User selected:** Plain text @jdoe fallback (Recommended)

---

### Q3: Are mention users included in the TRAN-06 batch lookup pass?
**Options presented:**
- Yes — scan description first (Recommended) — Pre-scan description for [~username], add to batch alongside assignee/reporter/custom user fields.
- You decide — Leave batch assembly approach to planner.

**User selected:** Yes — scan description first (Recommended)

---

### Q4: Continue or next area?
**User selected:** Next area

---

## Area 3: Unsupported Wiki Node Handling

### Q1: For unhandled wiki macros, what does the post-processor emit?
**Options presented:**
- Silent drop — Remove unrecognized markup, produce clean ADF. Content inside content-container macros may be lost.
- Annotated placeholder (Recommended) — Replace with '[Not converted: {toc}]'. Gap visible in Cloud ticket.
- You decide — Either approach is defensible.

**User selected:** Annotated placeholder (Recommended)

---

### Q2: Does Phase 18 handle image URL rewriting?
**Options presented:**
- Stays in copy_ticket until Phase 23 — Phase 18 takes pre-processed HTML. Clean separation.
- Phase 18 owns image rewriting — Significant scope expansion.

**User selected:** Stays in copy_ticket until Phase 23

---

### Q3: Continue or next area?
**User selected:** Next area

---

## Area 4: Version/Component Lookup Caching

### Q1: How should the pipeline cache version/component lookup results?
**Options presented:**
- In-memory per session (Recommended) — HashMap lazily populated on first copy, reused for subsequent. Matches Phase 17 D-02 pattern.
- No cache — fresh per copy — 2 extra HTTP calls per copy. Simplest.
- SQLite cache (longer TTL) — Persist in mapping.db. More complex, adds TTL question.

**User selected:** In-memory per session (Recommended)

---

### Q2: If source version/component name has no match in target Cloud project?
**Options presented:**
- UnresolvedVersion/Component variant — Typed gap in ResolvedFields. Phase 22 shows dropdown picker.
- Drop it silently — Skip unresolvable entry. User may not notice.
- Pass name through — Include { name: '1.5.0' } in POST body. Inconsistent outcome.

**User selected:** UnresolvedVersion/Component variant

---

### Q3: Ready for context or more questions?
**User selected:** I'm ready for context

---

## Summary

All 4 areas discussed with no corrections and no scope creep.

Key design theme: **consistent typed-gap pattern** — `UnresolvedPerson`, `UnresolvedVersion`, `UnresolvedComponent` all flow to Phase 22's required-field gating rather than aborting the pipeline. Description-body mentions are best-effort (plain text fallback) vs. field-level persons/versions (gated variants). Image handling and Tauri command wiring explicitly deferred to Phase 23.
