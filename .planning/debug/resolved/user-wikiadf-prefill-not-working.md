---
status: root_cause_found
trigger: "user or wiki->adf transformer kinds still don't prefill in the copy modal — they only work when mapped with identity transformer"
created: 2026-04-29
updated: 2026-04-29
---

# Debug Session: user-wikiadf-prefill-not-working

## Symptoms

- expected: User fields (transformer kind 'user') and description/wiki fields (transformer kind 'wiki_to_adf') should prefill their respective dropdowns/inputs in the copy modal when a mapping is configured
- actual: These fields remain empty unless the user changes the transformer kind to 'identity'
- scope: transformer kinds 'user' and 'wiki_to_adf' only; 'identity' and 'priority' work
- timeline: Since the copy modal prefill useEffect was added (ae1b047) — these were deliberately excluded from PREFILLABLE_KINDS

## Context

PREFILLABLE_KINDS = new Set(['identity', 'priority']) in both CopyPreviewModal.tsx and CopyPreviewPage.tsx.
'user' and 'wiki_to_adf' were excluded with the comment: "User / version / component require async resolution. Description is wiki_to_adf and handled server-side only."

The user reports these DO work when using identity transformer — meaning the raw source value shape is acceptable to the renderers. The question is whether adding 'user' and 'wiki_to_adf' to PREFILLABLE_KINDS is safe, or whether the renderers need special handling.

## Current Focus

hypothesis: "PREFILLABLE_KINDS excludes 'user' and 'wiki_to_adf', so the prefill useEffect never seeds overrideValues for those transformer kinds. For 'user': UserPickerRenderer.isJiraUser() already validates the raw JiraUser object shape (requires displayName: string), so raw source values ARE directly compatible. For 'wiki_to_adf': TextAreaRenderer already handles non-string gracefully (strValue = typeof value === 'string' ? value : '') — but description on a Jira Server source is a string, so it prefills cleanly; on Cloud the source is an ADF object which would result in '' (not useful but also not broken). The original comment 'handled server-side only' was a conservative exclusion."
test: "Code inspection confirms UserPickerRenderer accepts JiraUser shape directly via isJiraUser(). TextAreaRenderer accepts string directly."
expecting: "Adding 'user' and 'wiki_to_adf' to PREFILLABLE_KINDS in both CopyPreviewModal.tsx and CopyPreviewPage.tsx is the correct fix for 'user'. For 'wiki_to_adf': only prefill when the raw value is a plain string (Server v2 description); skip ADF objects."
next_action: "Apply fix"
reasoning_checkpoint: "Confirmed: the fix is safe. UserPickerRenderer shows the selected user via isJiraUser(value) check — if the raw source assignee/reporter object has displayName it will render immediately. TextAreaRenderer shows text via typeof value === 'string' check — ADF objects would silently become empty string (no regression). A targeted fix: add 'user' to PREFILLABLE_KINDS unconditionally; add 'wiki_to_adf' with a string-type guard in the prefill loop."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-04-29T00:00:00Z
  file: src/features/tickets/CopyPreviewModal.tsx:109
  note: "PREFILLABLE_KINDS = new Set(['identity', 'priority']) — 'user' and 'wiki_to_adf' deliberately excluded"

- timestamp: 2026-04-29T00:00:00Z
  file: src/features/tickets/CopyPreviewPage.tsx:106
  note: "Same PREFILLABLE_KINDS exclusion in page variant"

- timestamp: 2026-04-29T00:00:00Z
  file: src/features/field-renderers/renderers/UserPickerRenderer.tsx:7-10
  note: "isJiraUser(v) checks typeof v.displayName === 'string' — raw JiraUser from sourceTicket.fields passes this check"

- timestamp: 2026-04-29T00:00:00Z
  file: src/features/field-renderers/renderers/TextAreaRenderer.tsx:5
  note: "strValue = typeof value === 'string' ? value : '' — ADF object silently becomes empty; string passes through"

- timestamp: 2026-04-29T00:00:00Z
  file: src/features/tickets/types.ts:11-17
  note: "JiraUser interface: { name?, accountId?, displayName: string, avatarUrls?, emailAddress? } — sourceTicket.fields.assignee/reporter match this shape"

## Eliminated

- "User picker requires async resolution before prefill" — ELIMINATED. The UserPickerRenderer value prop accepts a full JiraUser object directly; it only needs async resolution when searching by query. If the raw source object is already a JiraUser, it renders immediately as a selected value.
- "wiki_to_adf would break the renderer" — ELIMINATED for Server v2 (string description). For Cloud v3 ADF objects the TextAreaRenderer safely falls back to ''.

## Resolution

root_cause: "PREFILLABLE_KINDS in both CopyPreviewModal.tsx and CopyPreviewPage.tsx excludes 'user' and 'wiki_to_adf' transformerKind values. The prefill useEffect skips those mapping rows entirely, so overrideValues is never seeded for user-type or description-type fields even though their renderers can consume the raw source value shapes directly."

fix: "Add 'user' to PREFILLABLE_KINDS unconditionally (raw JiraUser object is compatible with UserPickerRenderer). Add 'wiki_to_adf' with a typeof string guard in the prefill loop (only seed when the raw value is a plain string, i.e. Server v2 description; skip ADF objects silently). Apply in both CopyPreviewModal.tsx and CopyPreviewPage.tsx."
