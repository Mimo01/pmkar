# Phase 2: Connection Setup - Research

**Researched:** 2026-03-20
**Domain:** Tauri IPC, Jira REST API auth, Zustand state, React multi-step wizard
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Wizard flow**
- Multi-step wizard: Step 1 (Customer Jira Server) -> Step 2 (Company Jira Cloud) -> Step 3 (Summary)
- "Test Connection" is required before proceeding to the next step — "Next" button disabled until test succeeds
- Step 3 shows a summary card with both connections, green checkmarks, base URLs, and a "Done" button
- Wizard shows on first launch only — after that, user accesses settings manually
- Progress indicator with step dots at top (Customer -> Company -> Done)

**Validation & error handling**
- Connection test result appears inline below the "Test Connection" button (not toast or modal)
- Success shows: authenticated username and Jira version (e.g., "Connected as john.doe — Jira Server v8.20.0")
- Error messages are specific and actionable per HTTP status:
  - 401 → "Authentication failed — check your PAT is valid"
  - 403 → "PAT lacks required permissions"
  - 429 → "Rate limited — try again in X seconds"
  - 5xx → "Server error — try again later"
  - Network error → "Cannot reach server — check URL"
- During test: button shows spinner and becomes disabled, form fields locked until test completes

**Post-setup access**
- Dedicated Settings/Connections page accessible from a gear icon in the app header
- Each connection shown as a card with: green/red status dot, base URL, "Last tested: X ago", server version from last test, and an [Edit] button
- Editing a connection requires manual re-test (same flow as initial setup — not auto-test on save)

**Form fields & labels**
- Connection labels: "Source (Customer Jira)" and "Destination (Company Jira)"
- PAT/token fields: masked by default (password input) with eye icon toggle to reveal/hide
- Inline help link below each secret field: "Where do I find this?" linking to Jira documentation
- Client-side URL validation: must start with https://, trailing slashes stripped, inline error for malformed URLs
- Customer Jira Server fields: Base URL, Personal Access Token
- Company Jira Cloud fields: Base URL, Email, API Token

### Claude's Discretion
- Exact Tailwind styling, spacing, and typography
- Step transition animations (if any)
- Form layout details (label placement, field widths)
- Error boundary behavior within the wizard
- How "Where do I find this?" links are implemented (tooltip vs external link)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONN-01 | User can configure connection to customer's self-hosted Jira Server via base URL and PAT | Wizard Step 1, `test_jira_server_connection` Tauri command, `store_credential("jira-server", username, pat)` |
| CONN-02 | User can configure connection to company's Jira Cloud via base URL, email, and API token | Wizard Step 2, `test_jira_cloud_connection` Tauri command, `store_credential("jira-cloud", email, token)` |
| CONN-04 | User can test each connection and see clear success/failure feedback | `TestResult` component with `role="status"` / `role="alert"`, inline below "Test Connection" button |
| CONN-05 | App displays meaningful error messages for auth failures (401), permission errors (403), rate limits (429), and server errors (5xx) | Rust command returns structured `ConnectionTestResult` with `status_code`; frontend maps to copy strings |
| CONN-06 | Setup wizard guides user through configuring both connections step-by-step | `SetupWizard` → `WizardStep` → `StepProgress` component tree; step state in Zustand connection store |
</phase_requirements>

---

## Summary

Phase 2 builds the entire connection configuration surface: a 3-step wizard, a settings page, and the backend plumbing to validate Jira credentials. All infrastructure already exists from Phase 1 — `store_credential` / `get_credential` Tauri commands are ready, the mock servers are running on `:8080` and `:8081`, and the audited HTTP client is wired up. The main work is threefold: (1) add two new Tauri commands for connection testing that call `GET /rest/api/2/myself` + `GET /rest/api/2/serverInfo` (Server) and `GET /rest/api/3/myself` + `GET /rest/api/3/serverInfo` (Cloud), (2) add those endpoints to the mock server, and (3) build the React wizard and settings components.

