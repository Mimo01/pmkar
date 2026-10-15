# Phase 35: Shared Triage Actions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-15
**Phase:** 35-shared-triage-actions
**Areas discussed:** Undo toast behavior, Link flow + failure handling, Store key preservation, Module API and migration scope

---

## Undo toast behavior
| Option | Selected |
|---|---|
| ~8 seconds | ✓ |
| Sonner default (~4s) | |
| Until dismissed | |

| Undo scope | Selected |
|---|---|
| Works from anywhere | ✓ |
| Dismiss on navigation | |

## Link flow + failure handling
| Deny IPC failure | Selected |
|---|---|
| Roll back + error toast | ✓ |
| Wait for DB, then update store | |

| Link with no key | Selected |
|---|---|
| Shared action navigates to preview | ✓ |
| Return result only, caller decides | |

## Store key preservation / Module API / Verification
User answered "you decide" to all three (key carry strategy, migration scope, restart verification).

## Claude's Discretion
Carry prev copiedKey in shared module; migrate all call sites now; Vitest + hydrate round-trip verification.

## Deferred Ideas
None beyond Phase 36/37 scope.
