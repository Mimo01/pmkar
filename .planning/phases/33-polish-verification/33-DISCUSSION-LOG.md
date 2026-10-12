# Phase 33: Polish & Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-12
**Phase:** 33-polish-verification
**Areas discussed:** Verification method, Milestone UAT sweep, 25-group scale, Slovak copy review

---

## Verification method

| Question | Options | Selected |
|----------|---------|----------|
| How to verify WCAG AA | Automated + targeted (vitest-axe + keyboard tests) / Keyboard tests only / Manual audit only | Automated + targeted ✓ |
| Enforce no untranslated strings | Static scan test / Runtime missing-key check / Both | Static scan test ✓ |
| Gaps outside group UI | Group UI only, log rest / Fix small ones anywhere | Group UI only, log rest ✓ |
| Contrast beyond palette | Token-level tests (dimmed, hint, Remove) / Palette tests are enough | Token-level tests ✓ |

## Milestone UAT sweep

| Question | Options | Selected |
|----------|---------|----------|
| Consolidated milestone UAT? | Yes, consolidated / Phase 33 items only | Yes, consolidated ✓ |
| Make missing states testable | Mock-server scenario / Dev-only seed button / Both | Mock-server scenario ✓ |
| Seed ~25 groups | Script / test fixture / Create by hand | Other: "skip it". No seeding tooling |
| VoiceOver in UAT | Short VoiceOver pass / Skip VoiceOver | Skip VoiceOver ✓ |

**Notes:** "skip it" was read as: build no seeding tooling, and cover scale with automated tests. This was confirmed in the next area.

## 25-group scale

| Question | Options | Selected |
|----------|---------|----------|
| Overflow affordance | Edge fades + scroll arrows / Edge fades only / Fades + "All groups ▾" list | Edge fades + scroll arrows ✓ |
| Tab width | Keep 160px fixed / Adaptive | Keep 160px ✓ |
| Scale verification | Automated tests only / Optional manual step | Automated tests only ✓ |
| Picker at 25 groups | Keep as is / Pin checked groups on top | Keep as is ✓ |

**Notes:** After the selection, Claude found that the fades and arrows already exist (Phase 29). The decision was recast as "verify and harden".

## Slovak copy review

| Question | Options | Selected |
|----------|---------|----------|
| Quote style | SK „…“ + EN “…” / SK „…“ + EN ‘…’ / No quotes | SK „…“ + EN “…” ✓ |
| Who reviews SK | Claude audits, user spot-checks / User reviews a diff table | Claude audits ✓ |
| Terminology glossary | Yes, in CONTEXT / No, audit ad hoc | Yes ✓ |
| `_many` category | Same as _other + test / Same as _few | Same as _other + test ✓ |

**Notes:** Inconsistencies found: mixed quote marks, inconsistent `_many` forms, and `picker.announceRemoved` missing "skupiny".

## Claude's Discretion

- Axe runner choice and rule configuration (jsdom cannot compute color-contrast)
- Static scan implementation (AST preferred)
- Dimming and token values if contrast tests fail
- Scroll-arrow behaviour at the ends and step size
- Mock-scenario switch mechanism
- Ordering of the consolidated UAT

## Deferred Ideas

- Manual VoiceOver verification
- Group-seeding dev tooling
- a11y and i18n gaps in non-group screens (log only)
