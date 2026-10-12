# Phase 29: Tab Strip & Group View - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-12
**Phase:** 29-Tab Strip & Group View
**Areas discussed:** Create flow (＋), Tab strip anatomy & overflow, Group view cards & badge, Empty state & pre-31 testing

---

## Create flow (＋)

| Option | Description | Selected |
|--------|-------------|----------|
| Popover | Anchored to ＋; name input, inline error, Cancel/Create; Enter/Esc | ✓ |
| Inline tab input | ＋ becomes a text field in the bar | |
| Modal dialog | Centered dialog | |

| Option | Description | Selected |
|--------|-------------|----------|
| Switch to new group | New tab becomes active, shows empty state | ✓ |
| Stay on current tab | Tab appears with highlight | |

| Option | Description | Selected |
|--------|-------------|----------|
| Auto color only | Least-used color; picker in Phase 30 | ✓ |
| Pick color at create | Pull palette picker forward | |

| Option | Description | Selected |
|--------|-------------|----------|
| Live as you type | TS mirror rules; empty only disables Create; Rust fallback | ✓ |
| On submit only | Message after Create/Enter | |

---

## Tab strip anatomy & overflow

| Option | Description | Selected |
|--------|-------------|----------|
| Dot · name · muted count | D-07 style; brand underline when active | ✓ |
| Dot · name · count pill | Count in neutral pill | |
| Color underline | Group color as underline | |

| Option | Description | Selected |
|--------|-------------|----------|
| Scroll + fade + arrows | Group section scrolls; arrows only on overflow | ✓ |
| Scroll + fade, no arrows | Wheel/trackpad/keyboard only | |
| 'More' dropdown | Overflow into menu | |

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned at right edge | ＋ always visible | ✓ |
| After last tab, scrolls | Can scroll out of view | |

| Option | Description | Selected |
|--------|-------------|----------|
| No, start on New | Matches today's behaviour | ✓ |
| Yes, restore last tab | Fallback to New if gone | |

---

## Group view cards & badge

| Option | Description | Selected |
|--------|-------------|----------|
| 3 badges + 'Done' | Follow core-tab predicates; done → neutral Done | ✓ |
| Strict 3 badges | Triage only, even for done | |

| Option | Description | Selected |
|--------|-------------|----------|
| Text pill with tab name | Neutral pill beside key; TriageIndicator kept | ✓ |
| Reuse TriageIndicator only | Existing dot/check/Ignore pill | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same as its core tab | Restore on not-mine, copied key on linked | ✓ |
| Detail only | No inline actions | |

| Option | Description | Selected |
|--------|-------------|----------|
| Render from stored snapshot | Normal card, no hint until Phase 32 | ✓ |
| Hide until fetched | Count and list may disagree | |

| Option | Description | Selected |
|--------|-------------|----------|
| No fetch controls | Like Not mine / Linked | ✓ |
| Show Fetch + last checked | Duplicate New header | |

| Option | Description | Selected |
|--------|-------------|----------|
| Reset per visit | Default Updated desc | ✓ |
| Remember per group | Per-group state in session | |

| Option | Description | Selected |
|--------|-------------|----------|
| Show done cards | Membership never filtered | ✓ |
| Hide behind a toggle | New control | |

---

## Empty state & pre-31 testing

| Option | Description | Selected |
|--------|-------------|----------|
| Final copy now | References detail 'Groups' + Select/'Add to group' | ✓ |
| Generic now, final in 31 | Placeholder wording | |

| Option | Description | Selected |
|--------|-------------|----------|
| Automated tests only | Seed stores in tests; populated UAT in Phase 31 | ✓ |
| Dev-only seed action | Hidden seeding in dev builds | |
| Pull in minimal 'Add' early | Temporary detail button | |

| Option | Description | Selected |
|--------|-------------|----------|
| Divider + ＋ only | Icon with tooltip/aria-label | ✓ |
| ＋ with label | Labelled CTA until first group | |

---

## Claude's Discretion

- Truncation width, fade/arrow styling
- `currentTab` type shape for group ids; fallback when active group disappears
- Tab strip keyboard semantics (WCAG AA)
- Adding `@radix-ui/react-popover`
- Exact EN/SK wording

## Deferred Ideas

None.
