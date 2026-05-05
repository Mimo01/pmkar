---
phase: 22-copy-preview-override-panel
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/features/tickets/copyStore.ts
  - src/features/tickets/types.ts
  - src/features/tickets/__tests__/copyStore.test.ts
  - src/features/tickets/IssueTypeChooser.tsx
  - src/features/tickets/__tests__/IssueTypeChooser.test.tsx
  - src/features/tickets/computeGapFields.ts
  - src/features/tickets/GapsSection.tsx
  - src/features/tickets/__tests__/computeGapFields.test.ts
  - src/features/tickets/__tests__/GapsSection.test.tsx
  - src/features/tickets/CopyPreviewPage.tsx
  - src/features/tickets/CopyPreviewModal.tsx
  - src/features/tickets/__tests__/CopyPreviewPage.test.tsx
  - src/features/field-renderers/DynamicTargetForm.tsx
  - src/features/connections/SettingsPage.tsx
  - src/App.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: fixed
---

# Phase 22: Code Review Report

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 17
**Status:** fixed

## Summary

Phase 22 adds the issue-type chooser, gap-fields computation, and the override panel to both `CopyPreviewPage` and `CopyPreviewModal`. The `computeGapFields` pure function and `IssueTypeChooser` component are clean. The `copyStore` Phase 22 additions are correct. `DynamicTargetForm`, `SettingsPage`, `App.tsx`, and both locale files are unchanged or correct.

Three critical defects were found, all in `CopyPreviewModal.tsx`. The file diverged from `CopyPreviewPage.tsx` in ways that introduce a runtime crash, an infinite-effect loop, and incorrect pre-fill data being written to the store. These defects are not covered by tests because no `CopyPreviewModal` test file exists.

---

## Critical Issues

### CR-01: `CopyPreviewModal.searchUsersForPicker` missing `baseUrl` — runtime crash on user search

**File:** `src/features/tickets/CopyPreviewModal.tsx:82`

**Issue:** The module-level `searchUsersForPicker` function calls `search_jira_users_by_domain` without the `baseUrl` argument:

```ts
const users = await invoke<JiraUser[]>('search_jira_users_by_domain', { domain });
```

The Tauri command requires `baseUrl`. Without it the backend returns an error ("missing required key baseUrl"). The identical bug was documented and fixed in `CopyPreviewPage.tsx` (see comment at line 331 of that file), but the fix was not applied to the modal. The modal function is defined at module scope so it cannot close over `sourceBaseUrl` from the connection store — the fix requires moving it inside the component, matching the page implementation.

**Fix:**
```tsx
// Remove the module-level function entirely.
// Inside CopyPreviewModal component, after `sourceBaseUrl` is read from connectionStore:
const searchUsersForPicker = useCallback(
  async (q: string): Promise<JiraUser[]> => {
    const trimmed = q.trim();
    if (!trimmed) return [];
    const at = trimmed.lastIndexOf('@');
    const domain = at >= 0 ? trimmed.slice(at + 1) : trimmed;
    if (!domain) return [];
    try {
      const users = await invoke<JiraUser[]>('search_jira_users_by_domain', {
        baseUrl: sourceBaseUrl,
        domain,
      });
      return Array.isArray(users) ? users : [];
    } catch (e) {
      console.error('[CopyPreviewModal] search_jira_users_by_domain failed:', e);
      return [];
    }
  },
  [sourceBaseUrl],
);
```

---

### CR-02: `CopyPreviewModal` pre-fill effect has `overrideValues` in dep array — infinite loop on every user input

**File:** `src/features/tickets/CopyPreviewModal.tsx:165`

**Issue:** The comment directly after the `useEffect` (lines 166–168) states:

> "Intentionally omit overrideValues and setOverrideValue from deps: overrideValues would cause an infinite loop..."

But the dep array on line 165 includes both `overrideValues` and `setOverrideValue`:

```ts
}, [mappingRows, sourceTicket, overrideValues, setOverrideValue]);
```

Every time the user fills a gap field (`setOverrideValue` is called → `overrideValues` changes), this effect re-fires. The guard `if (overrideValues[row.targetFieldId] !== undefined) continue` prevents a second write, but the effect body still loops over all mapping rows on every keypress, which is incorrect per the stated intent ("runs once when both mappingRows and sourceTicket are available").

The same issue exists in `CopyPreviewPage.tsx` line 253, but it is made worse there because re-firing also re-issues `invoke('log_preview_transformations', ...)`, creating duplicate audit log entries for every character the user types into a gap field (see CR-03).

**Fix (both files):** Remove `overrideValues` and `setOverrideValue` from the dep arrays, consistent with the comments that already describe this intent:

```ts
// CopyPreviewModal.tsx
}, [mappingRows, sourceTicket]);

// CopyPreviewPage.tsx
}, [mappingRows, sourceTicket, previewCopyId]);
```

---

### CR-03: `CopyPreviewModal` `PREFILLABLE_KINDS` includes `'user'` — raw Jira Server user objects written to picker state

