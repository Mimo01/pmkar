---
phase: quick
plan: 260324-pjx
subsystem: branding/assets
tags: [icon, tauri, branding, assets]
dependency_graph:
  requires: []
  provides: [app-icon, tauri-bundle-icons, web-favicon]
  affects: [tauri.conf.json, index.html]
tech_stack:
  added: []
  patterns: [npx tauri icon for cross-platform icon generation from SVG source]
key_files:
  created:
    - src-tauri/icons/app-icon.svg
    - src-tauri/icons/32x32.png
    - src-tauri/icons/64x64.png
    - src-tauri/icons/icon.icns
    - src-tauri/icons/icon.ico
    - src-tauri/icons/android/ (full Android mipmap set)
    - src-tauri/icons/ios/ (full iOS AppIcon set)
    - public/app-icon.svg
  modified:
    - src-tauri/icons/128x128.png
    - src-tauri/icons/128x128@2x.png
    - src-tauri/icons/icon.png
    - src-tauri/tauri.conf.json
    - index.html
decisions:
  - SVG source at 1024x1024 viewBox chosen as single source of truth; npx tauri icon generates all derivatives
  - Used app-icon.svg (not PNG) as web favicon to avoid resolution concerns and simplify copying
  - Rounded square shape with #c02232 background and white P letterform to match brand identity
metrics:
  duration: ~5 minutes
  completed: 2026-03-24
  tasks_completed: 2
  files_changed: 57
---

# Quick Task 260324-pjx: Add App Icon Summary

**One-liner:** Branded red #c02232 "P" icon (SVG source) generated to all Tauri platform formats (png, ico, icns, Android, iOS) with bundle.icon configured and web favicon updated.

## What Was Done

The app had three placeholder blue-square PNGs and an empty `bundle.icon` array in `tauri.conf.json`. This task replaced them with a proper branded icon.

### Task 1: Create SVG icon and generate platform variants

Created `src-tauri/icons/app-icon.svg` — a 1024x1024 rounded square with:
- Background: brand red `#c02232`
- White bold "P" letterform with a subtle forward-motion chevron arrow element
- Minimal, clean design legible at 16px through 1024px

Ran `npx tauri icon src-tauri/icons/app-icon.svg` which generated:
- `icon.png`, `icon.ico`, `icon.icns` (primary platform icons)
- `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png`
- Full Windows Appx Store logo set (Square*Logo.png, StoreLogo.png)
- Full iOS AppIcon set (14 sizes)
- Full Android mipmap set (5 densities, launcher + foreground + round variants)

**Commit:** b84004c

### Task 2: Configure Tauri bundle and HTML favicon

Updated `src-tauri/tauri.conf.json` `bundle.icon` array from empty to 6 paths (32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico, icon.png).

Copied `app-icon.svg` to `public/app-icon.svg` and updated `index.html` to reference `/app-icon.svg` instead of `/vite.svg`.

**Commit:** 5496d64

## Verification Results

- icon.png, icon.ico, icon.icns, 128x128.png, 128x128@2x.png, 32x32.png all exist
- `bundle.icon` has 6 entries, all referencing real files
- `index.html` references `/app-icon.svg`, not `/vite.svg`
- All referenced icon paths confirmed on disk

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- src-tauri/icons/app-icon.svg: FOUND
- src-tauri/icons/icon.png: FOUND
- src-tauri/icons/icon.ico: FOUND
- src-tauri/icons/icon.icns: FOUND
- src-tauri/icons/32x32.png: FOUND
- src-tauri/icons/128x128.png: FOUND
- public/app-icon.svg: FOUND
- Commit b84004c: FOUND
- Commit 5496d64: FOUND
