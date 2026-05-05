---
phase: 24-audit-log-copy-time-resolution
reviewed: 2026-05-05T10:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src-tauri/src/commands.rs
  - src/features/tickets/copyStore.ts
  - src/features/tickets/CopyPreviewPage.tsx
  - src/features/tickets/CopyPreviewModal.tsx
  - src/features/tickets/__tests__/copyStore.test.ts
  - src/features/tickets/AuditLogPage.tsx
  - src/features/tickets/types.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
  - src/features/tickets/__tests__/AuditLogPage.fieldGrouping.test.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-05-05T10:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 24 adds copy-time audit logging and the "copied" outcome badge to the Field Transformations tab. The core grouping logic (`groupByCopyId`, `buildGroupCopyText`), the Rust `write_copy_time_audit` path, and the `log_preview_transformations` command are all structurally sound and well-tested. The main correctness gap is in `CopyPreviewModal`, which intentionally passes `null` as `copyId` to `confirmCopy`, breaking the Phase 24 design goal of linking preview-time and copy-time audit rows in the same group. A secondary class of bugs involves missing error handling, a wrong-reason audit label, and an i18n plural key mismatch. The test file is complete and covers the new 'copied' outcome well.

---

## Critical Issues

### CR-01: `CopyPreviewModal` always passes `null` copyId — preview and copy-time audit rows are never linked

**File:** `src/features/tickets/CopyPreviewModal.tsx:252`

**Issue:** The modal variant calls `confirmCopy(sourceBaseUrl, cloudBaseUrl, null)`. The Phase 24 design threads the preview UUID into `copy_ticket_v2` via `copyId` so that the `log_preview_transformations` rows (written at preview-open) and the `write_copy_time_audit` rows (written at commit) share the same `copyId` group in the Audit Log's Field Transformations tab. Because `CopyPreviewModal` passes `null`, the backend generates a fresh UUID (`uuid::Uuid::new_v4()`) for the copy-time rows (commands.rs:1558–1559). The two sets of rows land in different groups and the tab shows them as two separate, unrelated copy operations — the core correctness promise of Phase 24 is broken for the modal path.

`CopyPreviewModal` currently has no `previewCopyId` state of its own; it also does not call `log_preview_transformations` (it skips the audit-logging prefill block that `CopyPreviewPage` has). The fix requires both:
1. Generating a stable `previewCopyId` in the modal (mirrors the `useEffect` pattern in `CopyPreviewPage` lines 138–148).
2. Passing that ID to `confirmCopy` when the user clicks Confirm.

**Fix:**
```tsx
// In CopyPreviewModal — add alongside existing useState calls
const [previewCopyId, setPreviewCopyId] = useState<string | null>(null);

useEffect(() => {
  if (phase !== 'previewing') {
    setPreviewCopyId(null);
    return;
  }
  setPreviewCopyId(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
}, [phase]);

// Update handleConfirm (line 252):
const handleConfirm = () => {
  confirmCopy(sourceBaseUrl, cloudBaseUrl, previewCopyId);
};
```

---

## Warnings

### WR-01: `write_copy_time_audit` — `None` gap arm reports misleading failure reason

**File:** `src-tauri/src/commands.rs:1780`

**Issue:** In the innermost match on `gap`, the `None` arm emits `("skipped", None, Some("source value missing"))`. This arm is reached only when `src_val` is **not** null (the outer `else if src_val.is_null()` branch already consumed the null-source case) AND `tgt_val` is null AND no matching gap was found in `resolved.gaps`. The most likely actual cause is that `apply_mapping` produced no output for the field (e.g. the transformer kind is unsupported or the field id does not match). The `failure_reason` string "source value missing" is factually incorrect in this situation — the source value exists but the target value is empty for an undocumented reason. This will mislead users reading the audit log.

**Fix:**
```rust
None => ("skipped", None, Some("transformer produced no value")),
```

### WR-02: `loadMore` and `loadMoreMapping` swallow errors silently — `hasMore`/offset can desync

**File:** `src/features/tickets/AuditLogPage.tsx:427-443` and `380-396`

**Issue:** Both `loadMore` and `loadMoreMapping` catch the happy path in `try` and use `finally` only to clear the loading flag. If `invoke` rejects (network error, Rust error), the error is never surfaced: `error`/`mappingError` state is not updated, `hasMore`/`mappingHasMore` remain `true`, and `offset`/`mappingOffset` are not advanced. The user is left with the "Load more" button still visible and no feedback that pagination failed. On repeat clicks the button will keep issuing requests with the same stale `offset`, accumulating duplicate rows if requests eventually succeed.

**Fix:**
```ts
// loadMore (same pattern for loadMoreMapping)
async function loadMore() {
  setLoadingMore(true);
  try {
    const data = await invoke<AuditEntry[]>('get_audit_logs_page', {
      offset,
      limit: PAGE_SIZE,
    });
    const rows = Array.isArray(data) ? data : [];
    setEntries((prev) => [...prev, ...rows]);
    setOffset((prev) => prev + rows.length);
    if (rows.length < PAGE_SIZE) {
      setHasMore(false);
    }
  } catch (err) {
    setError(String(err));  // or a dedicated loadMoreError state
  } finally {
    setLoadingMore(false);
  }
}
```

### WR-03: `CopyPreviewModal` copy button does not guard against missing `targetProjectKey`

**File:** `src/features/tickets/CopyPreviewModal.tsx:241`

