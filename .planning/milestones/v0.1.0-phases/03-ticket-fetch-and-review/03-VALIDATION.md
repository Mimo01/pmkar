---
phase: 3
slug: ticket-fetch-and-review
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1 + @testing-library/react 16.3 |
| **Config file** | `vitest.config.ts` (project root) |
| **Setup file** | `src/test-setup.ts` (jest-dom + WebCrypto polyfill) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | FETCH-06 | unit | `npm test -- src/features/tickets/` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | FETCH-10 | unit | `npm test -- src/features/tickets/` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | FETCH-04 | unit | `npm test -- src/features/tickets/` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | FETCH-01,02,03 | unit | `npm test -- src/features/tickets/TicketListPage` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | FETCH-12 | unit | `npm test -- src/features/tickets/` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 1 | FETCH-04 | unit | `npm test -- src/features/tickets/TicketDetailPanel` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 1 | FETCH-05 | unit | `npm test -- src/features/tickets/` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 1 | FETCH-06 | unit | `npm test -- src/features/tickets/` | ❌ W0 | ⬜ pending |
| 03-03-04 | 03 | 1 | FETCH-07 | unit | `npm test -- src/features/tickets/` | ❌ W0 | ⬜ pending |
| 03-03-05 | 03 | 1 | FETCH-08,09 | unit | `npm test -- src/features/tickets/` | ❌ W0 | ⬜ pending |
| 03-03-06 | 03 | 1 | FETCH-10 | unit | `npm test -- src/features/tickets/` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | FETCH-11 | unit | `npm test -- src/features/connections/SettingsPage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/tickets/TicketListPage.test.tsx` — stubs for FETCH-01/02/03, FETCH-12
- [ ] `src/features/tickets/TicketDetailPanel.test.tsx` — stubs for FETCH-04 through FETCH-10
- [ ] `src/features/connections/SettingsPage.test.tsx` — extend for FETCH-11
- [ ] Mock server worklog endpoint: `GET /rest/api/2/issue/{key}/worklog` in `mock_server.rs`
- [ ] Mock server changelog: add `changelog.histories` to fixture data + detail handler
- [ ] Fixture fields: add `labels`, `components`, `fixVersions`, `updated` to PROJ-1 and PROJ-2

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Side panel slides from right with animation | FETCH-04 | CSS animation visual | Open any ticket row → panel slides in from right |
| Image proxy renders inline images | FETCH-04 | Requires live Jira with embedded images | Add image to test ticket description → verify renders in detail panel |
| Triage state survives restart | FETCH-12 | Requires full app restart cycle | Fetch tickets → mark one seen → close and reopen app → verify state preserved |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
