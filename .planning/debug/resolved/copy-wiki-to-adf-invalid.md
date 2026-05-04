---
status: resolved
trigger: "Error when copying a ticket — issue creation returns 400: description must be Atlassian Document Format, even though wiki_to_adf mapper reports ok"
created: 2026-05-04
updated: 2026-05-04
---

## Symptoms

- **Expected:** Ticket is copied successfully to target project
- **Actual:** Copy fails at issue creation step with HTTP 400
- **Error:** `Issue creation returned status 400: {"errorMessages":[],"errors":{"description":"Prevádzková hodnota musí byť Dokument Atlassian (pozrite si časť Formát dokumentu Atlassian)"}}`
- **Timeline:** Observed 2026-05-04
- **Reproduction:** Copy a ticket that has a wiki-markup description; mapper `wiki_to_adf` reports "ok" in the copy log but Jira rejects the payload

## Copy Log Excerpt

```
description  [wiki_to_adf]  ok
  source: "zakaznicka podpisala vymenu na novy pausal..."
  target: "zakaznicka podpisala vymenu na novy pausal..."
```

Note: target field in the log shows the raw wiki string, NOT an ADF document object — this is the likely clue.

## Current Focus

hypothesis: "CONFIRMED — see Evidence and Resolution"
test: ""
expecting: ""
next_action: "Apply fix in CopyPreviewPage.tsx prefill effect"
reasoning_checkpoint: ""

## Evidence

- timestamp: 2026-05-04T00:00:00Z
  file: src/features/tickets/CopyPreviewPage.tsx
  lines: 211-228
  observation: |
    The prefill effect includes `wiki_to_adf` in `PREFILLABLE_KINDS` (line 83).
    The guard at line 215 only skips prefill when `typeof rawValue !== 'string'`
    (Cloud ADF object case). For Jira Server sources the description field IS a
    plain string, so the guard does NOT fire and execution falls through to the
    else-prefill branch (lines 224-228):

      setOverrideValue(row.targetFieldId, rawValue);   // sets raw wiki string
      outcome = 'ok';
      targetValue = rawValue;

    This stores the raw wiki markup string in overrideValues[description].

- timestamp: 2026-05-04T00:00:00Z
  file: src-tauri/src/commands.rs
  lines: 1520-1523
  observation: |
    In copy_ticket_v2 Phase 5 override merge happens AFTER apply_mapping:

      for (k, v) in &args.override_values {
          resolved.fields.insert(k.clone(), v.clone());
      }

    apply_mapping (pipeline.rs) correctly converts the description to a proper
    ADF Value via wiki_to_adf::convert_and_postprocess. But Phase 5 overwrites
    that ADF object with the raw wiki string that the frontend placed in
    overrideValues. The final create_body therefore sends a plain string for
    description, which Jira Cloud rejects with HTTP 400.

- timestamp: 2026-05-04T00:00:00Z
  observation: |
    The copy log audit entry shows outcome='ok' and target=raw-string because
    the log is built by the frontend pre-fill path (log_preview_transformations),
    not by apply_mapping. The frontend genuinely believes it set the value
    correctly (it just set it to the wrong type).

## Eliminated

- wiki_to_adf Rust converter is NOT broken — convert_and_postprocess returns a
  proper {"version":1,"type":"doc",...} Value for any non-empty HTML/wiki input.
- apply_mapping pipeline.rs is NOT broken — the description dispatch path
  (is_description_row) calls wiki_to_adf correctly.
- The issue is purely in the frontend prefill effect overwriting the backend
  conversion result via the override_values merge.

## Resolution

root_cause: |
  CopyPreviewPage.tsx prefill effect treats `wiki_to_adf` rows the same as
  identity rows when the source value is a string. For Jira Server sources the
  raw description is a wiki-markup string, so the else-branch fires and stores
  the raw string in overrideValues[description]. Phase 5 of copy_ticket_v2 then
  overwrites the correctly-converted ADF object from apply_mapping with that
  raw string, causing Jira Cloud to return HTTP 400.

fix: |
  Remove 'wiki_to_adf' from PREFILLABLE_KINDS and add an explicit skip branch
  for wiki_to_adf rows regardless of the source value type. The conversion is
  entirely server-side (apply_mapping); the frontend must never prefill the
  description override. The audit log entry should record outcome='skipped' with
  failureReason='wiki_to_adf runs server-side at copy time'.

verification: "18/18 CopyPreviewPage tests pass. wiki_to_adf row now hits the !prefillable branch and is skipped at preview time; apply_mapping backend conversion runs unobstructed at copy time."
files_changed: "src/features/tickets/CopyPreviewPage.tsx"
