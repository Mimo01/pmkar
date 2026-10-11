---
phase: 28
slug: foundations
status: approved
reviewed_at: 2026-10-11
shadcn_initialized: true
preset: existing (style default, baseColor neutral, cssVariables, lucide)
created: 2026-10-11
---

# Phase 28 — UI Design Contract

> Scope: Phase 28 adds NO new group UI (tabs, picker, management arrive in Phases 29-31). The visible surface is (1) translated copy-step labels on `CopyResultModal` and `CopyResultPage`, and (2) the group color palette tokens that later phases render. Everything else reuses the existing design system unchanged.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (existing `components.json`, no re-init) |
| Preset | existing: style `default`, baseColor `neutral`, CSS variables, Tailwind v4 via `src/index.css` (no tailwind.config) |
| Component library | radix (shadcn `Dialog`, `Button`, `ScrollArea` already used by result screens) |
| Icon library | lucide |
| Font | existing app default (no font declared in `index.css`; do not change) |

---

## Spacing Scale

Existing Tailwind scale is reused; Phase 28 adds no layout. Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap between step label and detail (`mt-1`), dot-to-text gap in future chips |
| sm | 8px | Icon-to-label gap in step rows |
| md | 16px | Default spacing in result screens |
| lg | 24px | Result page section spacing (`mb-6`) |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: the existing `mt-0.5` (2px) under step detail in `CopyResultModal` is preserved as-is for parity; do not introduce new non-multiple-of-4 values. Palette dot size (consumed in Phases 29-31) is fixed at 8px diameter.

---

## Typography

Existing result-screen styles are preserved; no new sizes introduced (4 sizes in use, 2 weights).

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (step label, `text-sm`) | 14px | 400 | 1.5 |
| Label/Detail (`text-xs`, muted detail and "Created" line) | 12px | 400 | 1.5 |
| Heading (`text-base`/`text-lg` dialog/page title) | 16px (modal) / 18px (page) | 600 | 1.2 |
| Display | not used this phase | - | - |

Weights: regular 400 and semibold 600 only. Target key stays `font-mono font-semibold`.

---

## Color

Existing theme tokens in `src/index.css` are the contract; no changes to them.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#f7f7f8` light / `#161617` dark (`--color-background`) | Page background |
| Secondary (30%) | `#ffffff` light / `#1e1e20` dark (`--color-card`) | Dialog, cards |
| Accent (10%) | `#c02232` (`--color-brand`) | Reserved for: primary Close button in result dialog, focus ring. Nothing else in this phase |
| Destructive | `#dc2626` | Failed-step icon/state only (existing); no destructive actions in this phase |

Accent reserved for: primary button and focus ring only. Failed step rows keep the existing destructive icon; step label text stays neutral (`text-brand-text`), detail text `text-brand-muted`.

### Group color palette tokens (new, consumed by Phases 29-31)

Per D-05..D-08. Order is fixed: blue, teal, green, amber, orange, purple, pink, slate. No red. The DB stores the token name (e.g. `blue`). Define as CSS variables `--color-group-{name}` in `index.css` with a light value in the root `@theme` and a dark override under `body.dark`.

| Token | Light (on `#ffffff`) | Dark (on `#1e1e20`) |
|-------|---------------------|--------------------|
| blue | `#2563eb` | `#60a5fa` |
| teal | `#0d9488` | `#2dd4bf` |
| green | `#16a34a` | `#4ade80` |
| amber | `#d97706` | `#fbbf24` |
| orange | `#ea580c` | `#fb923c` |
| purple | `#7c3aed` | `#a78bfa` |
| pink | `#db2777` | `#f472b6` |
| slate | `#64748b` | `#94a3b8` |

