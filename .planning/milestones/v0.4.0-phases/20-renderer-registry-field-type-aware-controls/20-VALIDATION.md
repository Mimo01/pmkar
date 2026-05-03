---
phase: 20
slug: renderer-registry-field-type-aware-controls
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.1 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm test -- --reporter=verbose src/features/field-renderers` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=verbose src/features/field-renderers`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-W0-setup | W0 | 0 | CTRL-01..08 | — | N/A | scaffold | `npm test -- src/features/field-renderers` | ❌ W0 | ⬜ pending |
| 20-combobox | W1 | 1 | CTRL-08 | — | No XSS via displayLabel (React JSX escaping) | unit | `npm test -- src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx` | ❌ W0 | ⬜ pending |
| 20-registry | W2 | 2 | CTRL-07 | — | UnsupportedTypeRenderer for unknown types (no crash) | unit | `npm test -- src/features/field-renderers/__tests__/registry.test.ts` | ❌ W0 | ⬜ pending |
| 20-string-renderers | W2 | 2 | CTRL-01 | — | N/A | unit | `npm test -- src/features/field-renderers/__tests__/StringRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 20-textarea-renderer | W2 | 2 | CTRL-01 | — | N/A | unit | `npm test -- src/features/field-renderers/__tests__/TextAreaRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 20-user-picker | W2 | 2 | CTRL-02 | PII(initialQuery) | No logging of onSearch query params | unit | `npm test -- src/features/field-renderers/__tests__/UserPickerRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 20-multi-user | W2 | 2 | CTRL-02 | — | N/A | unit | `npm test -- src/features/field-renderers/__tests__/MultiUserPickerRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 20-select-renderers | W2 | 2 | CTRL-03 | — | N/A | unit | `npm test -- src/features/field-renderers/__tests__/SingleSelectRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 20-multi-select | W2 | 2 | CTRL-03 | — | N/A | unit | `npm test -- src/features/field-renderers/__tests__/MultiSelectRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 20-labels | W2 | 2 | CTRL-03 | — | N/A | unit | `npm test -- src/features/field-renderers/__tests__/LabelsRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 20-checkbox | W2 | 2 | CTRL-06 | — | N/A | unit | `npm test -- src/features/field-renderers/__tests__/CheckboxRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 20-radio | W2 | 2 | CTRL-06 | — | N/A | unit | `npm test -- src/features/field-renderers/__tests__/RadioRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 20-unsupported | W2 | 2 | CTRL-07 | — | read-only pill, role=status, never crashes | unit | `npm test -- src/features/field-renderers/__tests__/UnsupportedTypeRenderer.test.tsx` | ❌ W0 | ⬜ pending |
| 20-dynamic-form | W3 | 3 | CTRL-01..08 | — | N/A | integration | `npm test -- src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/field-renderers/__tests__/registry.test.ts` — stubs for CTRL-07 registry coverage
- [ ] `src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx` — stubs for CTRL-08
- [ ] `src/features/field-renderers/__tests__/StringRenderer.test.tsx` — stubs for CTRL-01 (covers String + Url + Number + Date + DateTime)
- [ ] `src/features/field-renderers/__tests__/TextAreaRenderer.test.tsx` — stubs for CTRL-01
- [ ] `src/features/field-renderers/__tests__/UserPickerRenderer.test.tsx` — stubs for CTRL-02
- [ ] `src/features/field-renderers/__tests__/MultiUserPickerRenderer.test.tsx` — stubs for CTRL-02
- [ ] `src/features/field-renderers/__tests__/SingleSelectRenderer.test.tsx` — stubs for CTRL-03
- [ ] `src/features/field-renderers/__tests__/MultiSelectRenderer.test.tsx` — stubs for CTRL-03
- [ ] `src/features/field-renderers/__tests__/LabelsRenderer.test.tsx` — stubs for CTRL-03
- [ ] `src/features/field-renderers/__tests__/CheckboxRenderer.test.tsx` — stubs for CTRL-06
- [ ] `src/features/field-renderers/__tests__/RadioRenderer.test.tsx` — stubs for CTRL-06
- [ ] `src/features/field-renderers/__tests__/UnsupportedTypeRenderer.test.tsx` — stubs for CTRL-07
- [ ] `src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx` — stubs for integration
- [ ] Framework config: vitest.config.ts and src/test-setup.ts already in place — no new setup needed
- [ ] npm install cmdk @tanstack/react-virtual — new packages required before Wave 1 implementation

*Note: VirtualizedCombobox layout/virtualization behavior (only N rows rendered) cannot be asserted in jsdom — tests must verify: trigger renders, dropdown opens, onChange fires. Do not assert `getVirtualItems().length < items.length`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Combobox scroll with 5,000+ items has no observable lag | CTRL-08 | jsdom has no layout/scroll engine; virtualization behavior cannot be measured in unit tests | In dev build, open DynamicTargetForm with 5000+ allowedValues fixture; scroll rapidly and verify no frame drops |
| Keyboard ArrowDown navigates past visible viewport boundary (scrolls virtual list) | CTRL-08 | jsdom scroll events don't trigger virtualizer recalculation | In dev build, open combobox with 500+ items; press ArrowDown until last visible row; verify list scrolls and next item is selected |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
