---
status: done
trigger: "For testing purposes I set mapping from user type field to summary (string). The mapping has failed, it should have put the users name into there"
created: 2026-05-08
updated: 2026-05-08
---

# Debug Session: user-mapping-not-resolved

## Symptoms

- **Expected**: displayName from Jira user object written to summary field (e.g. "ZIPAJ Milan OSK")
- **Actual**: Mapping skipped — target is null, reason: "user not resolved in Cloud"
- **Error output**:
  ```
  summary  [user_name]  skipped
    source: {"self":"https://jira.orange.sk/rest/api/2/user?username=osk01593","name":"osk01593","key":"osk01593","emailAddress":"Milan.ZIPAJ@orange.com","avatarUrls":{...},"displayName":"ZIPAJ Milan OSK","active":true,"timeZone":"Europe/Bratislava"}
    target: null
    reason: user not resolved in Cloud
  ```
- **Timeline**: First test, unknown if ever worked
- **Reproduction**: Set field mapping: user type field → summary (string), then run copy ticket flow

## Current Focus

hypothesis: The `user_name` transformer is correctly auto-selected by `getTransformerOptions` on the frontend, but `CopyPreviewPage.tsx` dispatches all user-source rows through the `resolve_users_preview` Tauri command. When that resolves null (user not found in Cloud by accountId), the row is logged as "user not resolved in Cloud" instead of using `dispatch_user_name` logic. The `user_name` transformer_kind is never checked by the frontend copy preview path.
test: ~
expecting: ~
next_action: fix
reasoning_checkpoint: Two separate code paths exist. The Rust pipeline (`pipeline.rs`) correctly dispatches `user_name` kind to `dispatch_user_name` which extracts displayName without any Cloud resolution. But the TypeScript `CopyPreviewPage.tsx` copies independently and its userRows loop never branches on `transformer_kind === 'user_name'` — it sends ALL user-source rows to `resolve_users_preview`, which tries to find an accountId. When that fails, it emits "user not resolved in Cloud".
tdd_checkpoint: ~

## Evidence

- **`transformerOptions.ts` line 84-86**: When `sourceSchema.type === 'user'` AND `targetSchema.type === 'string'`, `getTransformerOptions` returns ONLY `[USER_NAME]`. So the mapping row will have `transformerKind = 'user_name'` when saved.
- **`pipeline.rs` line 67-68**: Rust pipeline correctly handles `transformer_kind == "user_name"` by calling `dispatch_user_name`, which reads `displayName` directly from the source object — no Cloud lookup needed.
- **`CopyPreviewPage.tsx` line 332-337**: `userRows` filter captures rows where `transformerKind === 'user'` OR `sourceSchema.type === 'user'`. A `user_name` row has `sourceSchema.type === 'user'`, so it IS captured.
- **`CopyPreviewPage.tsx` line 401-458**: All captured `userRows` go through `resolve_users_preview`. No branch for `transformer_kind === 'user_name'` exists here. When the Cloud lookup returns null, line 433-438 logs "user not resolved in Cloud".
- **Gap**: The TypeScript copy-preview path does not implement the `user_name` transformer logic (extract displayName as plain string). It only knows how to resolve Cloud accountIds.

## Eliminated Hypotheses

- The Rust pipeline is NOT the source of the bug — it handles `user_name` correctly.
- The transformer_kind stored in DB is NOT the problem — `user_name` is correctly auto-selected.
- The source user object is NOT missing displayName — it contains "ZIPAJ Milan OSK".

## Resolution

root_cause: `CopyPreviewPage.tsx` sends all user-source mapping rows through `resolve_users_preview` (Cloud accountId lookup) regardless of `transformer_kind`. When `transformer_kind === 'user_name'`, the correct behavior is to skip Cloud resolution entirely and extract `displayName` (falling back to `name`) directly from the source field value. The preview path has no branch for this case.

fix: In `CopyPreviewPage.tsx`, before dispatching to `resolve_users_preview`, split `userRows` into two groups: rows with `transformerKind === 'user_name'` and rows with other transformer kinds. For the `user_name` group, resolve synchronously by reading `displayName ?? name` from the source field value and writing it directly to the target field (via `setOverrideValue`), without any Tauri call. Log outcome as `'ok'`. Only send non-`user_name` rows to `resolve_users_preview`.

verification: TypeScript compiles clean (pre-existing unrelated error in CopyPreviewModal.tsx confirmed not introduced by this change). Fix committed as 7ed9554.
files_changed: src/features/tickets/CopyPreviewPage.tsx
