---
phase: 32
slug: durability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-12
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.1 (jsdom, @testing-library/react) + Rust `cargo test` (inline `#[cfg(test)]` modules) |
| **Config file** | `vitest.config.ts` (setup `src/test-setup.ts`); `src-tauri/Cargo.toml` |
| **Quick run command** | `npx vitest run src/features/groups src/features/tickets/__tests__/ticketStore.test.ts src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx` / `cargo test --manifest-path src-tauri/Cargo.toml groups_` |
| **Full suite command** | `npm test && cargo test --manifest-path src-tauri/Cargo.toml && npm run lint` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched area (vitest paths or `cargo test groups_`)
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite green plus `npm run build` type check
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Filled in by the planner and executor per task. Requirement-level map comes from 32-RESEARCH.md § Validation Architecture:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| GDUR-01 | Refresh never changes membership; absent member still renders from snapshot | Rust unit + component | `cargo test ... refresh_snapshots_never_changes_membership`; `npx vitest run src/features/groups/__tests__/GroupViewPage.test.tsx` | ❌ W0 / extend | ⬜ pending |
| GDUR-02 | Absent member renders from snapshot | component | `npx vitest run src/features/groups/__tests__/useGroupMembers.test.tsx` | ✅ | ⬜ pending |
| GDUR-03 | Dimmed content, hint text, labelled Remove, popover confirm, single-key removal | component | `npx vitest run src/features/groups/__tests__/GroupViewPage.test.tsx src/features/tickets/__tests__/TicketCard.test.tsx` | extend / ❌ W0 | ⬜ pending |
| GDUR-04 | Hint gating: before first fetch, partial, truncated, all-failed, thrown, query/settings change | store + component | `npx vitest run src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx src/features/tickets/__tests__/ticketStore.test.ts` + new signature/eligibility tests | ❌ W0 | ⬜ pending |
| GDUR-05 | Remove all missing: subheading count, menu item visibility, popover confirm, one atomic call | component | `npx vitest run src/features/groups/__tests__/GroupViewPage.test.tsx src/features/groups/__tests__/GroupMenuItems.test.tsx src/features/groups/__tests__/GroupTabStripOverlays.test.tsx` | extend / ❌ W0 | ⬜ pending |
| GDUR-06 | Snapshot refresh UPDATE-only, scope-bound; GC after remove/delete; frontend invokes refresh with member keys; `snapshotRevision` reload | Rust unit + component + hook | `cargo test --manifest-path src-tauri/Cargo.toml groups_`; handleFetch + useGroupMembers tests | ❌ W0 | ⬜ pending |
| i18n | EN/SK keys with plural forms | unit | `npx vitest run src/features/groups/__tests__/groupI18n.test.ts` | extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/groups_db.rs` tests: `refresh_snapshots` (members only, no insert, unchanged JSON not rewritten, scope isolation, invalid input) and GC regression for remove / remove-all / delete
- [ ] `src-tauri/src/groups_commands.rs` test: `refresh_group_snapshots_inner` (Rust-derived scope, NoScope error)
- [ ] Frontend: fetch-signature + hints-eligibility tests; completeness cases in `TicketListPage.handleFetch.test.tsx`
- [ ] No framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual dimming reads correctly in light/dark theme; controls undimmed | GDUR-03 | Visual opacity perception | Group an issue, mark it Done in mock server, refetch, open group view in both themes |
| Menu missing-count vs visible cards when a snapshot is unreadable | GDUR-05 | Edge case flagged by research (open question) | Corrupt a snapshot row, confirm counts during UAT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