The mock server gap is the critical path risk: neither `GET /rest/api/2/myself` nor `GET /rest/api/2/serverInfo` (and their v3 equivalents) exist in the current routes. Connection validation cannot work without these. They must be added in the first wave of this phase before any frontend testing can proceed.

State management requires a new Zustand store (`useConnectionStore`) that holds the configured connection metadata (base URL, username, last-tested timestamp, server version) — not the credentials themselves (those live in the OS keychain). App.tsx needs routing logic: render `SetupWizard` when no connections are configured, render the normal app when both are configured.

**Primary recommendation:** Add mock server endpoints first (Wave 0 blocker), then build the two Tauri test commands, then build the React wizard. The UI spec in `02-UI-SPEC.md` is already approved — follow it precisely.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.0.0 | Wizard and settings components | Already installed, Phase 1 decision |
| TypeScript | 5.7.3 | Type safety for connection state | Already configured |
| Tailwind CSS v4 | 4.2.2 | All styling — raw utilities, no component library | Phase 1 decision; UI-SPEC uses it throughout |
| Zustand | 5.0.12 | `useConnectionStore` — connection metadata state | Already installed, Phase 1 decision |
| @tauri-apps/api | 2.10.1 | `invoke()` to call Rust commands | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3.0 | Component unit tests | Testing wizard and form components |
| vitest | 4.1.0 | Test runner | All frontend tests |
| reqwest (Rust) | 0.13 | HTTP client in Rust test commands | Already in Cargo.toml |
| axum (Rust) | 0.8 | Add mock endpoint handlers | Already in Cargo.toml |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand | React `useState` in wizard | useState is sufficient for step state but connection persistence across pages requires a store |
| Inline routing in App.tsx | React Router | React Router is not installed; simple conditional render in App.tsx is sufficient for wizard-vs-app toggle |

**Installation:** No new npm packages required. No new Cargo dependencies required. All libraries already present.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── features/
│   └── connections/
│       ├── SetupWizard.tsx          # Top-level wizard — manages currentStep state
│       ├── WizardStep.tsx           # Single step wrapper (title, subtitle, children)
│       ├── StepProgress.tsx         # 3-dot progress indicator
│       ├── ConnectionForm.tsx       # URL + secret fields + "Test Connection" button
│       ├── TestResult.tsx           # Inline success/error beneath button
│       ├── SecretInput.tsx          # Password field with eye-icon toggle
│       ├── SummaryStep.tsx          # Step 3 read-only summary card
│       ├── ConnectionCard.tsx       # Settings page card per connection
│       ├── SettingsPage.tsx         # Gear icon destination — two ConnectionCard components
│       └── connectionStore.ts       # Zustand store for connection metadata
├── components/
│   └── ui/
│       ├── AppShell.tsx             # Add gear icon to header in this phase
│       ├── ErrorBoundary.tsx        # Wrap wizard and settings page
│       └── StatusBadge.tsx          # Reuse in ConnectionCard for status dot
src-tauri/src/
├── commands.rs                       # Add test_jira_server_connection, test_jira_cloud_connection
├── mock_server.rs                    # Add /myself and /serverInfo routes for both routers
└── lib.rs                            # Register new commands in tauri::generate_handler!
```

### Pattern 1: Tauri Command for Connection Testing

**What:** A Rust `#[tauri::command]` that accepts base URL + credential, calls `GET /rest/api/2/myself` and `GET /rest/api/2/serverInfo` via the audited HTTP client, and returns a structured result the frontend maps to success/error copy.

**When to use:** Both connection test flows (Server and Cloud) follow this pattern.

