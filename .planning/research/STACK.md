# Stack Research

**Domain:** Cross-platform Tauri desktop app with dual Jira REST API integration
**Researched:** 2026-03-19
**Confidence:** MEDIUM — based on training data through August 2025; external verification blocked. All versions flagged with confidence level. Verify before pinning in package.json.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tauri | 2.x (2.1+) | Desktop app shell, Rust backend, native OS bridges | Tauri 2.0 shipped stable Oct 2024. Provides native keychain access, HTTP client in Rust backend, cross-platform builds for macOS/Windows/Linux. Far lighter than Electron (no bundled Chromium). Rust backend is the right place for credential handling and API calls — keeps secrets off the JS thread. |
| React | 18.x | UI component framework | React 18 with concurrent features is the most battle-tested choice for Tauri frontends. Large ecosystem, good TypeScript support, familiar to most frontend devs. Tauri's official templates include React+TS. |
| TypeScript | 5.x | Type safety across frontend code | TypeScript 5.x with `strict: true` is the standard for any non-trivial Tauri project. Catches Tauri invoke() shape mismatches at compile time rather than runtime. |
| Vite | 5.x | Frontend bundler/dev server | Tauri's official scaffolding uses Vite. Fast HMR, first-class TypeScript support, excellent plugin ecosystem. Tauri's `tauri dev` wraps Vite's dev server. |
| Rust (stable) | 1.75+ | Backend logic: credential storage, HTTP client, logging | Tauri requires Rust. The backend Rust code is where credentials stay, where API calls originate, and where audit logs are written. No credentials should ever cross the Tauri invoke boundary in plaintext. |

### Supporting Libraries — Rust (Cargo) Side

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tauri-plugin-store` | 2.x | Persistent key-value storage for non-secret config (watched users list, ignored ticket IDs, connection settings minus credentials) | Use for anything that can live in a JSON file — NOT for credentials. |
| `keyring` (Rust crate) | 2.x | OS keychain integration: macOS Keychain, Windows Credential Manager, Linux Secret Service (libsecret) | Use for all credential storage — PATs, connection URLs associated with PATs. This is the only approved storage for secrets. |
| `reqwest` | 0.12.x | Async HTTP client for Jira REST API calls | Use in Rust backend commands. Provides TLS, timeout control, connection pooling. Supports both Bearer token (Cloud PAT) and Basic auth (Server PAT). |
| `serde` / `serde_json` | 1.x | Serialize/deserialize JSON for Jira API responses and IPC payloads | Required for all Jira API work. Tauri's IPC serializes via serde. |
| `tokio` | 1.x | Async runtime (already a Tauri dependency) | Tauri pulls tokio in; use it for async reqwest calls in command handlers. Don't introduce a second async runtime. |
| `tracing` + `tracing-subscriber` | 0.1.x / 0.3.x | Structured logging for audit trail | Use `tracing` for structured log events with fields (method, endpoint, status, timestamp). Write to a rolling file for audit. |
| `chrono` | 0.4.x | Timestamps for audit log entries | Use for ISO 8601 timestamps on all logged API calls. |
| `anyhow` | 1.x | Ergonomic error handling in Rust commands | Use for command-level error handling. Map to string errors before crossing the IPC boundary to JS. |

### Supporting Libraries — Frontend (npm) Side

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/api` | 2.x | Official Tauri JS/TS bindings for invoke(), events, window | Required for all frontend-to-backend communication. Use `invoke()` for all Jira operations — never make HTTP calls from the frontend. |
| `@tauri-apps/plugin-store` | 2.x | JS bindings for the store plugin | Use for reading/writing non-secret app config from the frontend (e.g., displaying connection names, ignored list). |
| `TanStack Query` (react-query) | 5.x | Async state management for Jira data fetching | Provides caching, background refetch, loading/error states for `invoke()` calls to Jira commands. Treats Tauri commands as async query functions. |
| `TanStack Table` | 8.x | Headless table for ticket list views | Ticket list with sort/filter requires a real table library. Headless means you control the markup. |
| `Zustand` | 4.x | Lightweight client state (UI state, wizard step, selected tickets) | Use for UI state that doesn't belong in TanStack Query — current wizard step, multi-select state, filter settings. Simpler than Redux for a desktop app this size. |
| `React Hook Form` | 7.x | Setup wizard forms (connection config, watched users) | Best-in-class form library for React. Low re-render overhead, good validation integration with Zod. |
| `Zod` | 3.x | Schema validation for form inputs and invoke() response shapes | Validate Jira API response shapes coming across the IPC boundary. Validate setup wizard inputs before sending to Rust. |
| `date-fns` | 3.x | Date formatting for ticket timestamps | Lightweight, tree-shakeable. Use for formatting Jira `created`/`updated`/`resolutiondate` fields. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@tauri-apps/cli` | Tauri CLI for dev server, build, signing | Install as dev dep: `npm install -D @tauri-apps/cli`. Use `tauri dev` and `tauri build`. |
| `msw` (Mock Service Worker) | Mock Jira REST API for frontend development | MSW v2 intercepts fetch at the Service Worker level. Use in browser mode during frontend dev. For Tauri, note that API calls should go through the Rust backend, so MSW alone is insufficient — see Mock Server note below. |
| `wiremock-rs` OR `httpmock` (Rust) | Mock HTTP server for Rust backend testing | Because API calls originate from Rust (reqwest), the mock server must be a real HTTP server that reqwest can hit. `httpmock` is simpler; `wiremock-rs` is more expressive. Both run in-process for unit/integration tests. |
| `Vitest` | Unit and integration tests for frontend code | Vite-native test runner. Use for testing React components, Zod schemas, utility functions. Mock `@tauri-apps/api` invoke() calls. |
| `cargo test` | Rust unit/integration tests | Test Rust command logic with mock HTTP servers (httpmock). Test credential storage with test doubles. |
| `ESLint` + `@typescript-eslint` | Lint TypeScript/React code | Use `@typescript-eslint/strict` ruleset. Catches common React/TS mistakes. |
| `Prettier` | Code formatting | Consistent formatting across TS/TSX files. Configure as ESLint formatter plugin or standalone. |
| `cargo clippy` | Rust linting | Run as part of CI. Catches common Rust mistakes and idiomatic issues. |

---

## Installation

```bash
# Scaffold new Tauri + React + TypeScript project
npm create tauri-app@latest pmkar -- --template react-ts