**File:** `src/features/tickets/CopyPreviewModal.tsx:96`

**Issue:** The modal defines:

```ts
const PREFILLABLE_KINDS = new Set(['identity', 'priority', 'user']);
```

`CopyPreviewPage.tsx` deliberately excludes `'user'` and explains why (line 83 and inline comment on line 176–177):

> "User / version / component require async resolution — they remain as gaps."

The Jira Server user object shape (`{ name, displayName, avatarUrls, emailAddress }`) does not match the accountId-based shape the Cloud user picker expects. Pre-filling `overrideValues[targetFieldId]` with a raw Server user object will silently corrupt the picker's value prop and likely send an invalid payload to the copy backend. The correct path is for the `user` transformer to resolve the user at copy time via `apply_mapping`, not from the raw source field.

**Fix:** Remove `'user'` from `PREFILLABLE_KINDS` in the modal to match the page:

```ts
// CopyPreviewModal.tsx line 96
const PREFILLABLE_KINDS = new Set(['identity', 'priority']);
```

---

## Warnings

### WR-01: `CopyPreviewPage` pre-fill effect also has `overrideValues` in dep array — duplicate audit log entries

**File:** `src/features/tickets/CopyPreviewPage.tsx:253`

**Issue:** Same root cause as CR-02 (the dep array includes `overrideValues`), but the consequence here is specifically that `invoke('log_preview_transformations', ...)` is called again on every user input into a gap field. Each call creates a new batch of audit rows in the database for the same `previewCopyId`, causing the Audit Log's "Field Transformations" tab to show duplicate entries for a single preview session.

**Fix:** Remove `overrideValues` and `setOverrideValue` from the dep array (see CR-02 fix).

---

### WR-02: `CopyPreviewModal` Copy button does not gate on `!targetIssueTypeId` — silent backend error instead of UI feedback

**File:** `src/features/tickets/CopyPreviewModal.tsx:239`

**Issue:** The modal's copy-disabled condition is:

```ts
const isCopyDisabled = phase === 'copying' || isGated;
```

It does not check `!targetIssueTypeId`. If no issue types are available (schema pre-warm fails or returns empty), `targetIssueTypeId` remains `null` and `isCopyDisabled` is `false`. The user clicks Copy, `confirmCopy` in `copyStore.ts` hits the guard at line 209 and sets a synthetic failure result — but the UI transitions to the result page showing "No target issue type selected" without ever disabling the button or showing a tooltip explaining why.

`CopyPreviewPage.tsx` does not have this bug because it independently gates on `isProjectMissing` (which requires a project to be selected, implicitly requiring type resolution), but a dedicated `!targetIssueTypeId` check is also absent from the page. The modal is more exposed because it has no project-missing guard either.

**Fix:**
```ts
// CopyPreviewModal.tsx
const isCopyDisabled =
  phase === 'copying' ||
  isGated ||
  !targetIssueTypeId;
```

---

### WR-03: No test coverage for `CopyPreviewModal`

**File:** `src/features/tickets/CopyPreviewModal.tsx` (no corresponding test file)

**Issue:** `CopyPreviewModal` replicates nearly all Phase 22 logic from `CopyPreviewPage` with several divergences that turned into the three critical bugs above. There is no `CopyPreviewModal.test.tsx`, so none of the modal-specific behavior (missing `baseUrl`, `PREFILLABLE_KINDS` including user, gap gating without project check) is validated. The existing `CopyPreviewPage.test.tsx` only covers the page path.

**Fix:** Add a `CopyPreviewModal.test.tsx` covering at minimum: user search invokes `baseUrl`, Copy button is disabled when `targetIssueTypeId` is null, pre-fill does not write raw user objects to overrideValues.

---

## Info

### IN-01: `getProgressPercent` duplicated verbatim in both preview components

**File:** `src/features/tickets/CopyPreviewPage.tsx:62–75` and `src/features/tickets/CopyPreviewModal.tsx:56–69`

**Issue:** The `getProgressPercent(progressStep: string): number` function is byte-for-byte identical in both files. Any future change to copy-step label strings must be made in two places.

**Fix:** Extract to a shared utility, e.g. `src/features/tickets/copyProgressPercent.ts`, and import it in both components.

---

### IN-02: `CopyPreviewPage.tsx` prefill dep-array comment contradicts the inline code comment

**File:** `src/features/tickets/CopyPreviewPage.tsx:253`

**Issue:** The inline comment on line 253 reads:

```ts
overrideValues, // Pre-fill the override and record an "ok" outcome.
```

This comment was evidently copied from the code body (line 220) and accidentally placed next to the dep-array entry. The block comment immediately after (lines 256–258) says to omit `overrideValues`. The contradictory inline comment will mislead future readers about why `overrideValues` is in the array.

**Fix:** Remove the inline comment from line 253 (and, per CR-02/WR-01, remove `overrideValues` from the array entirely).

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
