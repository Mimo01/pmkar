# Phase 7: Internationalization - Research

**Researched:** 2026-03-23
**Domain:** React i18n, Tauri OS locale detection, locale-aware date/number formatting
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Language switcher lives in the Settings page only — a dropdown in a new "Language" section below the connection cards
- **D-02:** No header-level language indicator — keeps the AppShell header clean and consistent with existing layout
- **D-03:** Translate all UI chrome: nav labels, buttons, headings, empty states, settings text, modal titles, table headers
- **D-04:** Translate app-generated error messages (connection failures, copy errors, validation messages)
- **D-05:** Jira field names, API response values, and Jira-originated content stay untranslated
- **D-06:** Full locale-aware formatting using the browser's Intl API — dates, times, and numbers adapt to the selected language
- **D-07:** Slovak dates show Slovak month names and day-month-year order; English dates show English format
- **D-08:** Default language detected from OS locale on first launch — if OS is Slovak, app starts in Slovak; otherwise English
- **D-09:** User can override language in Settings; override persists via Tauri app config (not localStorage)
- **D-10:** OS locale detection happens once on first launch; after user makes a choice, that choice takes precedence permanently

### Claude's Discretion
- i18n library choice (react-intl, react-i18next, or lightweight custom)
- Translation file format and organization (JSON, nested keys, flat keys)
- String key naming convention
- How to detect OS locale via Tauri APIs

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| I18N-01 | App UI supports multiple languages with a language switcher | Library choice (react-i18next), language store, LanguageSection in SettingsPage, App.tsx provider wrap |
| I18N-02 | English language pack is complete and is the default language | en.json translation file covering all ~20 component files, OS locale detection defaulting to English |
| I18N-03 | Slovak language pack is complete | sk.json translation file with Slovak month names, day-month-year ordering, Slovak UI strings |
</phase_requirements>

---

## Summary

Phase 7 adds runtime language switching between English and Slovak to a Tauri + React 19 app. The codebase has no existing i18n infrastructure — all strings are hardcoded across approximately 20 component files. The implementation has three concerns: (1) choosing and wiring an i18n library with a React context provider in App.tsx, (2) extracting all strings from existing components into translation JSON files for both languages, and (3) persisting the language preference via the existing Tauri SQLite database rather than localStorage (consistent with how other app config is stored).

