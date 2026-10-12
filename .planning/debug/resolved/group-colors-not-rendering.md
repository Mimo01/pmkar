---
status: resolved
trigger: "group-colors-not-rendering: some of the 8 group color swatches do not render their color"
created: 2026-10-12
updated: 2026-10-12
---

## Current Focus

hypothesis: CONFIRMED - Tailwind v4 tree-shakes unreferenced @theme variables; light-mode teal/green/orange/pink are dropped
test: done (vite build + grep)
expecting: n/a
next_action: return ROOT CAUSE FOUND to orchestrator

## Symptoms

expected: Create group popover shows 8 colored swatches; created group tab shows chosen color
actual: some colors are not rendering, some are
errors: none
reproduction: UAT Test 1, .planning/phases/30-group-management-reorder/30-UAT.md
started: discovered during phase 30 UAT

## Eliminated

## Evidence

- timestamp: 2026-10-12
  checked: src/features/groups/colors.ts, GroupColorSwatches.tsx, GroupTab.tsx
  found: swatches/dots render with inline style backgroundColor = `var(--color-group-${token})` (template string built at runtime)
  implication: color depends entirely on the CSS custom property existing

- timestamp: 2026-10-12
  checked: src/index.css
  found: light values declared inside `@theme { ... }` (lines 45-52); dark values declared in a plain `body.dark { }` rule (lines 98-105). Tailwind ^4.2.2.
  implication: Tailwind v4 only emits @theme variables that are referenced; dark block is always emitted

- timestamp: 2026-10-12
  checked: grep for literal `--color-group-<name>` outside index.css
  found: only in tests: blue (GroupTabStrip.test.tsx:93), purple (GroupTabStripOverlays.test.tsx:169), amber (colors.test.ts:142)
  implication: Tailwind's source scanner sees only these three names as used

- timestamp: 2026-10-12
  checked: `vite build` output CSS, grep for --color-group-*
  found: light (@theme -> :root) emits ONLY blue, amber, purple, slate. body.dark emits all 8.
  implication: CONFIRMED. teal, green, orange, pink have no light-mode definition -> var() invalid -> transparent background (swatch/dot invisible)

- timestamp: 2026-10-12
  checked: why slate survives
  found: literal `--color-group-slate` appears in .planning/phases/28-foundations/28-03-PLAN.md and 28-PATTERNS.md, which Tailwind's auto source detection scans
  implication: the surviving set is accidental (driven by literal mentions in tests/docs), fragile; dark mode is unaffected because body.dark is a plain rule, not @theme

## Resolution

root_cause: Light-mode group palette is declared inside Tailwind v4 `@theme {}` in src/index.css. Tailwind v4 only emits @theme variables that appear as referenced in scanned sources. The app references them only via a runtime template string `var(--color-group-${token})` (colors.ts groupColorVar), which the scanner cannot see. Only blue/amber/purple/slate survive (literal mentions in test files and .planning docs); teal/green/orange/pink are stripped, so their swatches/tab dots render transparent in light theme. Dark theme (plain `body.dark` rule) has all 8.
fix:
verification:
files_changed: []
