---
status: resolved
trigger: "when i try to set priority static mapping in settings i get message 'Priority neboli načítané — najprv spustite náhľad kopírovania'"
created: 2026-05-20
updated: 2026-05-20
---

## Symptoms

- expected: Show priority options to pick from when setting a static mapping for priority in settings
- actual: Message 'Priority neboli načítané — najprv spustite náhľad kopírovania' appears instead of priority options
- errors: Slovak message indicating priorities not loaded, user must run copy preview first
- timeline: Unknown — not sure if this ever worked
- reproduction: Open settings → field mapping → priority → set static

## Current Focus

- hypothesis: "StaticValueWidget reads availablePriorities from copyStore.cloudMeta, which is only set after startPreview(). In settings, cloudMeta is always null, so priorities are never shown."
- test: "Open settings without running copy preview — priority static widget shows empty message"
- expecting: "Priority dropdown should load from fetch_cloud_meta eagerly, same pattern as issuetype uses preWarm"
- next_action: "resolved"
- reasoning_checkpoint: "Pattern already established for issuetype: schemaCacheStore.preWarm() called at FieldMappingSection mount. Priorities need same treatment."

## Evidence

- timestamp: 2026-05-20T00:00:00Z
  file: src/features/field-mapping/StaticValueWidget.tsx:35
  note: "reads `useCopyStore(s => s.cloudMeta?.availablePriorities ?? null)` — cloudMeta is null in settings context"

- timestamp: 2026-05-20T00:00:00Z
  file: src/features/field-mapping/StaticValueWidget.tsx:159-165
  note: "priority branch: if availablePriorities empty, renders translation key staticPriorityEmpty"

- timestamp: 2026-05-20T00:00:00Z
  file: src/i18n/locales/sk.json:453
  note: "staticPriorityEmpty = 'Priority neboli načítané — najprv spustite náhľad kopírovania' — confirms this is the exact message"

- timestamp: 2026-05-20T00:00:00Z
  file: src/features/tickets/copyStore.ts:102
  note: "fetch_cloud_meta is invoked inside startPreview() — only called when copy preview is started, not in settings"

- timestamp: 2026-05-20T00:00:00Z
  file: src/features/field-mapping/FieldMappingSection.tsx:196-198
  note: "issuetype solved same problem: preWarm(targetProjectKey) called on mount if not yet populated"

- timestamp: 2026-05-20T00:00:00Z
  file: src/stores/schemaCacheStore.ts
  note: "schemaCacheStore has prewarmedIssueTypes but no prewarmedPriorities — no eager priority fetch exists"

## Eliminated

- Not a backend issue — fetch_cloud_meta Tauri command works correctly (used by startPreview)
- Not a translation bug — message is intentional warning but wrong behaviour (should eagerly load)

## Resolution

- root_cause: "StaticValueWidget reads priorities from copyStore.cloudMeta which is only populated by startPreview(). In Settings (no copy in progress), cloudMeta is always null, so availablePriorities is always empty. No eager fetch of priorities existed for the settings context — unlike issuetype which uses schemaCacheStore.preWarm() on FieldMappingSection mount."
- fix: "Added prewarmedPriorities (CloudMetaPriority[] | null) and fetchPriorities() action to schemaCacheStore. FieldMappingSection now calls fetchPriorities() during its mount load sequence (no-op if already cached). StaticValueWidget priority branch now reads schemaCacheStore.prewarmedPriorities first, with copyStore.cloudMeta.availablePriorities as fallback for active copy previews."
- verification: "tsc --noEmit clean; 7/7 StaticValueWidget tests pass; 9/9 FieldMappingSection tests pass"
- files_changed: "src/stores/schemaCacheStore.ts, src/features/field-mapping/FieldMappingSection.tsx, src/features/field-mapping/StaticValueWidget.tsx"