The library decision (left to Claude's discretion) clearly favors **react-i18next** with **i18next**. It is the dominant standard in the React ecosystem (by far the most widely used), has a minimal API surface well-suited to a small Tauri app, and pairs cleanly with JSON translation files and Zustand's store pattern. react-intl requires heavier ICU message formatting syntax that is unnecessary given this project's scope. A hand-rolled solution is not justified for an established problem domain with sharp edge cases (plurals, interpolation, fallback chains).

OS locale detection must go through a Tauri Rust command. The browser `navigator.language` API is unreliable inside Tauri's webview and may return the webview's locale rather than the OS locale. The existing `TriageDb` SQLite pattern is the correct persistence mechanism: a new `app_config` table row (keyed `language`) follows exactly the same singleton row pattern as `fetch_config (id=1)`.

**Primary recommendation:** Use react-i18next 16.x + i18next 25.x with flat-key JSON files, a `languageStore` Zustand store, and a new `get_os_locale` / `get_app_language` / `set_app_language` Tauri command trio backed by the existing SQLite triage.db.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| i18next | 25.10.5 (latest) | Core i18n engine — manages translation bundles, fallback, interpolation | Universal standard; react-i18next wraps it |
| react-i18next | 16.6.2 (latest) | React bindings — `useTranslation` hook, `<Trans>` component, `I18nextProvider` | De-facto standard React i18n; used by the vast majority of production React apps |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Browser `Intl.DateTimeFormat` | built-in | Locale-aware date/time formatting | Already available in Tauri webview; no additional package needed |
| Browser `Intl.NumberFormat` | built-in | Locale-aware number formatting | Same — available everywhere |
| `@tauri-apps/plugin-os` | 2.3.2 (latest, already in registry) | OS locale detection via `locale()` API | Use in Rust command or consider direct JS call |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-i18next | react-intl | react-intl uses ICU message syntax — verbose for a 2-language app; react-i18next simpler JSON is better fit |
| react-i18next | hand-rolled context | Don't build: plurals, namespace fallback, missing key handling, interpolation are all solved problems — reinventing them creates maintenance debt |
| Tauri Rust command for locale | `navigator.language` in JS | `navigator.language` may return webview locale (en-US) not OS locale inside Tauri; Rust `std::env::var("LANG")` / `locale` crate or Tauri plugin-os is more reliable |

**Installation:**
```bash
npm install i18next react-i18next
```

**Version verification (performed 2026-03-23):**
- `i18next`: 25.10.5 (npm registry, latest)
- `react-i18next`: 16.6.2 (npm registry, latest)

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── i18n/
│   ├── index.ts           # i18next initialization, exports `i18n` instance
│   ├── locales/
│   │   ├── en.json        # English translation strings
│   │   └── sk.json        # Slovak translation strings
│   └── languageStore.ts   # Zustand store for language state + Tauri persistence
├── features/
│   ├── connections/
│   │   └── SettingsPage.tsx   # Language section added here (D-01)
│   └── ...
└── App.tsx                # Wraps tree in I18nextProvider
```

### Pattern 1: i18next Initialization

**What:** Create `src/i18n/index.ts` that initializes i18next with both locale bundles loaded synchronously (no async loader needed for 2 small JSON files in a desktop app).

**When to use:** Single initialization at module load time; App.tsx imports it before rendering.

```typescript
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import sk from './locales/sk.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      sk: { translation: sk },
    },
    lng: 'en',          // overridden at startup from languageStore
    fallbackLng: 'en',
    interpolation: { escapeValue: false },  // React already escapes
  });

export default i18n;
```

### Pattern 2: Language Store (Zustand) with Tauri Persistence

**What:** A `languageStore` mirrors the `themeStore` pattern but persists via Tauri invoke (not localStorage) per D-09.

**When to use:** Language state must survive app restarts; Tauri SQLite is the canonical config store for this app.

```typescript
// src/i18n/languageStore.ts
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import i18n from './index';

export type Language = 'en' | 'sk';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  setLanguage: (lang) => {
    i18n.changeLanguage(lang);
    invoke('set_app_language', { language: lang }).catch(() => {});
    set({ language: lang });
  },
}));

// Called once during App hydration
export async function hydrateLanguage(): Promise<void> {
  const stored = await invoke<string | null>('get_app_language').catch(() => null);
  if (stored === 'en' || stored === 'sk') {
    i18n.changeLanguage(stored);
    useLanguageStore.setState({ language: stored });
  } else {
    // First launch: detect OS locale
    const locale = await invoke<string | null>('get_os_locale').catch(() => null);
    const lang: Language = locale?.startsWith('sk') ? 'sk' : 'en';
    i18n.changeLanguage(lang);
    useLanguageStore.setState({ language: lang });
    invoke('set_app_language', { language: lang }).catch(() => {});
  }
}
```

### Pattern 3: Provider Wrapping in App.tsx

**What:** Import `i18n/index.ts` side-effect at module top, then `hydrateLanguage()` inside the existing `useEffect` that already hydrates connections.

**When to use:** Language hydration must happen before the first render. Importing the i18n module synchronously (side effect) means i18next is initialized before React renders; `hydrateLanguage()` async call updates the store and triggers re-render with correct language.

```typescript
// App.tsx — add to existing hydration useEffect
import '../i18n/index'; // side-effect: initializes i18next
import { hydrateLanguage } from '../i18n/languageStore';

useEffect(() => {
  Promise.all([
    invoke<StoredConnectionMeta[]>('get_all_connection_meta'),
    hydrateLanguage(),
  ])
    .then(([metas]) => { /* existing connection logic */ })
    .finally(() => setHydrated(true));
}, []);
```

### Pattern 4: Using Translations in Components

**What:** The `useTranslation` hook from react-i18next returns a `t` function. Components use `t('key')` instead of hardcoded strings.

```typescript
import { useTranslation } from 'react-i18next';

