---
phase: quick-260325-jos
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/triage_db.rs
  - src-tauri/src/commands.rs
  - src-tauri/src/mock_server.rs
  - src-tauri/src/main.rs
  - src/features/connections/connectionStore.ts
  - src/features/connections/SettingsPage.tsx
  - src/features/tickets/copyStore.ts
  - src/features/tickets/CopyPreviewModal.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
autonomous: true
requirements: [PROJ-SELECT]

must_haves:
  truths:
    - "User can select a source project in Settings and it persists across app restarts"
    - "User can select a target project in Settings and it persists across app restarts"
    - "Copy Preview modal shows target project pre-filled from settings, editable before copying"
    - "Copied tickets are created in the user-selected target project instead of hardcoded MYPROJ"
    - "Project dropdowns show project name + key fetched from Jira API"
  artifacts:
    - path: "src-tauri/src/triage_db.rs"
      provides: "app_config columns for source_project_key and target_project_key with get/set methods"
      contains: "source_project_key"
    - path: "src-tauri/src/commands.rs"
      provides: "fetch_projects Tauri command + copy_ticket uses target_project_key param instead of MYPROJ"
      contains: "fetch_projects"
    - path: "src/features/connections/SettingsPage.tsx"
      provides: "Project dropdown selectors in source and destination sections"
      contains: "ProjectSelector"
    - path: "src/features/tickets/CopyPreviewModal.tsx"
      provides: "Target project dropdown in copy preview, pre-filled from settings"
      contains: "targetProjectKey"
  key_links:
    - from: "src/features/connections/SettingsPage.tsx"
      to: "commands::fetch_projects"
      via: "invoke('fetch_projects')"
      pattern: "invoke.*fetch_projects"
    - from: "src/features/tickets/copyStore.ts"
      to: "commands::copy_ticket"
      via: "invoke('copy_ticket', { targetProjectKey })"
      pattern: "targetProjectKey"
    - from: "src/features/connections/connectionStore.ts"
      to: "src/features/tickets/CopyPreviewModal.tsx"
      via: "sourceProjectKey / targetProjectKey from store"
      pattern: "sourceProjectKey|targetProjectKey"
---

<objective>
Add source and target Jira project selection to the app. Users can pick their source (Server) and target (Cloud) project in Settings, which persists in the DB. The Copy Preview modal pre-fills the target project from settings but allows per-ticket override. The hardcoded "MYPROJ" in commands.rs is replaced with the user-selected project key.

Purpose: Currently the target project is hardcoded as "MYPROJ" — users cannot select which project tickets are copied into, making the app unusable for anyone whose project key differs.
Output: Working project selection in Settings + Copy Preview, persisted in DB, used during copy.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src-tauri/src/triage_db.rs
@src-tauri/src/commands.rs
@src-tauri/src/mock_server.rs
@src-tauri/src/main.rs
@src/features/connections/connectionStore.ts
@src/features/connections/SettingsPage.tsx
@src/features/connections/types.ts
@src/features/tickets/copyStore.ts
@src/features/tickets/CopyPreviewModal.tsx
@src/i18n/locales/en.json
@src/i18n/locales/sk.json

<interfaces>
<!-- Key types and contracts the executor needs -->

From src-tauri/src/triage_db.rs:
```rust
// app_config table (single row, id=1) currently has: id, language
// ConnectionMeta struct: connection_type, base_url, username, server_version, last_tested_at, status
const CREATE_APP_CONFIG_SQL: &str = "CREATE TABLE IF NOT EXISTS app_config (
    id       INTEGER PRIMARY KEY CHECK(id = 1),
    language TEXT NOT NULL DEFAULT 'en'
);";
```

From src-tauri/src/commands.rs:
```rust
// copy_ticket currently hardcodes "MYPROJ" at lines 1017 and 1672
pub async fn copy_ticket(
    source_key: String,
    source_base_url: String,
    target_base_url: String,
    target_summary: String,
    target_description: Option<String>,
    target_status: String,
    target_priority_id: String,
    target_labels: Vec<String>,
    current_account_id: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<CopyTicketResult, AppError>

// fetch_cloud_meta currently takes no base_url param (reads from credentials)
pub async fn fetch_cloud_meta(
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<CloudMeta, AppError>
```

From src/features/connections/connectionStore.ts:
```typescript
interface ConnectionState {
  serverConnection: ConnectionMeta | null;
  cloudConnection: ConnectionMeta | null;
  // ... setters, clearConnections, hasCompletedSetup
}
```

