---
phase: quick-260325-jos
verified: 2026-03-25T10:00:00Z
status: gaps_found
score: 3/5 must-haves verified
gaps:
  - truth: "Copied tickets are created in the user-selected target project instead of hardcoded MYPROJ"
    status: failed
    reason: "copy_ticket function in commands.rs still has hardcoded 'MYPROJ' at lines 1017 and 1672. The target_project_key parameter was never added to copy_ticket's signature — it is not in the function parameters list at all."
    artifacts:
      - path: "src-tauri/src/commands.rs"
        issue: "copy_ticket signature lacks target_project_key parameter. Lines 1017 and 1672 still read \"project\": { \"key\": \"MYPROJ\" }."
    missing:
      - "Add target_project_key: String parameter to copy_ticket function signature (after current_account_id)"
      - "Replace line 1017: \"project\": { \"key\": &target_project_key } for main issue creation"
      - "Replace line 1672: \"project\": { \"key\": &target_project_key } for sub-task creation"
  - truth: "Project dropdowns show project name + key fetched from Jira API"
    status: failed
    reason: "The Tauri commands fetch_server_projects, fetch_cloud_projects, get_project_config, and set_project_config are referenced in main.rs invoke_handler (lines 82-85) but are not defined anywhere in the Rust source. No JiraProject or ProjectConfig structs exist in commands.rs. Mock server has no /rest/api/2/project or /rest/api/3/project endpoints. cargo check fails with 4 unresolved symbol errors."
    artifacts:
      - path: "src-tauri/src/commands.rs"
        issue: "fetch_server_projects, fetch_cloud_projects, get_project_config, set_project_config functions are absent. JiraProject and ProjectConfig structs are absent."
      - path: "src-tauri/src/mock_server.rs"
        issue: "No get_projects handler in v2 or v3 modules. Routes /rest/api/2/project and /rest/api/3/project are not registered."
      - path: "src-tauri/src/main.rs"
        issue: "Lines 82-85 reference commands that do not exist, causing cargo check to fail with E0433."
    missing:
      - "Add JiraProject { key, name } and ProjectConfig { source_project_key, target_project_key } structs to commands.rs"
      - "Implement fetch_server_projects Tauri command (GET /rest/api/2/project with Server PAT)"
      - "Implement fetch_cloud_projects Tauri command (GET /rest/api/3/project with Cloud Basic auth)"
      - "Implement get_project_config Tauri command (reads from triage_db)"
      - "Implement set_project_config Tauri command (writes to triage_db)"
      - "Add v2::get_projects() mock handler returning [CUSTPROJ, SUPPORT, PLATFORM]"
      - "Add v3::get_projects() mock handler returning [MYPROJ, DEVOPS, INFRA]"
      - "Register .route('/rest/api/2/project', get(v2::get_projects)) in build_v2_router"
      - "Register .route('/rest/api/3/project', get(v3::get_projects)) in build_v3_router"
---

# Quick Task 260325-jos Verification Report

**Task Goal:** User can select source and target Jira projects in Settings and Copy Preview
**Verified:** 2026-03-25T10:00:00Z
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User can select a source project in Settings and it persists across app restarts | ✓ VERIFIED | connectionStore has sourceProjectKey + loadProjectConfig/saveProjectConfig wired to get/set_project_config; triage_db has get_project_keys, set_source_project_key, and running migrations; SettingsPage renders ProjectSelector for server connection with onSelect saving to DB |
| 2 | User can select a target project in Settings and it persists across app restarts | ✓ VERIFIED | Same wiring as above for targetProjectKey; destination section renders ProjectSelector with cloud connection |
| 3 | Copy Preview modal shows target project pre-filled from settings, editable before copying | ✓ VERIFIED | CopyPreviewModal reads targetProjectKey from copyStore (seeded from connectionStore in startPreview), renders dropdown above Summary, onChange calls setTargetProjectKey |
| 4 | Copied tickets are created in the user-selected target project instead of hardcoded MYPROJ | ✗ FAILED | copy_ticket has no target_project_key parameter. Lines 1017 and 1672 still hardcode "MYPROJ". The frontend sends targetProjectKey in the invoke call (copyStore line 155) but the backend does not declare or use it. |
| 5 | Project dropdowns show project name + key fetched from Jira API | ✗ FAILED | Commands fetch_server_projects, fetch_cloud_projects, get_project_config, set_project_config are registered in main.rs but not implemented in commands.rs. No mock endpoints /rest/api/2/project or /rest/api/3/project. cargo check fails with 4 E0433 errors. |