# Frontend dependencies
npm install @tauri-apps/api @tauri-apps/plugin-store
npm install @tanstack/react-query @tanstack/react-table
npm install zustand react-hook-form zod date-fns

# Dev dependencies (frontend)
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D msw
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint-config-prettier
```

```toml
# Cargo.toml additions (src-tauri/Cargo.toml)
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-store = "2"
keyring = "2"
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1"

[dev-dependencies]
httpmock = "0.7"
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Tauri 2.x | Electron | If the team is JS-only with no Rust capacity, or if you need Node.js APIs that Tauri doesn't expose. For this project's security requirements, Tauri is correct. |
| React 18 | Svelte / SolidJS | If bundle size is a primary concern and team is comfortable with less ecosystem support. Tauri works fine with either; React has more available component libraries. |
| TanStack Query | SWR | SWR works but has fewer features for cache invalidation across multiple Jira connections. TanStack Query handles the "two separate API endpoints" pattern better via query keys. |
| Zustand | Jotai / Redux Toolkit | Jotai is fine for atomic state; Redux is overkill for this app's state complexity. Zustand's API is simpler. |
| `keyring` crate | `tauri-plugin-stronghold` | Stronghold provides an encrypted vault but adds significant complexity. `keyring` directly uses OS keychain APIs and is simpler for the PAT storage use case. |
| `reqwest` in Rust | `tauri-plugin-http` (JS fetch proxy) | The plugin-http approach would route HTTP through JS fetch, which puts the response (containing Jira data) in the JS context. For audit logging and credential security, HTTP calls must stay in Rust. |
| `httpmock` | `wiremock-rs` | wiremock-rs is more expressive but heavier. httpmock is sufficient for mocking two Jira API profiles. |
| `tracing` | `log` crate | `log` is simpler but not structured. `tracing` supports structured fields (method, endpoint, status, duration) which are required for the audit log requirement. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `tauri-plugin-http` (JS-side HTTP) | Routes HTTP through JS fetch proxy — Jira API responses (including ticket content and auth tokens) land in the JS context. Violates the security boundary for credential-adjacent calls. | `reqwest` in Rust backend commands |
| Storing credentials in `tauri-plugin-store` | Store writes to a JSON file on disk. PATs would be plaintext in `~/.local/share/pmkar/store.json`. | `keyring` crate for OS keychain |
| Storing credentials in `localStorage` or any browser storage | Same plaintext problem, plus exposed to any WebView script. | `keyring` crate via Rust command |
| Making Jira API calls from the frontend (JS `fetch`) | Credentials would need to be passed to JS. Tauri's default CSP blocks most external requests, but the architecture flaw is the credential exposure. | Rust commands that own the HTTP client and credentials |
| `axios` on the frontend for Jira calls | Same reason as fetch — API calls must not originate from JS. | `reqwest` in Rust |
| `electron-store` or any Electron-specific library | Wrong runtime entirely. | Tauri equivalents |
| `node-keytar` | Node.js library, not usable in Tauri's Rust backend. Appears in search results for "desktop keychain" but is Electron-only. | `keyring` Rust crate |
| Redux Toolkit | Appropriate for large apps with complex shared state across many feature areas. Overkill here; adds boilerplate without benefit. | Zustand |
| `moment.js` | Unmaintained, large bundle. | `date-fns` |

