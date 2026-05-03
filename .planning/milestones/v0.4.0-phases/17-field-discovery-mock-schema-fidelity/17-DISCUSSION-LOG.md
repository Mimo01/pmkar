# Phase 17: Field Discovery + Mock Schema Fidelity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 17-field-discovery-mock-schema-fidelity
**Areas discussed:** Cache lifecycle, Probe failure UX, Mock fixture realism, Discovery scope keying

---

## Cache lifecycle

### Q1: When does the app FIRST fetch source v2 + target v3 schemas?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-warm at app launch | Background fetch after probe success. Eliminates 8–15s cold start. Recommended. | ✓ (Claude's discretion) |
| Lazy on first Copy Preview | User eats cold start the first time; needs skeleton/progress UI. | |
| On connection-setup save | Couples discovery to a deliberate user action. | |

**User's choice:** "you decide"
**Notes:** Locked recommendation per harness auto mode and the documented 8–15s cold-start risk in PITFALLS.md item 8.

### Q2: How long should cached schemas live before considered stale?

| Option | Description | Selected |
|--------|-------------|----------|
| Session-bound + manual refresh | Cache lives until app exit OR Refresh click (Phase 21 DISC-05). Recommended. | ✓ (Claude's discretion) |
| TTL 1 hour | Catches mid-session admin changes, costs an extra fetch every hour. | |
| Manual refresh only (persist across restarts) | Most aggressive caching, stale-data risk. | |

**User's choice:** "you decide"
**Notes:** Locked recommendation. Rationale: schemas don't change often; per-session refresh is the simplest mental model and aligns with the manual Refresh button DISC-05 already requires for Phase 21.

### Q3: On (project, issuetype) cache miss in Copy Preview?

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch synchronously, show skeleton | Block the field area with skeleton until createmeta returns. Recommended. | ✓ (Claude's discretion) |
| Open modal optimistically, swap when ready | More complex state machine. | |
| Pre-fetch all issue types eagerly | Expensive if target project has 30+ types. | |

**User's choice:** "you decide"
**Notes:** Locked recommendation. Skeleton is the existing app pattern; deterministic UX.

### Q4: Store schema hash for Phase 21 drift detection (MAP-05)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — hash per (project, issuetype) | SHA-256 of canonicalized schema rows. Cheap insurance. Recommended. | ✓ (Claude's discretion) |
| Yes — hash per field | More granular drift warnings, more storage. | |
| Not yet — defer to Phase 21 | Phase 21 adds it later. | |

**User's choice:** "you decide"
**Notes:** Locked recommendation. Adding the hash column now avoids a schema migration when Phase 21 builds MAP-05.

---

## Probe failure UX

### Q1: Severity when paginated createmeta probe fails at app launch?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft warning banner | App still launches; persistent dismissable banner; gating disabled until probe passes. Recommended. | ✓ (Claude's discretion) |
| Hard block on Copy Preview only | Copy button disabled with tooltip; rest of app works. | |
| Hard block on app launch | Modal at startup, must dismiss/fix to use the app. | |

**User's choice:** "you decide"
**Notes:** Locked recommendation. App stays usable for non-mapping flows (triage, audit log).

### Q2: Fall back to legacy `/createmeta?expand=…` when paginated fails?

| Option | Description | Selected |
|--------|-------------|----------|
| No fallback — paginated only | Forces proxy issues to surface. Recommended. | ✓ (Claude's discretion) |
| Yes — fall back, mark 'degraded' | Works around proxy limits but masks misconfig. | |

**User's choice:** "you decide"
**Notes:** Locked recommendation. Atlassian is deprecating the legacy endpoint; fallback would carry forward technical debt.

### Q3: Error message detail level?

| Option | Description | Selected |
|--------|-------------|----------|
| Specific + actionable | URL, status code, one-line cause hint. Recommended for power users. | ✓ (Claude's discretion) |
| Friendly summary + 'Show details' | Cleaner UI, slower diagnosis. | |
| Generic with link to docs | Defers diagnosis to docs that don't exist yet. | |

**User's choice:** "you decide"
**Notes:** Locked recommendation. Pmkar's audience is power users debugging Jira plumbing.

### Q4: Where does the failure surface?

| Option | Description | Selected |
|--------|-------------|----------|
| App shell banner + Settings→Connections row | Banner + red status pill. Recommended. | ✓ (Claude's discretion) |
| Settings→Connections row only | Less intrusive, easier to overlook. | |
| Toast + connection status icon in header | Lower friction, possibly missed. | |

**User's choice:** "you decide"
**Notes:** Locked recommendation. Hard to miss, fixable in the same place the user goes to fix it. Reuses the existing privacy-mode banner pattern from Phase 16.

---

## Mock fixture realism

### Q1: Custom-field naming convention?

| Option | Description | Selected |
|--------|-------------|----------|
| Atlassian-typical names | customfield_10001 'Story Points', 10002 'Sprint', 10003 'Epic Link', 10004 'Team'. | ✓ |
| Customer-realistic names | Mirror specific customer Jira fields. | |
| Mix (2 standard + 2 customer-style) | Both. | |

**User's choice:** Atlassian-typical names
**Notes:** Keeps fixtures generic so renderer tests don't drift to one customer's quirks.

### Q2: Add cascading select as 5th custom-field fixture?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add cascading select | Tests polymorphic read/write asymmetry early. Recommended. | ✓ (Claude's discretion) |
| No — stick to the locked 4 | Number/multi-select/user/date is enough renderer variety. | |
| Yes, but mark renderer 'unsupported' | Add fixture but Phase 20 returns 'Unsupported' pill. | |

**User's choice:** "you decide"
**Notes:** Locked recommendation (Yes). Phase 20 renderer treatment is decided there — likely the CTRL-07 'Unsupported' pill at first.

### Q3: How many issue types in the mock target project?

| Option | Description | Selected |
|--------|-------------|----------|
| 3: Bug, Task, Story | Different required-field sets exercise OVRD-02. Recommended. | ✓ |
| 2: Bug, Task | Minimum divergence to test gating. | |
| 5: Bug, Task, Story, Epic, Sub-task | Closer to a real project; Epic edge case. | |

**User's choice:** 3 issue types (Bug, Task, Story)
**Notes:** Each issue type has a different required-field set so Phase 22 OVRD-02 (gating re-evaluation on issue-type change) has something real to test against.

### Q4: Which v2 vs v3 shape divergences should the mock reflect? (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| User identity (name/key vs accountId) | Pitfall 1; TRAN-01 test surface. | ✓ |
| Versions/components (name vs id) | Pitfall 9; TRAN-03/04 test surface. | ✓ |
| Priority (object vs id-only) | Tests writer-shape transform. | ✓ |
| Custom-field read/write asymmetry | Pitfall 4; recommended. | ✓ |

**User's choice:** All four selected
**Notes:** Each maps to a documented v2/v3 asymmetry that bit JCMA, Backbone, or Exalate. Mock fixtures need to reproduce these so Phase 18 transformers have realistic test targets.

---

## Discovery scope keying

### Q1: Cache key composition for `field_schema_cache`?

| Option | Description | Selected |
|--------|-------------|----------|
| (side, project_key, issuetype_id) | side ∈ {'source','target'}. Smallest indexes. Recommended. | ✓ |
| (instance_url_hash, project_key, issuetype_id) | Future-proofs for multi-connection. | |
| (side, project_key, issuetype_id, schema_version) | Adds schema_version stamp. YAGNI. | |

**User's choice:** (side, project_key, issuetype_id)
**Notes:** Pmkar is single-connection-pair; instance identity is implicit. Schema-version stamping is YAGNI — drift detection (D-04) handles change cases.

### Q2: For source Jira v2 — fetch per-(project, issuetype) or just `/field` globally?

| Option | Description | Selected |
|--------|-------------|----------|
| Global /field only for source | We only WRITE to target; required-field metadata irrelevant on read side. Recommended. | ✓ |
| Per-(project, issuetype) for source too | Symmetric, no clear payoff. | |
| Global /field + lazy /editmeta | More overhead, edge case. | |

**User's choice:** Global /field only for source
**Notes:** Source schemas exist purely to populate the source-field picker in the mapping editor. No required-field gating is enforced on the read side.

### Q3: For target Jira v3 — eagerly pre-fetch ALL issue types or only on selection?

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy: fetch on issue-type selection in Copy Preview | Smallest network footprint. Recommended. | ✓ |
| Eager: pre-fetch Bug/Task/Story (3 common) | ~3 extra requests per app launch. | |
| Eager: pre-fetch ALL issue types | Maximum hit rate, maximum cold-start cost. | |

**User's choice:** Lazy: fetch on issue-type selection
**Notes:** First Copy Preview per issue type eats one createmeta fetch; subsequent selections of the same type hit cache. Combined with D-01 (pre-warm /field at launch) the only lazy fetch is the per-issuetype createmeta.

### Q4: When user changes target issue type in open Copy Preview (OVRD-02) and not cached?

| Option | Description | Selected |
|--------|-------------|----------|
| Synchronous fetch + skeleton on field area | Disable Copy button, show skeleton. Recommended. | ✓ |
| Stale-while-revalidate | Brief window where displayed fields don't match chosen type. | |
| Block issue-type dropdown until fetched | Worse UX than skeleton. | |

**User's choice:** Synchronous fetch + skeleton
**Notes:** Matches D-03 (Copy Preview cache miss) for consistency.

---

## Claude's Discretion

The user said "you decide" on the following questions; recommended option was locked:

- Cache lifecycle: trigger (D-01), TTL (D-02), miss-handling (D-03), drift hash (D-04)
- Probe failure UX: severity (D-05), fallback (D-06), error message (D-07), surface location (D-08)
- Mock fixtures: cascading-select inclusion (D-10)

Other implementation details delegated to planning:
- Tauri command surface naming (`get_field_schemas`, `probe_createmeta`, etc.)
- Pagination page-size for createmeta (default 50 unless surfaces a clear win)
- Error retry/backoff for transient pre-warm failures
- Serde tag values for the `FieldSchema` enum
- Skeleton UI animation/layout details
- Async runtime choice for the pre-warm fetch (`tauri::async_runtime::spawn` vs existing `tokio` runtime)

## Deferred Ideas

Out of scope for Phase 17, captured for future reference:

- TTL-based cache invalidation — explicitly rejected (D-02 picks session-bound). Could revisit in v0.5.0.
- Eager pre-fetch of all target issue types — explicitly rejected (D-15). Revisit only with telemetry.
- Per-field schema hash — D-04 picks coarser per-(project, issuetype) grain. Phase 21 can refine if needed.
- Legacy `/createmeta?expand=…` fallback — explicitly rejected (D-06).
- Customer-specific mock fixtures — explicitly rejected (D-09 picks generic).
- Auto-refresh of schema cache on modal open — out of scope project-wide per REQUIREMENTS.md.
- Schema discovery for non-configured projects — would change cache key shape (D-13). Out of scope.