```rust
// src-tauri/src/commands.rs — new command
#[derive(serde::Serialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub username: Option<String>,      // displayName from /myself
    pub server_version: Option<String>, // version from /serverInfo
    pub error_kind: Option<String>,    // "auth" | "forbidden" | "rate_limit" | "server_error" | "network"
    pub retry_after_secs: Option<u64>, // only set when error_kind == "rate_limit"
}

#[tauri::command]
pub async fn test_jira_server_connection(
    base_url: String,
    pat: String,
    db: State<'_, Mutex<AuditDb>>,
) -> Result<ConnectionTestResult, AppError> {
    // 1. Build audited client
    // 2. GET {base_url}/rest/api/2/myself with Authorization: Bearer {pat}
    // 3. GET {base_url}/rest/api/2/serverInfo (no auth required for serverInfo on most instances)
    // 4. Map HTTP status codes to ConnectionTestResult
}

// Cloud variant: Authorization: Basic base64(email:token)
// Endpoint: GET {base_url}/rest/api/3/myself  + GET {base_url}/rest/api/3/serverInfo
```

**Auth headers:**
- Jira Server (PAT): `Authorization: Bearer {pat}`
- Jira Cloud (email + API token): `Authorization: Basic {base64(email:token)}`

**Important:** The audited client (Phase 1) automatically redacts the Authorization header before writing to SQLite. Use it — do not create a bare `reqwest::Client`.

### Pattern 2: Zustand Connection Store

**What:** A Zustand store that holds non-secret connection metadata persisted in the wizard. Credentials are never stored in Zustand — they live in the OS keychain.

```typescript
// src/features/connections/connectionStore.ts
import { create } from 'zustand';

export type ConnectionStatus = 'unconfigured' | 'ok' | 'error';

export interface ConnectionMeta {
  baseUrl: string;
  username: string;         // displayName from /myself
  serverVersion: string;    // version from /serverInfo
  lastTestedAt: string;     // ISO timestamp
  status: ConnectionStatus;
}

interface ConnectionState {
  serverConnection: ConnectionMeta | null;
  cloudConnection: ConnectionMeta | null;
  setServerConnection: (meta: ConnectionMeta) => void;
  setCloudConnection: (meta: ConnectionMeta) => void;
  clearConnections: () => void;
  hasCompletedSetup: () => boolean;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  serverConnection: null,
  cloudConnection: null,
  setServerConnection: (meta) => set({ serverConnection: meta }),
  setCloudConnection: (meta) => set({ cloudConnection: meta }),
  clearConnections: () => set({ serverConnection: null, cloudConnection: null }),
  hasCompletedSetup: () => get().serverConnection !== null && get().cloudConnection !== null,
}));
```

**Note:** The store is in-memory only for Phase 2. Metadata persistence (across restarts) is a later concern — CONN-03 covers credential persistence (OS keychain), and connection metadata can be derived on next launch by re-reading keychain entries.

### Pattern 3: App.tsx Routing — Wizard vs Main App

**What:** App.tsx reads `hasCompletedSetup()` from the store. On first launch (no connections), it renders `SetupWizard`. After wizard completes ("Done" clicked), the store has both connections and the main app renders.

```tsx
// src/App.tsx
import { SetupWizard } from './features/connections/SetupWizard';
import { SettingsPage } from './features/connections/SettingsPage';
import { useConnectionStore } from './features/connections/connectionStore';
import { AppShell } from './components/ui/AppShell';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

function App() {
  const hasSetup = useConnectionStore((s) => s.hasCompletedSetup());
  const [showSettings, setShowSettings] = useState(false);

  return (
    <ErrorBoundary>
      <AppShell onGearClick={() => setShowSettings(true)}>
        {!hasSetup ? (
          <SetupWizard />
        ) : showSettings ? (
          <SettingsPage onClose={() => setShowSettings(false)} />
        ) : (
          <DevStatusPanel /> // Phase 1 panel — will be replaced in Phase 3
        )}
      </AppShell>
    </ErrorBoundary>
  );
}
```

### Pattern 4: Mock Server — New Endpoints Required

**What:** The current mock server has no `/myself` or `/serverInfo` routes. These are critical blockers for connection test commands. They must be added to both the v2 and v3 routers.