---

## Stack Patterns by Variant

**For Jira Cloud (Atlassian Cloud REST API v3):**
- Base URL: `https://{domain}.atlassian.net/rest/api/3/`
- Auth: Basic auth with email + API token, OR Bearer token with PAT (newer)
- Use `reqwest` with `Authorization: Bearer {pat}` header
- Response fields use Atlassian Document Format (ADF) for rich text — plan a parser or renderer

**For Jira Server / Data Center (self-hosted, older):**
- Base URL: `https://{host}/rest/api/2/` (Server uses API v2, not v3)
- Auth: Basic auth with username + PAT, OR `Authorization: Bearer {pat}` (newer Server versions)
- Response fields use Jira wiki markup or plain text, NOT ADF
- Some endpoints differ from Cloud (e.g., issue link types, attachment handling)

**For mock server (development without real PATs):**
- Run `httpmock` in a Rust integration test fixture OR as a standalone binary
- Mock both `/rest/api/3/` (Cloud shape) and `/rest/api/2/` (Server shape) on different ports
- Inject mock URLs via a `#[cfg(test)]` or feature flag — never hardcode in production path

**For audit logging:**
- Use `tracing` spans around every `reqwest` call
- Emit a structured event with: timestamp, connection_name, method, url (redacted of credentials), status_code, response_size_bytes
- Write via `tracing-subscriber` JSON formatter to a rolling file in the app data directory
- Expose log file location in the UI for user inspection

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Tauri 2.x | `@tauri-apps/api` 2.x | Tauri 2 and its JS package must match major versions. Tauri 1.x and 2.x are not compatible. |
| Tauri 2.x | `tauri-plugin-store` 2.x | Plugin major versions track Tauri major versions. |
| `reqwest` 0.12 | `tokio` 1.x | reqwest 0.12 requires tokio 1.x, which Tauri 2 already provides. No version conflict. |
| `keyring` 2.x | Linux: requires `libsecret` / `libdbus` | On Linux, the `keyring` crate requires `libsecret-1-dev` to be installed. Document this in Linux build instructions. |
| React 18 | TanStack Query 5.x | TanStack Query v5 dropped React 16/17 support. React 18 required. |
| TanStack Query 5.x | `@tauri-apps/api` 2.x | No conflict — TanStack Query is agnostic to the fetch mechanism; works with invoke(). |

---

## Sources

- Training data: Tauri 2.0 release and ecosystem (through August 2025) — MEDIUM confidence; verify current versions at https://tauri.app and https://crates.io
- Training data: Jira REST API v2 (Server) vs v3 (Cloud) differences — MEDIUM confidence; verify at https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- Training data: `keyring` Rust crate for OS keychain — MEDIUM confidence; verify at https://crates.io/crates/keyring
- Training data: `httpmock` and `reqwest` Rust ecosystem — MEDIUM confidence; verify at https://crates.io
- Training data: React 18, TanStack Query 5, Zustand 4, Vite 5 — HIGH confidence; these are well-established stable releases
- Training data: `tracing` + `tracing-subscriber` structured logging — HIGH confidence; standard Rust async logging stack

**Verification required before implementation:**
- Confirm Tauri 2.x current minor version at https://github.com/tauri-apps/tauri/releases
- Confirm `tauri-plugin-store` 2.x API at https://tauri.app/plugin/store/
- Confirm `keyring` crate supports all three platforms in the current 2.x release
- Confirm Jira Server PAT auth header format for the specific customer server version

---

*Stack research for: Tauri cross-platform desktop app with dual Jira REST API integration*
*Researched: 2026-03-19*
