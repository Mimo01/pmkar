---
status: resolved
trigger: "User mapping fails, is it case sensitive? It shount be if it is"
created: 2026-11-13
updated: 2026-11-13
---

## Symptoms
- expected: Server users map to Cloud accounts regardless of email casing
- actual: user mapping fails (unresolved) for some users

## Resolution
- root_cause: Email match in `user.rs::match_user_in_results` and `commands.rs::find_best_match` used exact `==` comparison. Jira Server commonly stores mixed-case emails (`John.Doe@Acme.com`) while Cloud returns lowercase, so the exact match never hit; with >1 user on the domain the fallbacks (privacy-mode / single-result displayName) don't apply → None. Domain grouping was also case-sensitive (same domain in different casing = duplicate HTTP batches).
- fix: Added `user::emails_eq` (trim + ASCII case-insensitive) used by both matchers; domain keys lowercased in `resolve_batch` and `resolve_users_preview`.
- verification: new unit test `match_user_email_is_case_insensitive`; `cargo test --lib user` 33/33 pass.
- files_changed: src-tauri/src/field_transform/user.rs, src-tauri/src/commands.rs
