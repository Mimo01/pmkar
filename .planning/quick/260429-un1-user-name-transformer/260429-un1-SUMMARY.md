---
quick_id: 260429-un1
status: complete
date: 2026-04-29
---

# Summary: user_name transformer for user→text mapping

## What was built

A new `user_name` transformer that activates when a source `user` field is mapped to a
destination `string` field. It copies the person's display name as plain text instead of
trying to resolve an accountId (which is what the `user` transformer does) or returning
Null (which is what `identity` does for user types).

## Changes

### Rust
- `pipeline.rs`: added `dispatch_user_name()` — extracts `displayName` (falls back to
  `name`) from the source value and writes a plain string. Array<user> joins names with ", ".
- `pipeline.rs`: dispatch branch for user fields now checks `transformer_kind == "user_name"`
  first, routing to `dispatch_user_name()` before the accountId-resolution path.
- 5 new tests added, all passing (18 total in pipeline module).

### TypeScript
- `transformerOptions.ts`: added `'user_name'` to the value union; added `USER_NAME`
  option; added optional `sourceSchema` param; returns `[USER_NAME]` exclusively when
  source=user AND target=string (identity and wiki_to_adf are not useful here).
  Also included in the `any` fallback list.
- `MappingRow.tsx`: passes `row.sourceSchema` to `getTransformerOptions` in both display
  and auto-select-on-target-change paths.
- `SuggestionsPanel.tsx`: passes `s.sourceSchema` to `getTransformerOptions` on accept.

### i18n
- `en.json` + `sk.json`: added `settings.transformer.userName.{label,description}`.

## Verification
- `cargo test --lib field_transform::pipeline`: 18/18 passed
- `npx tsc --noEmit`: no errors
- `npx vitest run src/features/field-mapping`: 36/36 passed