From src/features/tickets/copyStore.ts:
```typescript
confirmCopy: async (sourceBaseUrl, cloudBaseUrl) => {
  // invokes 'copy_ticket' with state fields
  const result = await invoke<CopyTicketResult>('copy_ticket', {
    sourceKey, sourceBaseUrl, targetBaseUrl, targetSummary,
    targetDescription, targetStatus, targetPriorityId,
    targetLabels, currentAccountId
  });
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend — Add project persistence, fetch_projects command, and wire target_project_key into copy_ticket</name>
  <files>
    src-tauri/src/triage_db.rs
    src-tauri/src/commands.rs
    src-tauri/src/mock_server.rs
    src-tauri/src/main.rs
  </files>
  <action>
**triage_db.rs — Extend app_config with project columns:**
1. Add an ALTER TABLE migration (same pattern as `ALTER_TRIAGE_ADD_COPIED_KEY`):
   ```rust
   const ALTER_APP_CONFIG_ADD_PROJECTS: &str = "ALTER TABLE app_config ADD COLUMN source_project_key TEXT;";
   const ALTER_APP_CONFIG_ADD_TARGET_PROJECT: &str = "ALTER TABLE app_config ADD COLUMN target_project_key TEXT;";
   ```
2. Run both ALTERs with `let _ = conn.execute_batch(...)` in both `open()` and `open_in_memory()` (silent failure if columns exist already).
3. Add getter/setter methods:
   ```rust
   pub fn get_project_keys(&self) -> AppResult<(Option<String>, Option<String>)>
   // Returns (source_project_key, target_project_key) from app_config

   pub fn set_source_project_key(&self, key: Option<&str>) -> AppResult<()>
   pub fn set_target_project_key(&self, key: Option<&str>) -> AppResult<()>
   ```

**commands.rs — Add fetch_projects and project config commands:**
1. Add a `JiraProject` response struct:
   ```rust
   #[derive(serde::Serialize, Clone, Debug)]
   pub struct JiraProject { pub key: String, pub name: String }
   ```
2. Add `fetch_server_projects` command: Takes `base_url: String`, uses Server PAT auth, calls `GET /rest/api/2/project`, returns `Vec<JiraProject>`.
3. Add `fetch_cloud_projects` command: Uses Cloud credentials (same pattern as `fetch_cloud_meta`), calls `GET /rest/api/3/project`, returns `Vec<JiraProject>`.
4. Add `get_project_config` command: Returns `{ sourceProjectKey: Option<String>, targetProjectKey: Option<String> }` from triage_db.
5. Add `set_project_config` command: Takes `sourceProjectKey: Option<String>`, `targetProjectKey: Option<String>`, stores both.
6. Modify `copy_ticket` — add `target_project_key: String` parameter (after `current_account_id`). Replace the two hardcoded `"MYPROJ"` references (lines 1017 and 1672) with `&target_project_key`. The sub-task creation at line 1672 also uses the same `target_project_key`.

**mock_server.rs — Add project list endpoints:**
1. Add `get_projects` handler to v2 module: Returns a JSON array with 2-3 fake projects, e.g. `[{"key":"CUSTPROJ","name":"Customer Project"},{"key":"SUPPORT","name":"Support Queue"}]`.
2. Add `get_projects` handler to v3 module: Returns a JSON array with 2-3 fake projects, e.g. `[{"key":"MYPROJ","name":"My Company Project"},{"key":"DEVOPS","name":"DevOps"}]`.
3. Register routes: `.route("/rest/api/2/project", get(v2::get_projects))` and `.route("/rest/api/3/project", get(v3::get_projects))` in `build_v2_router` and `build_v3_router` respectively.
   NOTE: v3 router already has `/rest/api/3/project/{key}/statuses` — the new `/rest/api/3/project` route (no path param) does NOT conflict.

**main.rs — Register new commands:**
Add `commands::fetch_server_projects`, `commands::fetch_cloud_projects`, `commands::get_project_config`, `commands::set_project_config` to the `invoke_handler` list.
  </action>
  <verify>
    <automated>cd src-tauri && cargo check 2>&1 | tail -5</automated>
  </verify>
  <done>
    - app_config table has source_project_key and target_project_key columns
    - fetch_server_projects and fetch_cloud_projects commands fetch from Jira API
    - get/set_project_config commands persist project keys in DB
    - copy_ticket accepts target_project_key and uses it instead of MYPROJ
    - Mock server serves project list endpoints for both v2 and v3
    - cargo check passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Frontend — Project selectors in Settings and Copy Preview, store wiring, i18n</name>
  <files>
    src/features/connections/connectionStore.ts
    src/features/connections/SettingsPage.tsx
    src/features/tickets/copyStore.ts
    src/features/tickets/CopyPreviewModal.tsx
    src/i18n/locales/en.json
    src/i18n/locales/sk.json
  </files>
  <action>
**connectionStore.ts — Add project key state:**
Add `sourceProjectKey: string | null` and `targetProjectKey: string | null` fields with setters. Add a `loadProjectConfig` action that invokes `get_project_config` and sets both keys. Add `saveProjectConfig(source, target)` that invokes `set_project_config`.

**SettingsPage.tsx — Add project dropdowns to source and destination sections:**
1. Create an inline `ProjectSelector` component (within SettingsPage or as a small helper in the same file):
   - Props: `connectionType: 'server' | 'cloud'`, `baseUrl: string`, `currentKey: string | null`, `onSelect: (key: string) => void`
   - On mount (useEffect with baseUrl dep), invoke `fetch_server_projects` or `fetch_cloud_projects` depending on type.
   - Render a `<select>` (styled with brand classes) showing "Project Name (KEY)" for each project.
   - Show a loading state while fetching.
   - If current key is set, pre-select it. If not, show a "Select project..." placeholder.

2. In the `'source'` section (after the ConnectionCard or edit form), render `<ProjectSelector connectionType="server" baseUrl={serverConn.baseUrl} currentKey={sourceProjectKey} onSelect={...} />`.
   - On select: update connectionStore `sourceProjectKey` and invoke `set_project_config`.

3. In the `'destination'` section, render `<ProjectSelector connectionType="cloud" baseUrl={cloudConn.baseUrl} currentKey={targetProjectKey} onSelect={...} />`.
   - On select: update connectionStore `targetProjectKey` and invoke `set_project_config`.

4. On SettingsPage mount, call `loadProjectConfig()` from connectionStore to hydrate project keys.

**copyStore.ts — Add targetProjectKey to copy flow:**
1. Add `targetProjectKey: string` field to CopyState (default empty string).
2. Add `setTargetProjectKey` setter.
3. In `startPreview`: read `targetProjectKey` from connectionStore and set it in copy state.
4. In `confirmCopy`: pass `targetProjectKey` to the `copy_ticket` invoke call.

**CopyPreviewModal.tsx — Add target project dropdown:**
1. Read `targetProjectKey` and `setTargetProjectKey` from copyStore.
2. Read `cloudConnection` from connectionStore to get base URL.
3. On the preview screen (phase === 'previewing'), add a target project dropdown above the existing fields. Use the same `fetch_cloud_projects` invoke to load options. Pre-fill from `targetProjectKey`. Allow user to change before confirming.
4. Style: same pattern as the existing priority/status dropdowns in the modal — a labeled field row with a select element.

**i18n — Add translation keys:**
Add to en.json:
```json
"settings.project": "Default Project",
"settings.project.source": "Source Project",
"settings.project.target": "Target Project",
"settings.project.select": "Select project...",
"settings.project.loading": "Loading projects...",
"settings.project.error": "Failed to load projects",
"copy.targetProject": "Target Project"
```
Add equivalent Slovak translations to sk.json.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit 2>&1 | tail -10</automated>
  </verify>
  <done>
    - Settings page shows project dropdown in both source and destination sections
    - Selected projects persist in DB and survive app restart
    - Copy Preview modal shows target project pre-filled from settings
    - User can change target project per-ticket in Copy Preview before confirming
    - copy_ticket invoke sends the selected targetProjectKey
    - TypeScript compiles without errors
    - All i18n keys present in both en.json and sk.json
  </done>
</task>

</tasks>

<verification>
1. `cd src-tauri && cargo check` — Rust compiles with new commands and modified copy_ticket
2. `npx tsc --noEmit` — TypeScript compiles with new store fields and UI
3. Manual: Open Settings > Source section shows project dropdown populated from mock server
4. Manual: Open Settings > Destination section shows project dropdown populated from mock server
5. Manual: Select projects, close and reopen app — selections persist
6. Manual: Copy a ticket — Copy Preview shows target project, can change it, ticket is created in selected project
</verification>

<success_criteria>
- No more hardcoded "MYPROJ" in commands.rs
- Project selection dropdowns visible in Settings for both source and destination
- Copy Preview modal has editable target project field
- Selected project keys persisted in app_config SQLite table
- Both cargo check and tsc --noEmit pass
</success_criteria>

<output>
After completion, create `.planning/quick/260325-jos-i-want-the-user-to-be-able-to-select-sou/260325-jos-SUMMARY.md`
</output>
