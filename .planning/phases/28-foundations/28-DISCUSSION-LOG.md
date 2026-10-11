# Phase 28: Foundations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-11
**Phase:** 28-Foundations
**Areas discussed:** Connection change behaviour, Color palette, Copy-step labels, Group data limits

---

## Connection change behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Hide, keep on disk | Scoped by source base URL; switching back restores | ✓ |
| Keep visible | Global groups; old members show as missing | |
| Wipe groups | Delete on source change | |

| Option (scope key) | Description | Selected |
|--------|-------------|----------|
| Normalised base URL | Lower-cased, trailing slash stripped | ✓ |
| Base URL + username | Per account | |
| You decide | | |

| Option (scope level) | Description | Selected |
|--------|-------------|----------|
| Whole group scoped | Each instance has own groups | ✓ |
| Only memberships scoped | Shared definitions | |

---

## Color palette

| Option | Description | Selected |
|--------|-------------|----------|
| 8 hues, no red | blue, teal, green, amber, orange, purple, pink, slate | ✓ |
| 8 hues incl. red | Standard label set | |
| You decide | | |

| Option (style) | Description | Selected |
|--------|-------------|----------|
| Dot + neutral text | Easiest AA, least noise | ✓ |
| Tinted chip | Louder, per-theme tuning | |
| You decide | | |

| Option (default color) | Description | Selected |
|--------|-------------|----------|
| Least-used color | Ties by palette order | ✓ |
| Cycle in order | Round-robin | |

---

## Copy-step labels

| Option (unknown id) | Description | Selected |
|--------|-------------|----------|
| Generic label + raw id | Translated wrapper, debuggable | ✓ |
| Raw id only | Current behaviour | |

| Option (sweep) | Description | Selected |
|--------|-------------|----------|
| Both copy result screens | All visible strings translated | ✓ |
| Step labels only | | |

| Option (detail text) | Description | Selected |
|--------|-------------|----------|
| Leave as-is | Diagnostic English | ✓ |
| Map known errors | Own scope | |

---

## Group data limits

| Option (name length) | Selected |
|--------|----------|
| 40 characters | ✓ |
| 60 characters | |
| 24 characters | |

| Option (group cap) | Selected |
|--------|----------|
| No hard cap | ✓ |
| Cap at 50 | |

| Option (enforcement) | Selected |
|--------|----------|
| Rust authoritative + UI mirrors | ✓ |
| Rust only | |

| Option (reserved) | Selected |
|--------|----------|
| Core tab names in EN + SK | ✓ |
| Current language only | |

| Option (diacritics) | Description | Selected |
|--------|-------------|----------|
| Different names | Only case + NFC normalised | |
| Same name | Strip diacritics before comparing | ✓ |

**Notes:** The user chose diacritic-insensitive duplicates ("Úlohy" == "Ulohy"), against the recommendation.

---

## Claude's Discretion

- Mechanism for the step-id ↔ translation-key sync test
- Exact hex values per palette token, as long as AA is met
- Diacritic-stripping implementation in Rust
- URL normalisation details
- Behaviour when no source connection is configured

## Deferred Ideas

- Translating Jira/HTTP error categories in copy step details
- Source-scope fix for `triage_state`