```rust
// In mock_server.rs, add to build_v2_router:
.route("/rest/api/2/myself", get(v2::get_myself))
.route("/rest/api/2/serverInfo", get(v2::get_server_info))

// In mock_server.rs, add to build_v3_router:
.route("/rest/api/3/myself", get(v3::get_myself))
.route("/rest/api/3/serverInfo", get(v3::get_server_info))
```

**Response shapes (confirmed from Jira API docs):**

```rust
// v2/myself — Jira Server
// Returns: name, displayName, emailAddress, active, avatarUrls, self
json!({
    "name": "jdoe",
    "displayName": "John Doe",
    "emailAddress": "jdoe@example.com",
    "active": true,
    "self": format!("{}/rest/api/2/user?username=jdoe", base_url)
})

// v2/serverInfo — Jira Server
// Returns: version, buildNumber, buildDate, serverTitle, baseUrl
json!({
    "version": "8.20.0",
    "buildNumber": 802000,
    "buildDate": "2022-01-01T00:00:00.000+0000",
    "serverTitle": "Mock Jira Server",
    "baseUrl": "http://127.0.0.1:8080"
})

// v3/myself — Jira Cloud
// Returns: accountId, displayName, emailAddress, active, avatarUrls
json!({
    "accountId": "5b10a2844c20165700ede21g",
    "displayName": "John Doe",
    "emailAddress": "jdoe@example.com",
    "active": true,
    "accountType": "atlassian"
})

// v3/serverInfo — Jira Cloud
json!({
    "version": "1001.0.0",
    "buildNumber": 100229,
    "serverTitle": "Mock Jira Cloud",
    "baseUrl": "http://127.0.0.1:8081",
    "deploymentType": "Cloud"
})
```

**For success message:** The success string "Connected as {username} — Jira Server v8.20.0" is built from:
- Server: `myself.name` (or `myself.displayName`) + `serverInfo.version`
- Cloud: `myself.displayName` (no `name` field in v3) + `serverInfo.version`

### Pattern 5: Credential Storage Key Convention

The existing `store_credential` / `get_credential` commands use `(connection_type, username)` as the keychain key:
- Server connection: `store_credential("jira-server", server_username, pat)`
- Cloud connection: `store_credential("jira-cloud", email, api_token)`

The `username` parameter doubles as the lookup key. For the Server case, use `myself.name` (the Jira username) as the keychain username. For Cloud, use the email address. This aligns with what `get_credential` needs to look up the secret later.

**Retrieving credentials:** Phase 3 will need to call `get_credential("jira-server", stored_username)`. The store must persist the username alongside the base URL so Phase 3 can reconstruct both.

### Anti-Patterns to Avoid

- **Storing credentials in Zustand:** The store holds metadata only. Credentials live in the OS keychain and must never touch React state or be logged.
- **Auto-testing on field change:** The wizard only tests when "Test Connection" is clicked. Do not debounce-test as user types.
- **Creating a bare reqwest::Client in test commands:** Always use the audited client (`build_audited_client`) — every outbound HTTP call must appear in the audit log.
- **Resetting "Next" visible state only on button click:** "Next" must also hide when any form field is edited after a successful test (see UI-SPEC interaction contract).
- **Using `name` field from v3/myself:** Jira Cloud v3 does not return a `name` field on the user object — use `displayName` instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Credential storage | Custom encrypted file, sqlite blob | Existing `store_credential` / `get_credential` Tauri commands | Phase 1 already implements OS keychain integration; re-implementing risks plaintext exposure |
| HTTP audit logging | Custom logging in test commands | Use `build_audited_client` from `audit.rs` | Phase 1 middleware handles redaction, SQLite insert, truncation — all edge cases handled |
| URL validation | Complex regex | Simple `startsWith("https://")` check + `URL` constructor | Jira URLs are well-formed; overthinking this creates false negatives |
| Error type mapping | Try-catch on raw `invoke` with string parsing | Typed `ConnectionTestResult.error_kind` enum from Rust | Parsing Tauri error strings is fragile; push the classification to Rust where HTTP status is available |
| Step state machine | Custom class-based state machine | Plain React `useState(1)` for `currentStep` with derived booleans | The wizard has 3 steps; a full state machine library (XState) is overkill |