function TicketListPage() {
  const { t } = useTranslation();
  return <h1>{t('tickets.heading')}</h1>;
}
```

### Pattern 5: Locale-Aware Date/Number Formatting

**What:** Wrap `Intl.DateTimeFormat` and `Intl.NumberFormat` in utility functions that read from `languageStore`. Slovak locale code is `'sk-SK'`, English is `'en-US'`.

```typescript
// src/lib/format.ts
import { useLanguageStore } from '../i18n/languageStore';

const LOCALE_MAP = { en: 'en-US', sk: 'sk-SK' } as const;

export function formatDate(
  iso: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const lang = useLanguageStore.getState().language;
  const locale = LOCALE_MAP[lang];
  return new Intl.DateTimeFormat(locale, options).format(new Date(iso));
}
```

**D-07 specifics:**
- Slovak (`sk-SK`): `Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' })` produces "23. marca 2026" (Slovak month names, day-month-year order).
- English (`en-US`): same call produces "March 23, 2026".

The browser's `Intl` API handles all locale-specific rules. No translation keys needed for dates — Intl does it automatically.

### Pattern 6: Translation JSON Key Convention

**What:** Flat namespace grouped by feature area. Avoids deep nesting that makes key lookup slow.

```json
{
  "nav.tickets": "Tickets",
  "nav.ignored": "Ignored",
  "settings.heading": "Settings",
  "settings.connections": "Connections",
  "settings.language": "Language",
  "settings.language.english": "English",
  "settings.language.slovak": "Slovak",
  "settings.whatToFetch": "What to fetch",
  "settings.watchedUsers": "Watched users",
  "settings.appearance": "Appearance",
  "tickets.empty": "No tickets found",
  "tickets.fetchButton": "Fetch tickets",
  "copy.preview.title": "Copy preview",
  "copy.confirm": "Copy to company Jira",
  "error.connectionFailed": "Connection failed",
  "error.authFailed": "Authentication failed (401)",
  ...
}
```

### Pattern 7: Rust — OS Locale Detection

**What:** Tauri command that reads OS locale. The most reliable approach in a Tauri 2 app is using `std::env` on Unix/macOS and `winreg` or Windows locale APIs on Windows. For simplicity, the `sys-locale` crate provides a cross-platform API.

