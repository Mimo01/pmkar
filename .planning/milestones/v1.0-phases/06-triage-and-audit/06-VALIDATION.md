---
phase: 6
slug: triage-and-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | TRIA-01 | unit | `npx vitest run src/features/tickets/TicketDetailPanel.test.tsx` | Partial | ⬜ pending |
| 06-01-02 | 01 | 1 | TRIA-01 | unit | `npx vitest run src/features/tickets/TicketListPage.test.tsx` | Partial | ⬜ pending |
| 06-02-01 | 02 | 1 | TRIA-02 | unit | `npx vitest run src/features/tickets/IgnoredTicketsPage.test.tsx` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | TRIA-02 | unit | `npx vitest run src/features/tickets/IgnoredTicketsPage.test.tsx` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 1 | TRIA-03 | unit | `npx vitest run src/features/tickets/IgnoredTicketsPage.test.tsx` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 1 | TRIA-03 | unit | `npx vitest run src/features/tickets/IgnoredTicketsPage.test.tsx` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 2 | AUDIT-02 | unit | `npx vitest run src/features/tickets/AuditLogPage.test.tsx` | ❌ W0 | ⬜ pending |
| 06-04-02 | 04 | 2 | AUDIT-02 | unit | `npx vitest run src/features/tickets/AuditLogPage.test.tsx` | ❌ W0 | ⬜ pending |
| 06-04-03 | 04 | 2 | AUDIT-02 | unit | `npx vitest run src/features/tickets/AuditLogPage.test.tsx` | ❌ W0 | ⬜ pending |
| 06-04-04 | 04 | 2 | AUDIT-02 | unit | `npx vitest run src/features/tickets/AuditLogPage.test.tsx` | ❌ W0 | ⬜ pending |
| 06-05-01 | 05 | 2 | AUDIT-02 | unit | `npx vitest run src/App.test.tsx` | Partial | ⬜ pending |
| 06-99-01 | — | — | General | manual-only | N/A — requires real Tauri app lifecycle | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/tickets/IgnoredTicketsPage.test.tsx` — stubs for TRIA-02, TRIA-03
- [ ] `src/features/tickets/AuditLogPage.test.tsx` — stubs for AUDIT-02

*Existing test files `TicketDetailPanel.test.tsx`, `TicketListPage.test.tsx`, and `App.test.tsx` need new test cases added for TRIA-01 behavior and footer count. These are modifications, not new files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ignored state persists across app restart | General | Requires real Tauri app lifecycle (SQLite persistence through restart) | 1. Ignore a ticket 2. Close app 3. Relaunch 4. Verify ticket still in ignored list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
