# Phase 37: Consistency, Accessibility and UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-15
**Phase:** 37-consistency-accessibility-and-uat
**Areas discussed:** Consistency proof, Screen-reader announcements, Keyboard & focus audit, WebView2 checklist scope

---

## Consistency proof

| Option | Description | Selected |
|--------|-------------|----------|
| Automated invariant test + UAT | Vitest invariant plus short manual pass | |
| Automated test only | Vitest invariant, no manual consistency steps | ✓ |
| Manual UAT only | Checklist steps by eye | |

**User's choice:** Automated test only

---

## Screen-reader announcements

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated live region | App-level polite aria-live updated by triageActions | ✓ |
| Rely on sonner toasts | Link-restore would be silent | |
| Both | Risk of double announcement | |

**User's choice:** Dedicated live region (recommended)

---

## Keyboard & focus audit (Undo access)

| Option | Description | Selected |
|--------|-------------|----------|
| Verify toast reachability only | Audit and document; Not mine buttons are the fallback | ✓ |
| Add Undo shortcut | New capability | |
| Longer toast when keyboard used | Needs modality detection | |

**User's choice:** Verify toast reachability only (recommended)

---

## WebView2 checklist scope

| Option | Description | Selected |
|--------|-------------|----------|
| One UAT file, fold Phase 36 items in | 37-HUMAN-UAT.md absorbs 2 pending 36 items | ✓ |
| Separate, keep 36 items as is | | |
| Narrator only | | |

**User's choice:** One UAT file, fold Phase 36 items in (recommended)

---

## Claude's Discretion

- Double-announcement avoidance, live-region placement/API, announcement wording, invariant fixture set.

## Deferred Ideas

- Undo keyboard shortcut; longer toast on keyboard use.
