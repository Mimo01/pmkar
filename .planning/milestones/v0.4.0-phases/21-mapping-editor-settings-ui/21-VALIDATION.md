---
phase: 21
slug: mapping-editor-settings-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm test -- --reporter=dot src/features/field-mapping` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (quick), ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=dot src/features/field-mapping`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-W0-sonner | W0 | 0 | — | — | N/A | install | `npm install sonner && npx shadcn@latest add sonner` | ❌ W0 | ⬜ pending |
| 21-W0-test-stubs | W0 | 0 | MAP-03, MAP-04, MAP-05, DISC-05, EDIT-02, EDIT-03 | — | N/A | unit stubs | `npm test -- --reporter=dot src/features/field-mapping` | ❌ W0 | ⬜ pending |
| 21-xx-01 | TBD | 1 | EDIT-01 | — | N/A | unit | `npm test -- src/features/connections/__tests__/SettingsPage.test.tsx` | ✅ exists | ⬜ pending |
| 21-xx-02 | TBD | 1 | MAP-03, MAP-04 | — | Combobox values selected from known schema only | unit | `npm test -- src/features/field-mapping/__tests__/MappingRow.test.tsx` | ❌ W0 | ⬜ pending |
| 21-xx-03 | TBD | 1 | MAP-05 | — | Drift warning on missing target_field_id | unit | `npm test -- src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` | ❌ W0 | ⬜ pending |
| 21-xx-04 | TBD | 1 | DISC-05 | — | Refresh calls command then reloads schema | unit | `npm test -- src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` | ❌ W0 | ⬜ pending |
| 21-xx-05 | TBD | 2 | EDIT-02, EDIT-03 | — | Suggestions shown only for unmapped source fields | unit | `npm test -- src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` — stubs for DISC-05, MAP-05
- [ ] `src/features/field-mapping/__tests__/MappingRow.test.tsx` — stubs for MAP-03, MAP-04
- [ ] `src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx` — stubs for EDIT-02, EDIT-03
- [ ] `src/features/field-mapping/__tests__/heuristics.test.ts` — stubs for heuristic matching logic (pure function)
- [ ] `src/features/connections/__tests__/SettingsPage.test.tsx` — add test: clicking "Field Mapping" nav renders field mapping section (EDIT-01)
- [ ] Sonner install: `npm install sonner` + `npx shadcn@latest add sonner` + `<Toaster />` in App.tsx

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Last refreshed Xm ago" timestamp updates after Refresh click | DISC-05 | Requires real time progression to verify | Click Refresh, verify timestamp updates to reflect current time |
| Drift warning appears when target field deleted from Jira | MAP-05 | Requires mock server schema manipulation | Remove a field from mock target schema, reload editor, verify amber badge on affected row |
| Schema refresh updates combobox options live | MAP-04 | Requires store reactivity end-to-end | Change mock schema, click Refresh, verify new options appear in target combobox |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