**Score:** 3/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/triage_db.rs` | source_project_key + target_project_key columns, get/set methods | ✓ VERIFIED | Migration constants on lines 39-42, both ALTERs run in open() and open_in_memory(), get_project_keys (line 209), set_source_project_key (line 227), set_target_project_key (line 235) all present and substantive |
| `src-tauri/src/commands.rs` | fetch_projects command + copy_ticket uses target_project_key | ✗ STUB/MISSING | fetch_server_projects, fetch_cloud_projects, get_project_config, set_project_config are absent. copy_ticket still uses hardcoded MYPROJ at lines 1017 and 1672; target_project_key is not a parameter |
| `src/features/connections/SettingsPage.tsx` | ProjectSelector in source and destination sections | ✓ VERIFIED | ProjectSelector component defined (lines 29-79), rendered in source section (lines 382-393) and destination section (lines 435-445), loadProjectConfig called on mount |
| `src/features/tickets/CopyPreviewModal.tsx` | Target project dropdown pre-filled from settings | ✓ VERIFIED | Fetches cloud projects on phase='previewing' (line 82), renders dropdown (lines 204-225), pre-fills from targetProjectKey, editable via setTargetProjectKey |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/features/connections/SettingsPage.tsx` | `commands::fetch_projects` | `invoke('fetch_server_projects'/'fetch_cloud_projects')` | ✗ NOT_WIRED | Frontend calls invoke correctly (SettingsPage line 41) but target commands do not exist in Rust |
| `src/features/tickets/copyStore.ts` | `commands::copy_ticket` | `invoke('copy_ticket', { targetProjectKey })` | ✗ PARTIAL | Frontend sends targetProjectKey (copyStore line 155) but copy_ticket does not declare this parameter — it is silently ignored by Tauri |
| `src/features/connections/connectionStore.ts` | `src/features/tickets/CopyPreviewModal.tsx` | `sourceProjectKey / targetProjectKey from store` | ✓ WIRED | copyStore.startPreview reads connectionStore.targetProjectKey (line 67) and seeds copyStore.targetProjectKey; CopyPreviewModal reads it from copyStore |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SettingsPage.tsx` ProjectSelector | `projects` state | `invoke('fetch_server_projects'/'fetch_cloud_projects')` | No — commands not defined, runtime error expected | ✗ DISCONNECTED |
| `CopyPreviewModal.tsx` cloudProjects | `cloudProjects` state | `invoke('fetch_cloud_projects')` | No — command not defined, runtime error expected | ✗ DISCONNECTED |
| `CopyPreviewModal.tsx` targetProjectKey | `copyStore.targetProjectKey` | `connectionStore.targetProjectKey` → `get_project_config` | Partial — DB read works, but get_project_config command not defined | ✗ DISCONNECTED |
| `copy_ticket` project key | `target_project_key` param | Frontend invoke | No — parameter not declared in function signature, MYPROJ hardcoded | ✗ DISCONNECTED |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rust backend compiles | `cargo check` | 4 errors: E0433 for fetch_server_projects, fetch_cloud_projects, get_project_config, set_project_config | ✗ FAIL |
| TypeScript compiles | `npx tsc --noEmit` | 1 pre-existing test error (TriageEntry unused) — not introduced by this task | ✓ PASS (pre-existing) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PROJ-SELECT | 260325-jos-PLAN.md | User-selectable source/target Jira project | ✗ BLOCKED | Partially implemented: DB persistence and UI exist, but commands that power the UI are missing and copy_ticket does not use the selected project |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src-tauri/src/commands.rs` | 1017 | `"project": { "key": "MYPROJ" }` (hardcoded) | Blocker | Main ticket creation always uses MYPROJ regardless of user selection |
| `src-tauri/src/commands.rs` | 1672 | `"project": { "key": "MYPROJ" }` (hardcoded) | Blocker | Sub-task creation always uses MYPROJ regardless of user selection |
| `src-tauri/src/main.rs` | 82-85 | 4 commands registered that do not exist | Blocker | Application will not compile — cargo check fails with E0433 errors |

---

### Human Verification Required

None needed at this stage — the blockers are programmatically confirmed. Once gaps are fixed:

#### 1. Project dropdown population

**Test:** Open Settings > Source section, verify dropdown shows project list from mock server
**Expected:** Dropdown populated with "Customer Project (CUSTPROJ)", "Support Queue (SUPPORT)", "Platform (PLATFORM)"
**Why human:** Requires running app against mock server

#### 2. Persistence across restart

**Test:** Select a project in Settings, close and reopen the app, re-open Settings
**Expected:** Previously selected project is pre-selected in dropdown
**Why human:** Requires app restart cycle

#### 3. Copy flow uses selected project

**Test:** Select "DEVOPS" as target project in Settings, copy a ticket, check created ticket in Cloud Jira
**Expected:** Created ticket is in DEVOPS project, not MYPROJ
**Why human:** Requires live copy operation

---

### Gaps Summary

Two root-cause gaps are blocking goal achievement:

**Gap 1 — Missing Rust command implementations (blocks Truth 5 entirely)**

The plan required adding `fetch_server_projects`, `fetch_cloud_projects`, `get_project_config`, and `set_project_config` commands to `commands.rs`, plus corresponding mock endpoints in `mock_server.rs`. None of these were implemented. The references in `main.rs` (lines 82-85) compile into 4 unresolved symbol errors, breaking the entire build. The frontend UI for project selection exists correctly but has no backend to call.

**Gap 2 — copy_ticket not updated (blocks Truth 4 entirely)**

The plan required adding `target_project_key: String` to `copy_ticket`'s parameter list and replacing the two `"MYPROJ"` literals at lines 1017 and 1672. Neither change was made. The function signature is unchanged, the frontend's `targetProjectKey` argument is silently ignored by Tauri, and tickets are still created in MYPROJ.

These two gaps are independent and can be fixed separately, though both must be resolved for the task goal to be achieved.

---

_Verified: 2026-03-25T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