---

## Common Pitfalls

### Pitfall 1: Missing Mock Routes — Test Commands Fail Silently

**What goes wrong:** `test_jira_server_connection` calls `GET /rest/api/2/myself` which is not in the mock router. Axum returns 404. The Rust command interprets 404 as a non-specific error. Frontend shows "Server error — try again later" instead of a clear "connected" message.

**Why it happens:** The mock server was built for ticket CRUD only; auth validation endpoints were not needed in Phase 1.

**How to avoid:** Add `/rest/api/2/myself`, `/rest/api/2/serverInfo`, `/rest/api/3/myself`, `/rest/api/3/serverInfo` to the mock routers as the very first task of this phase.

**Warning signs:** Test button always shows "Server error" in dev mode even with correct mock credentials.

### Pitfall 2: Jira v3 Has No `name` Field on User

**What goes wrong:** Code reads `myself["name"]` for the Cloud connection. The v3 API omits `name` (privacy-oriented design); only `accountId` and `displayName` are returned. The success message shows "Connected as — Jira Cloud v1001.0.0".

**Why it happens:** v2 and v3 user representations differ. v2 returns `name` (username), v3 returns `accountId` + `displayName`.

**How to avoid:** For Cloud connections, always use `displayName` from `/rest/api/3/myself`. For Server connections, use `name` (username) as it is the human-readable identifier and matches the keychain lookup key.

### Pitfall 3: Wizard "Next" Not Re-Hidden After Field Edit

**What goes wrong:** User tests successfully, "Next" appears. User edits the URL field. "Next" remains visible. User clicks "Next" with unchecked credentials. Backend may be called with stale or mismatched credentials.

**Why it happens:** The "Next" visibility is set on test success and never re-evaluated.

**How to avoid:** `ConnectionForm` must track a `testedValues` snapshot (the URL + secret values at test time). An `onChange` handler on any field compares current values to `testedValues`; if they differ, `setNextVisible(false)`. This is the interaction contract from UI-SPEC.

### Pitfall 4: AppShell Doesn't Accept `onGearClick`

**What goes wrong:** SettingsPage has no way to be triggered. The gear icon exists in the UI-SPEC but `AppShell` currently takes only `children` — no gear icon, no callback prop.

**Why it happens:** AppShell was built as a minimal shell in Phase 1.

**How to avoid:** Update `AppShell` to accept an optional `onGearClick?: () => void` prop. When provided, render a gear icon button in the header. This change is surgical — existing usage passes no `onGearClick` and the component degrades gracefully.

### Pitfall 5: Tauri Command Registration

**What goes wrong:** New `test_jira_server_connection` and `test_jira_cloud_connection` commands compile but are never callable from the frontend — `invoke` returns "Command not found".

**Why it happens:** Tauri commands must be registered in `tauri::generate_handler![]` inside `lib.rs`. Forgetting to add new commands there is a common oversight.

**How to avoid:** After writing each new command, immediately add it to the handler list in `lib.rs`. Verify by calling `invoke("test_jira_server_connection", ...)` from the frontend before moving on.

### Pitfall 6: Keychain `get_credential` Username Must Match `store_credential` Username

**What goes wrong:** `store_credential("jira-server", "john.doe", pat)` stores the secret under username "john.doe". Phase 3 tries `get_credential("jira-server", "jdoe")` (using the Jira `name` field from a different API response) and gets `NoEntry` error.

**Why it happens:** The keychain key is `(service, username)`. If the username string differs between store and retrieve, they are different entries.

**How to avoid:** The Zustand store must persist the exact username string used at store time. Always derive the username from `myself.name` (Server) or email address (Cloud) at test time and store both to keychain AND to the Zustand store as `ConnectionMeta.username`.

---

## Code Examples

Verified patterns from existing codebase:

