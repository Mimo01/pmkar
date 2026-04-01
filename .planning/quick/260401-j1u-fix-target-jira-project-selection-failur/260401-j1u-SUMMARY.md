# Quick Task 260401-j1u: Fix target Jira project selection failure

## Summary

Verified and completed fixes from two prior debug sessions, plus added one missing fix:

### Fixes verified (from debug sessions)

1. **Credential key mismatch** (`settings-not-persisting`): Cloud `connection_meta.username` stored display name (e.g., "John Doe") but keychain was keyed by email. On reload, `get_cloud_credentials()` → `get_credential("jira-cloud", "John Doe")` failed because secret was stored under email. **Fix:** Both `SetupWizard` and `SettingsPage` now consistently use email as `metaUsername` for cloud connections.

2. **Extra baseUrl parameter** (`copy-target-fields-fail`): `copyStore.ts` passed `{ baseUrl: cloudBaseUrl }` to `invoke('fetch_cloud_meta')` but Rust command accepts zero JS args (only Tauri-injected State). Tauri v2 threw InvalidArgs before the command executed. **Fix:** Removed extra arg.

3. **Priority paginated response** (`copy-target-fields-fail`): `fetch_cloud_meta` priority parsing now handles both flat array (older Jira Cloud) and `{ values: [...] }` paginated format (newer Jira Cloud).

### Fix added during verification

4. **Project paginated response** (NEW): `fetch_cloud_projects` had the same flat-array-only parsing bug as priorities. Applied identical dual-format pattern from the priority fix.

## Verification

- cargo build: clean
- cargo test: 9/9 passed
- npm test: 536/536 passed

## Files Changed

- `src/features/connections/SettingsPage.tsx` — credential key alignment
- `src/features/connections/SetupWizard.tsx` — credential key alignment
- `src/features/tickets/copyStore.ts` — remove extra invoke arg, add error logging
- `src-tauri/src/commands.rs` — dual-format parsing for priorities and projects
