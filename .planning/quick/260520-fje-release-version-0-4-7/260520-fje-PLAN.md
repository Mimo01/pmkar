---
quick_id: 260520-fje
slug: release-version-0-4-7
description: Release version 0.4.7
date: 2026-05-20
status: planned
---

# Quick Task 260520-fje: Release version 0.4.7

## Objective

Bump version from 0.4.6 → 0.4.7 across all project files, commit the bump, create git tag v0.4.7, and publish a GitHub release with the changelog from commits since v0.4.6.

## Tasks

### Task 1: Bump version in all project files

**Files:**
- `package.json` — `"version": "0.4.6"` → `"0.4.7"`
- `src-tauri/Cargo.toml` — `version = "0.4.6"` → `"0.4.7"`
- `src-tauri/tauri.conf.json` — `"version": "0.4.6"` → `"0.4.7"`

**Action:** Run `node scripts/bump-version.mjs 0.4.7`

**Verify:** All three files contain `0.4.7`.

### Task 2: Commit, tag, and release

**Action:**
1. Commit version bump: `chore(release): bump version to 0.4.7`
2. Create annotated tag: `git tag -a v0.4.7 -m "Release v0.4.7"`
3. Push tag: `git push origin v0.4.7`
4. Create GitHub release via `gh release create`

**Changelog (commits since v0.4.6):**
- fix(copy): correctly map priority field when copying to Cloud Jira
- fix(copy): search target Cloud Jira users instead of source server users
- chore: set 7-day retention on release artifacts

**must_haves:**
- truths: version 0.4.7 in package.json, tauri.conf.json, Cargo.toml
- artifacts: git tag v0.4.7, GitHub release published