### Invoking a Tauri command (existing pattern from DevStatusPanel.tsx)
```typescript
// Source: src/features/dev/DevStatusPanel.tsx
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<MockServerStatus>('ping_mock_servers');
// For new commands:
const result = await invoke<ConnectionTestResult>('test_jira_server_connection', {
  baseUrl: 'https://jira.example.com',
  pat: 'my-pat',
});
```

### Mocking invoke in tests (existing pattern from App.test.tsx)
```typescript
// Source: src/App.test.tsx
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === 'test_jira_server_connection') {
      return Promise.resolve({
        success: true,
        username: 'john.doe',
        serverVersion: '8.20.0',
        errorKind: null,
        retryAfterSecs: null,
      });
    }
    return Promise.resolve(null);
  }),
}));
```

### Zustand store usage (Zustand 5 pattern — matches installed version)
```typescript
// Zustand 5 create — no middleware needed for this use case
import { create } from 'zustand';

// Reading from store in a component:
const serverConn = useConnectionStore((s) => s.serverConnection);

// Writing to store:
const setServer = useConnectionStore((s) => s.setServerConnection);
setServer({ baseUrl, username, serverVersion, lastTestedAt, status: 'ok' });
```

### Credential store/retrieve (existing Tauri commands)
```typescript
// Store (after successful test):
await invoke('store_credential', {
  connectionType: 'jira-server',
  username: testResult.username,  // e.g., "john.doe"
  secret: pat,
});

// Retrieve (in later phases):
const secret = await invoke<string>('get_credential', {
  connectionType: 'jira-server',
  username: storedUsername,
});
```

