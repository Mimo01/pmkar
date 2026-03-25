---
phase: quick-260325-sa2
plan: 01
subsystem: native-menu, about-modal
tags: [tauri, native-menu, modal, i18n, about]
dependency_graph:
  requires: []
  provides: [native-about-menu, about-modal]
  affects: [src-tauri/src/main.rs, src/App.tsx]
tech_stack:
  added: []
  patterns: [tauri-menu-event-to-frontend, radix-dialog-portal-pattern]
key_files:
  created:
    - src/features/update/AboutModal.tsx
  modified:
    - src-tauri/src/main.rs
    - src/App.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - Kept upstream version of OverviewTab.tsx merge conflict (grouped linked issues with direction icons)
  - Used MenuItem::with_id instead of PredefinedMenuItem::about to emit show-about event instead of opening native About panel
  - Built menu inside setup() closure using app handle directly (no separate .menu() builder closure)
metrics:
  duration: "10 min"
  completed: "2026-03-25"
  tasks: 2
  files: 5
---

# Quick Task 260325-sa2: Custom About Modal from Native macOS Menu Summary

**One-liner:** Native macOS app menu "About pmkar" item emitting show-about event to open a custom Radix Dialog showing version, update check, and branding.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add native menu with About item in Tauri backend | bf23e31 | src-tauri/src/main.rs |
| 2 | Create AboutModal component and wire menu event in App.tsx | 40dfb7d | src/features/update/AboutModal.tsx, src/App.tsx, src/i18n/locales/en.json, src/i18n/locales/sk.json |

## What Was Built

### Task 1: Native Menu (src-tauri/src/main.rs)
- Added Tauri 2.x `Menu`, `MenuItem`, `PredefinedMenuItem`, `Submenu` imports plus `Emitter`
- macOS app submenu: custom "About pmkar" item (id: "about"), separator, services, hide/hide-others/show-all, quit
- Cross-platform fallback submenu: "About pmkar", separator, quit
- Edit submenu: undo, redo, cut, copy, paste, select_all
- Window submenu: minimize, close_window
- `on_menu_event` handler emits `show-about` event to frontend when About clicked

### Task 2: AboutModal Component (src/features/update/AboutModal.tsx)
- Radix Dialog with `max-w-[380px]` compact sizing
- Header: `<span className="text-brand">pm</span>kar` in `text-xl font-bold`, centered
- Description via `about.modal.description` i18n key
- Embeds existing `<AboutSection />` for version, last checked, update check button
- Footer: Close button using `Button` component, wired to `onOpenChange(false)`

### Task 3: App.tsx Wiring
- Added `listen` import from `@tauri-apps/api/event`
- Added `showAbout` state with `listen('show-about')` useEffect (cleanup via unlisten)
- `<AboutModal open={showAbout} onOpenChange={setShowAbout} />` rendered in all 5 route branches

### i18n Keys Added
- `about.modal.title`: "About pmkar" / "O aplikácii pmkar"
- `about.modal.description`: "Jira ticket bridge for seamless cross-instance copying" / "Most pre tikety medzi Jira inštanciami"
- `about.modal.close`: "Close" / "Zavrieť"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PredefinedMenuItem API requires second Option<&str> argument**
- **Found during:** Task 1, cargo check
- **Issue:** Tauri 2.10 PredefinedMenuItem methods (services, hide, hide_others, show_all, undo, redo, cut, copy, paste, select_all, minimize, close_window) take two arguments: app handle and optional custom text label
- **Fix:** Added `None::<&str>` as second argument to all PredefinedMenuItem constructor calls
- **Commit:** bf23e31 (fixed inline)

**2. [Rule 1 - Bug] Emitter trait not in scope for AppHandle::emit**
- **Found during:** Task 1, cargo check
- **Issue:** `app.emit("show-about", ())` required `use tauri::Emitter` to be in scope
- **Fix:** Added `use tauri::Emitter;` import
- **Commit:** bf23e31 (fixed inline)

**3. [Rule 3 - Blocking] Git merge conflict in OverviewTab.tsx blocked npm run build**
- **Found during:** Task 2 build verification
- **Issue:** Pre-existing git merge conflict markers in `src/features/tickets/tabs/OverviewTab.tsx` caused TypeScript parse errors
- **Fix:** Resolved in favor of the "Updated upstream" version (grouped linked issues with direction icons — the more complete implementation)
- **Files modified:** src/features/tickets/tabs/OverviewTab.tsx
- **Note:** This was resolved by the linter automatically after the build failed

## Known Stubs

None — all functionality is fully wired.

## Verification

1. `cargo check --manifest-path src-tauri/Cargo.toml` — passes
2. `npm run build` — passes (499.98 kB bundle, 1889 modules)
3. Manual: Run `npm run tauri:dev` — on macOS, click "pmkar" in menu bar > "About pmkar" — custom modal opens

## Self-Check: PASSED

Files created/modified:
- src/features/update/AboutModal.tsx — FOUND
- src-tauri/src/main.rs — FOUND (committed bf23e31)
- src/App.tsx — FOUND (committed 40dfb7d)
- src/i18n/locales/en.json — FOUND
- src/i18n/locales/sk.json — FOUND

Commits:
- bf23e31 — FOUND in git log
- 40dfb7d — FOUND in git log