These are starting values (Claude's discretion per CONTEXT). Executor MUST adjust any value that fails the contrast test: non-text contrast >= 3:1 (WCAG 1.4.11) against card AND background surfaces in both themes (`#ffffff`/`#f7f7f8`, `#1e1e20`/`#161617`). Contrast test is a required deliverable.

Rendering rule (for later phases, fixed now): colored 8px dot beside neutral-text name; never tinted backgrounds; color never the sole signal. Default for new group: least-used color in scope, ties by palette order.

---

## Copywriting Contract

Existing tone retained: "X copied" / "X — {detail}". All strings via i18next in `en.json` and `sk.json`; both files must have identical key sets. Rust/Jira `detail` text remains raw English (D-13).

| Element | Copy |
|---------|------|
| Primary CTA | Close (existing `copy.result.close`) |
| Empty state | Not applicable (result screens always have steps) |
| Error state | Failed steps show translated label plus raw `detail` below (existing pattern) |
| Destructive confirmation | none in this phase |

### Step label mapping (`copyStepLabel(step, t)`, single shared helper)

| Rust step id | Success | Failure |
|--------------|---------|---------|
| `fetch_source` | new key `copy.step.fetchSource` "Source ticket loaded" | `copy.step.fetchSourceFailed` "Source ticket — could not be loaded" |
| `create_issue` | `copy.step.coreFields` (existing) | `copy.step.coreFieldsFailed` (existing) |
| `convert_description` | `copy.step.descConverted` | `copy.step.descFailed` |
| `upload_image*` | `copy.step.imagesUploaded` (+ ` (detail)` if present) | `copy.step.imagesFailed` |
| `add_remotelink` (fix: existing code wrongly matches `add_remote_link`) | `copy.step.remoteLinkAdded` | `copy.step.remoteLinkFailed` |
| `attach:{filename}` | `copy.step.attached` | `copy.step.attachFailed` with detail fallback key `copy.step.fallback.attachment` "attachment failed" |
| `comment:{n}` | `copy.step.commentCopied` | `copy.step.commentFailed`, fallback `copy.step.fallback.failed` "failed" |
| `worklog:fetch` (special, checked BEFORE `worklog:{n}`) | new `copy.step.worklogFetched` "Work log loaded" | `copy.step.worklogFetchFailed` "Work log — could not be loaded" |
| `worklog:{n}` | `copy.step.worklogCopied` | `copy.step.worklogFailed`, fallback `copy.step.fallback.failed` |
| `subtask:{key}` | `copy.step.subtaskCreated`, fallback `copy.step.fallback.created` "created" | `copy.step.subtaskFailed`, fallback `copy.step.fallback.creationFailed` "creation failed" |
| `update_triage` | new `copy.step.triageUpdated` "Triage state updated" | `copy.step.triageUpdateFailed` "Triage state — could not be updated" |
| unknown id (D-10) | `copy.step.unknown` "Step: {{id}} — completed" | `copy.step.unknownFailed` "Step: {{id}} — failed" |

Unknown fallback must never render blank and must include the raw id. Slovak translations are required for every key above (executor supplies natural SK wording matching existing `copy.step.*` tone; no machine-looking literal translations, keep the "—" separator).

### Other hardcoded strings (D-12)

| Location | Current | Replace with |
|----------|---------|--------------|
| `CopyResultModal.tsx:125` | `Created: {targetKey}` | new key `copy.result.created` "Created: {{key}}" (SK: "Vytvorené: {{key}}") |
| Both screens | any other hardcoded English found in sweep | translated keys under `copy.result.*` / `copy.step.*` |

Scope limit: only these two screens.

---

## Interaction Contract

- No new interactive controls in this phase. Result screens keep current behavior (Open in {{name}}, Close).
- Project rules apply to all later group UI and are recorded here: explicit labelled buttons over hover-revealed icons; no drag and drop (reorder via Move left / Move right menu items).
- Accessibility: step status must not rely on icon color alone; label text carries the outcome ("failed", "could not be", "—detail"). Preserve existing semantics of dialog focus and Close.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none new (existing Dialog, Button, ScrollArea) | not required |
| third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
