---
phase: 9
slug: increase-accessibility-aria-compatible-inputs-sufficient-contrast-in-light-and-dark-modes-and-general-a11y-improvements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | D-01 contrast | unit | `npm test -- --run src/index.css` | ✅ | ⬜ pending |
| 09-02-01 | 02 | 1 | D-02 color-only | unit | `npm test -- --run` | ✅ | ⬜ pending |
| 09-03-01 | 03 | 2 | keyboard access | unit | `npm test -- --run src/features/tickets/TicketCard.test.tsx` | ✅ | ⬜ pending |
| 09-04-01 | 04 | 2 | form labeling | unit | `npm test -- --run` | ✅ | ⬜ pending |
| 09-05-01 | 05 | 3 | ARIA semantics | unit | `npm test -- --run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `jest-axe` install — optional but enables automated a11y rule checking (`npm install --save-dev jest-axe @types/jest-axe`)
- [ ] No new test files required — changes tested within existing test files

*Existing test infrastructure covers modified components; new a11y attributes verified via `getByRole`, `getByLabelText` queries in existing tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual contrast passes in both themes | D-01 | Color rendering requires visual inspection | Toggle light/dark mode, verify text readability on all pages |
| Focus indicators visible | Focus styles | Visual check needed | Tab through all interactive elements, verify visible focus ring |
| Screen reader announces correctly | ARIA attrs | Requires screen reader | Use VoiceOver to navigate main flows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