**Issue:** `isCopyDisabled` in the modal is:
```ts
const isCopyDisabled = phase === 'copying' || isGated || !targetIssueTypeId;
```
`!targetProjectKey` is not included. `CopyPreviewPage` (line 357) correctly adds `isProjectMissing = !targetProjectKey` to its gate, but the modal omits it. If the user opens the modal before a target project is configured, `confirmCopy` is callable: `copyStore.confirmCopy` will pass through to `copy_ticket_v2`, which reads `target_project_key` from the database. If none is configured the backend correctly returns an error — but the guard should be enforced in the UI to give a clear inline message rather than a backend error after a potentially long network round-trip.

**Fix:**
```ts
const isProjectMissing = !targetProjectKey;
const isCopyDisabled = phase === 'copying' || isGated || !targetIssueTypeId || isProjectMissing;
```

### WR-04: i18n key `audit.fields.group.count.total` does not exist — pluralisation always falls back

**File:** `src/features/tickets/AuditLogPage.tsx:676`; `src/i18n/locales/en.json:283-285`

**Issue:** The component calls:
```ts
t('audit.fields.group.count.total', { count: group.total })
```
The i18n files define the keys `audit.fields.group.count.total_one`, `audit.fields.group.count.total_few`, and `audit.fields.group.count.total_other`, following react-i18next's pluralisation suffix convention. The base key `audit.fields.group.count.total` (no suffix) is absent from both locale files. react-i18next resolves plurals by appending the suffix internally, **but only when the base key is not directly present**. In practice this works for English (`_one` → `_other`), but the absence of the base key means i18next may log a "missing key" warning in development, and any locale that does not define all plural suffixes will render the raw key string rather than graceful degradation. The existing test (line 163 in the test file) asserts `toMatch(/3 fields/i)` and passes only because the `_other` suffix resolves at runtime — the test does not cover the warning path.

**Fix:** Add the base key to both locale files as an alias for the `_other` form:
```json
// en.json
"audit.fields.group.count.total": "{{count}} fields",
// sk.json
"audit.fields.group.count.total": "{{count}} polí",
```

---

## Info

### IN-01: `write_copy_time_audit` — transaction begin/commit return values silently ignored

**File:** `src-tauri/src/commands.rs:1737,1806`

**Issue:** `let _ = mdb.begin_transaction();` and `let _ = mdb.commit_transaction();` discard errors intentionally (best-effort semantics documented in the function header). This is acceptable for audit logging, but if `begin_transaction` fails and is ignored, subsequent `insert_mapping_audit` calls will each auto-commit individually, losing the atomicity guarantee. The rows will still be written, but the all-or-nothing intent is not met. A `log::warn!` call on failure would at least surface the issue in debug builds without affecting correctness.

**Fix (low priority):** Emit a debug log if begin/commit fails:
```rust
if let Err(e) = mdb.begin_transaction() {
    log::warn!("[write_copy_time_audit] begin_transaction failed: {e}");
}
// ... rows ...
if let Err(e) = mdb.commit_transaction() {
    log::warn!("[write_copy_time_audit] commit_transaction failed: {e}");
}
```

### IN-02: `copyStore.test.ts` — `confirmCopy` error test does not set `targetIssueTypeId`

**File:** `src/features/tickets/__tests__/copyStore.test.ts:274-292`

**Issue:** The "sets result with failed step on invoke error" test (line 274) sets up state without a `targetIssueTypeId`. `confirmCopy` (copyStore.ts:213) early-returns with a synthetic failure step when `!state.targetIssueTypeId`, so `mockInvoke` is never called. The test asserts `state.result?.steps[0].success === false`, which passes — but for the wrong reason: it exercises the `!targetIssueTypeId` guard, not the `invoke` rejection path it claims to test. The test comment implies a "Timeout" error scenario but the error path via `mockInvoke.mockRejectedValue` is never reached.

**Fix:** Set `targetIssueTypeId: 'it-1'` in the `useCopyStore.setState` call in that test, so the Tauri invoke path is actually exercised.

### IN-03: `CopyPreviewPage` prefill effect uses stale `overrideValues` closure

**File:** `src/features/tickets/CopyPreviewPage.tsx:181-249`

**Issue:** The biome-ignore comment on line 181 acknowledges that `overrideValues` is intentionally omitted from the dependency array to avoid an infinite loop. However, this means the `userAlreadyHasValue` check at line 202 (`overrideValues[row.targetFieldId] !== undefined`) reads the `overrideValues` value captured at the time the effect was scheduled, not the current value. If `overrideValues` changes between the effect's dependency trigger and its execution (e.g. a prior render's `setOverrideValue` hasn't flushed yet), a field could be incorrectly pre-filled a second time. In practice this is unlikely to cause user-visible data corruption (setting the same value again is idempotent for identical data), but the `wasOverridden` flag in the audit log entry (line 233, `wasOverridden: userAlreadyHasValue`) will be misreported as `false` for fields that were already set, leading to incorrect "was overridden" attribution in the audit UI.

**Fix (low priority):** Use a ref to capture the current `overrideValues` at effect execution time without adding it to the dependency array:
```ts
const overrideValuesRef = useRef(overrideValues);
useEffect(() => { overrideValuesRef.current = overrideValues; });
// Inside the prefill effect, read overrideValuesRef.current instead of overrideValues
```

---

_Reviewed: 2026-05-05T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