### Rust HTTP request with audited client (pattern from commands.rs)
```rust
// Always use build_audited_client — never bare reqwest::Client
use crate::audit::{AuditDb, build_audited_client};
use std::sync::{Arc, Mutex};
use tauri::State;

pub async fn test_jira_server_connection(
    base_url: String,
    pat: String,
    db: State<'_, Mutex<AuditDb>>,
) -> Result<ConnectionTestResult, AppError> {
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let resp = client
        .get(format!("{}/rest/api/2/myself", base_url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", pat))
        .send()
        .await
        .map_err(|_| AppError::Http("HTTP request failed".into()))?;
    // ... status code mapping
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jira Server `name` field for user identity | Jira Cloud v3 uses `accountId` + `displayName` (no `name`) | Jira Cloud API v3 migration | Server code reads `name`, Cloud code reads `displayName` |
| PAT auth: `Authorization: Bearer {token}` | Jira Cloud: Basic auth `Authorization: Basic base64(email:token)` | Always separate; Jira Cloud never supported Bearer for API tokens | Must use different auth header construction per connection type |
| React Router for page navigation | Simple conditional render in App.tsx | Not applicable — no router installed | Wizard-vs-settings navigation is `useState(showSettings)` not URL-based routing |

**Deprecated/outdated:**
- `ping_mock_servers` command: No longer the primary dev validation after Phase 2; connection test commands replace it for non-developer use

---

## Open Questions

1. **Connection metadata persistence across restarts**
   - What we know: Credentials persist in OS keychain (CONN-03, Phase 1 complete). `useConnectionStore` is in-memory only.
   - What's unclear: Should `ConnectionMeta` (base URL, username, server version, last tested) persist across app restarts in Phase 2, or is that Phase 3's problem?
   - Recommendation: Store minimal metadata (base URL + username) in a Tauri-managed config file or derive it on startup by checking if keychain entries exist for `jira-server` and `jira-cloud`. For Phase 2, detecting "setup already done" based on keychain entry existence is sufficient.

2. **`serverInfo` auth requirement**
   - What we know: On some Jira Server instances, `/rest/api/2/serverInfo` does not require authentication. On others it does.
   - What's unclear: Should the Rust command retry `/serverInfo` without auth if the authenticated request fails?
   - Recommendation: Always send the same credentials to `/serverInfo` as to `/myself`. If `/serverInfo` returns 401, still treat the connection as "success" (the `/myself` call already confirmed auth) and omit the version from the success message: "Connected as john.doe — version unavailable".

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 + @testing-library/react 16.3.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --reporter=verbose src/features/connections` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONN-01 | Server connection form accepts base URL + PAT | unit | `npm test -- src/features/connections/ConnectionForm.test.tsx` | ❌ Wave 0 |
| CONN-02 | Cloud connection form accepts base URL + email + API token | unit | `npm test -- src/features/connections/ConnectionForm.test.tsx` | ❌ Wave 0 |
| CONN-04 | TestResult renders success message from invoke result | unit | `npm test -- src/features/connections/TestResult.test.tsx` | ❌ Wave 0 |
| CONN-05 | TestResult renders correct error string for each HTTP status code | unit | `npm test -- src/features/connections/TestResult.test.tsx` | ❌ Wave 0 |
| CONN-06 | SetupWizard renders Step 1, advances to Step 2 on "Next", renders Summary | unit | `npm test -- src/features/connections/SetupWizard.test.tsx` | ❌ Wave 0 |
| CONN-06 | "Next" button hidden until test succeeds | unit | `npm test -- src/features/connections/SetupWizard.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- src/features/connections`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/features/connections/ConnectionForm.test.tsx` — covers CONN-01, CONN-02: form renders correct fields per connection type, URL validation fires on blur, "Test Connection" calls invoke with correct args
- [ ] `src/features/connections/TestResult.test.tsx` — covers CONN-04, CONN-05: renders success text, renders each error copy string, uses `role="alert"` for errors and `role="status"` for success
- [ ] `src/features/connections/SetupWizard.test.tsx` — covers CONN-06: step progression, "Next" gating, wizard completion calls setServerConnection/setCloudConnection
- [ ] `src/features/connections/SecretInput.test.tsx` — eye icon toggles input type between password/text, aria-label changes correctly

---

## Sources

### Primary (HIGH confidence)

- Existing codebase — `src-tauri/src/commands.rs`, `keychain.rs`, `mock_server.rs`, `error.rs`, `jira_client.rs`: read directly; all patterns are verified from running Phase 1 code
- Existing codebase — `src/features/dev/DevStatusPanel.tsx`, `src/App.test.tsx`: verified invoke pattern and vi.mock pattern
- `.planning/phases/02-connection-setup/02-UI-SPEC.md`: approved UI contract; all component names, copy strings, color classes, and interaction states are locked
- `.planning/phases/02-connection-setup/02-CONTEXT.md`: locked decisions — research confirmed all are feasible with existing stack

### Secondary (MEDIUM confidence)

- [Jira Cloud REST API v3 — Myself endpoint](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-myself/) — confirmed: v3 user object has `accountId`, `displayName`, no `name` field
- [Jira Data Center REST API — Myself endpoint](https://developer.atlassian.com/server/jira/platform/rest/v11000/api-group-myself/) — confirmed: v2 user object has `name`, `displayName`
- [Jira Cloud REST API v2 — Server Info](https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-server-info/) — confirmed: `version`, `buildNumber`, `serverTitle`, `baseUrl` fields
- WebSearch (verified with Atlassian docs): `/rest/api/2/myself` returns `name`, `displayName`, `emailAddress`; `/rest/api/2/serverInfo` returns `version`, `buildNumber`

### Tertiary (LOW confidence)

- serverInfo auth requirement variability: based on community reports; verify against mock by testing both authenticated and unauthenticated requests

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and verified in package.json / Cargo.toml
- Architecture: HIGH — patterns derived from existing working Phase 1 code
- API response shapes: MEDIUM — confirmed from official Atlassian docs; mock shapes must match
- Pitfalls: HIGH — derived from reading actual code (mock_server.rs routes, error.rs, commands.rs)
- Test map: HIGH — vitest.config.ts verified; test file paths follow established App.test.tsx pattern

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (Jira API stable; Zustand 5 / Tauri 2 APIs stable)