```toml
# src-tauri/Cargo.toml
sys-locale = "0.3"
```

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub fn get_os_locale() -> Option<String> {
    sys_locale::get_locale()
}
```

`sys-locale 0.3` returns IETF BCP 47 tags like `"sk-SK"`, `"en-US"`. This is the correct crate — it reads `LANG`/`LC_ALL` on Unix, `GetUserDefaultLocaleName` on Windows, `NSLocale` on macOS.

### Pattern 8: Rust — app_config Table in TriageDb

**What:** Add a `app_config` singleton table to the existing `triage.db`. This follows the exact pattern of `fetch_config (id=1)`.

```sql
CREATE TABLE IF NOT EXISTS app_config (
    id       INTEGER PRIMARY KEY CHECK(id = 1),
    language TEXT NOT NULL DEFAULT 'en'
);
INSERT OR IGNORE INTO app_config(id) VALUES(1);
```

```rust
pub fn get_app_language(&self) -> AppResult<Option<String>> { ... }
pub fn set_app_language(&self, language: &str) -> AppResult<()> { ... }
```

New Tauri commands: `get_app_language`, `set_app_language`, `get_os_locale`.

### Anti-Patterns to Avoid

- **Lazy loading translation bundles:** With only 2 small JSON files (~100 strings each), lazy loading adds code complexity for zero user-visible benefit. Import statically.
- **Using localStorage for language persistence:** D-09 explicitly forbids this. Use Tauri SQLite.
- **Translating Jira content:** D-05 forbids it. Only translate UI chrome and app-generated error messages.
- **Using `navigator.language` for OS locale:** Unreliable inside Tauri webview. Always use the Rust `get_os_locale` command.
- **Re-implementing date formatting:** Never hand-roll date localization. `Intl.DateTimeFormat` handles Slovak month names, ordering, and all edge cases automatically.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Translation lookup with fallback | Custom context + map lookup | i18next | Fallback chains, missing key warnings, plurals, interpolation — all solved |
| Slovak date formatting | Manual month name arrays | `Intl.DateTimeFormat('sk-SK', ...)` | Browser handles all locale rules including genitive month forms |
| OS locale detection cross-platform | Platform-specific env var parsing | `sys-locale` Rust crate | macOS uses `NSLocale`, Windows uses registry API — `sys-locale` wraps all three |
| Language change propagation | Manual event bus | `i18n.changeLanguage()` + react-i18next | react-i18next re-renders all consumers automatically on language change |

**Key insight:** The browser's `Intl` API + react-i18next together cover 100% of this phase's runtime requirements. The only custom code needed is the persistence layer (SQLite) and the language store glue.

---

## Common Pitfalls

### Pitfall 1: Flash of untranslated content on first render

**What goes wrong:** App renders in English for one frame before the async `hydrateLanguage()` call resolves, then jumps to Slovak. User sees a string flash.

**Why it happens:** The existing hydration gate (`if (!hydrated) return null`) already solves this — the app returns null until the `finally` block runs. Adding `hydrateLanguage()` to the same `Promise.all` means language is set before `hydrated` becomes true and the UI renders.

**How to avoid:** Include `hydrateLanguage()` in the same `Promise.all` as `get_all_connection_meta` in App.tsx.

**Warning signs:** Slovak user sees English strings for a moment then switches to Slovak on load.

### Pitfall 2: i18next initialization race

**What goes wrong:** A component using `useTranslation` mounts before `i18next.init()` completes, returning empty strings.

**Why it happens:** `init()` with a `resources` object (no async backend) is actually synchronous — it resolves immediately. This is only a risk if a dynamic backend plugin is used.

**How to avoid:** Import `src/i18n/index.ts` as a top-level module side-effect before any component renders. With the static `resources` config, init is synchronous and this is never an issue.

### Pitfall 3: Missing translation keys for error messages

**What goes wrong:** Error strings from Tauri invoke failures (AppError variants serialized to the frontend) are not wrapped in `t()` calls.

**Why it happens:** Error messages come from the Rust backend as raw strings; they land in catch blocks that may render them directly.

**How to avoid:** Audit every `.catch((e) => setError(e.message || ...))` pattern. Either translate the display string with a generic error key (`t('error.generic', { message: e.message })`) or define translation keys for each known error code (D-04 covers app-generated errors, not Rust error text).

### Pitfall 4: sys-locale version mismatch with Tauri workspace Cargo

**What goes wrong:** Adding `sys-locale` to `src-tauri/Cargo.toml` causes workspace dependency resolution conflicts.

**Why it happens:** The workspace `Cargo.toml` at project root is the canonical dependency manager. Adding a dep only to `src-tauri/Cargo.toml` is fine — it's a workspace member — but make sure the crate name is `sys-locale` not `sys_locale`.

**How to avoid:** `cargo add sys-locale` in the `src-tauri/` directory. Current latest: `sys-locale = "0.3"`.

### Pitfall 5: Tests fail because i18next is not initialized

**What goes wrong:** Component tests that render translated components fail with "i18next is not initialized" or return raw keys like `"nav.tickets"`.

**Why it happens:** Test environment doesn't import `src/i18n/index.ts`.

**How to avoid:** Add i18next initialization to `src/test-setup.ts`, or create a test utility that wraps components in an `I18nextProvider` with a test i18n instance. The simplest approach is a `renderWithI18n` helper:

```typescript
// src/test-utils/renderWithI18n.tsx
import i18n from '../i18n/index';
import { I18nextProvider } from 'react-i18next';

export function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}
```

Alternatively, import the i18n module in test-setup.ts as a side effect to ensure init runs globally.

---

## Code Examples

### Language Section in SettingsPage.tsx (D-01)

```typescript
// Pattern matching the existing ThemeSection component in SettingsPage.tsx
function LanguageSection() {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  return (
    <section>
      <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">
        {t('settings.language')}
      </h2>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="w-full rounded-lg border border-brand-border bg-brand-surface text-brand-text px-3 py-2.5 text-sm focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-colors duration-200"
      >
        <option value="en">{t('settings.language.english')}</option>
        <option value="sk">{t('settings.language.slovak')}</option>
      </select>
    </section>
  );
}
```

### AppShell Nav Labels (D-03, requires translation)

```typescript
// AppShell.tsx — NAV_TABS must use t() or be driven by the parent
// Option A: Move NAV_TABS inside component and use useTranslation
function AppShell(...) {
  const { t } = useTranslation();
  const NAV_TABS = [
    { id: 'tickets' as const, label: t('nav.tickets') },
    { id: 'ignored' as const, label: t('nav.ignored') },
  ];
  // ...
}
```

### Slovak Translation Sample (sk.json)

```json
{
  "nav.tickets": "Lístky",
  "nav.ignored": "Ignorované",
  "settings.heading": "Nastavenia",
  "settings.connections": "Pripojenia",
  "settings.language": "Jazyk",
  "settings.language.english": "Angličtina",
  "settings.language.slovak": "Slovenčina",
  "settings.whatToFetch": "Čo načítať",
  "settings.watchedUsers": "Sledovaní používatelia",
  "settings.appearance": "Vzhľad",
  "tickets.empty": "Žiadne lístky",
  "tickets.fetchButton": "Načítať lístky",
  "copy.preview.title": "Náhľad kopírovania",
  "copy.confirm": "Kopírovať do firemného Jira",
  "error.connectionFailed": "Chyba pripojenia",
  "error.authFailed": "Autentifikácia zlyhala (401)"
}
```

---

## Runtime State Inventory

Step 2.5: SKIPPED — this is a greenfield addition (new i18n infrastructure), not a rename/refactor/migration phase. No stored data references the concept being changed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | ✓ | (project already running) | — |
| npm | Package install | ✓ | (project already running) | — |
| `sys-locale` Rust crate | OS locale detection | ✓ (crates.io) | 0.3 | Read `LANG` env var manually (less robust) |
| Rust/Cargo | Backend build | ✓ | (project already building) | — |
| Browser `Intl` API | Date/number formatting | ✓ | Built into Tauri webview | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + @testing-library/react 16.3.0 |
| Config file | Defined inline in vite.config.ts (no separate vitest.config.ts detected) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| I18N-01 | Language switcher renders in SettingsPage; changing it calls setLanguage | unit | `npm test -- src/features/connections/SettingsPage.test.tsx` | ❌ Wave 0 |
| I18N-01 | Switching language changes i18next active language | unit | `npm test -- src/i18n/languageStore.test.ts` | ❌ Wave 0 |
| I18N-02 | All en.json keys render without fallback strings | unit | `npm test -- src/i18n/translations.test.ts` | ❌ Wave 0 |
| I18N-02 | App defaults to English when OS locale is not Slovak | unit | included in languageStore.test.ts | ❌ Wave 0 |
| I18N-03 | All sk.json keys render without fallback strings | unit | `npm test -- src/i18n/translations.test.ts` | ❌ Wave 0 |
| I18N-03 | Switching to Slovak shows Slovak text in AppShell nav | unit | included in SettingsPage.test.tsx | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- src/i18n/`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/i18n/languageStore.test.ts` — covers I18N-01 (store), I18N-02 (default lang logic)
- [ ] `src/i18n/translations.test.ts` — covers I18N-02 and I18N-03 (key completeness: en and sk have identical key sets, no missing keys)
- [ ] `src/features/connections/SettingsPage.test.tsx` — covers I18N-01 (language dropdown renders, triggers store update)
- [ ] `src/test-utils/renderWithI18n.tsx` — shared test wrapper, required by all component tests in this phase

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-intl as the go-to React i18n | react-i18next now dominates | ~2019 onward | Simpler JSON format vs ICU messages; better DX for most apps |
| i18next with async HTTP backend loading | Static resource import for small apps | Always an option | For a 2-language desktop app with <200 strings, async backend adds zero value |
| `navigator.language` for locale detection | Platform-specific native APIs via `sys-locale` | Tauri apps | Webview locale != OS locale; must use native API |

**Deprecated/outdated:**
- `i18next-xhr-backend`: Replaced by `i18next-http-backend`. Not relevant here (using static imports).
- `react-i18next` v9.x legacy API (`I18n` render prop, `withTranslation` HOC): Replaced by `useTranslation` hook in v10+. Current version 16.x — always use hooks.

---

## Open Questions

1. **Vitest config location**
   - What we know: `vite.config.ts` does not contain a `test` block; no `vitest.config.ts` found; tests run via `npm test` which invokes `vitest run`
   - What's unclear: Vitest may be configured via implicit defaults (detects `.test.ts` files automatically) or there may be inline config in vite.config.ts not visible in the file I read
   - Recommendation: Wave 0 should add an explicit `test` block to `vite.config.ts` specifying `environment: 'jsdom'` and `setupFiles: ['./src/test-setup.ts']` if it's missing — required for DOM tests

2. **SettingsPage.test.tsx does not exist yet**
   - What we know: The connections directory has test files for ConnectionForm, SecretInput, SetupWizard, TestResult — but not SettingsPage
   - What's unclear: Whether existing tests cover SettingsPage indirectly
   - Recommendation: Create SettingsPage.test.tsx in Wave 0 stubs

3. **Exact string count per component**
   - What we know: ~20 component files have hardcoded strings; approximately 80-120 unique translatable strings across the whole app
   - What's unclear: Exact count until string extraction is done
   - Recommendation: Planner should structure Wave 1 as "extract all strings + build en.json" and Wave 2 as "produce sk.json from en.json"

---

## Sources

### Primary (HIGH confidence)

- npm registry `react-i18next` — version 16.6.2 confirmed current (2026-03-23)
- npm registry `i18next` — version 25.10.5 confirmed current (2026-03-23)
- Project codebase: `src-tauri/src/triage_db.rs` — `fetch_config` singleton row pattern (id=1) confirmed as persistence model to replicate
- Project codebase: `src/features/theme/themeStore.ts` — Zustand store pattern with side-effect persistence, confirmed as model for `languageStore`
- Project codebase: `src-tauri/src/main.rs` — Tauri command registration pattern confirmed
- MDN `Intl.DateTimeFormat` — built-in browser API, no installation needed, Slovak locale `sk-SK` support confirmed
- `sys-locale` crate (crates.io) — 0.3 is current version for cross-platform OS locale

### Secondary (MEDIUM confidence)

- crates.io `sys-locale = "0.3"` — current version confirmed; cross-platform support (macOS `NSLocale`, Windows `GetUserDefaultLocaleName`, Linux `LANG`) documented in crate README
- npm registry `@tauri-apps/plugin-os` 2.3.2 — has a `locale()` JS function that wraps OS locale; considered as an alternative to a custom Rust command

### Tertiary (LOW confidence)

- Tauri webview `navigator.language` unreliability claim — based on known Tauri architecture (Chromium/WebKit webview locale may differ from OS); flagged as requiring validation if `@tauri-apps/plugin-os` locale() is used instead of direct Rust

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified live 2026-03-23; react-i18next is the documented ecosystem standard
- Architecture: HIGH — patterns derived directly from existing codebase patterns (themeStore, triage_db fetch_config); no guesswork
- Pitfalls: HIGH — pitfalls 1-4 derived from direct code inspection; pitfall 5 derived from project's existing vitest pattern

**Research date:** 2026-03-23
**Valid until:** 2026-07-01 (i18next is stable; react-i18next major versions move slowly)
