---
plan: 260505-o6z
status: complete
commit: e62b8d3
date: 2026-05-05
---

# Quick Task 260505-o6z: Release next version, v0.4.4

## What was done

- Rewrote `scripts/release.sh` to delegate all builds to GitHub Actions (`release-cross-platform.yml`). Removed ~420 lines of local build logic (macOS native build, Linux Docker build, GitHub API calls for release/artifact/latest.json upload). New script is ~70 lines: pre-flight → version bump → commit+tag → push.
- Ran `./scripts/release.sh 0.4.4` — bumped version across `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, regenerated `CHANGELOG.md`, committed, tagged `v0.4.4`, pushed tag and main to origin.
- GitHub Actions `Cross-Platform Release Build` queued immediately (run 25378955011).

## Commits

- `971fc6e` — chore: simplify release.sh — delegate builds to GitHub Actions
- `e62b8d3` — chore: bump version to 0.4.4

## Release

- Tag: `v0.4.4`
- CI: https://github.com/Mimo01/pmkar/actions/runs/25378955011
- Release (pending CI): https://github.com/Mimo01/pmkar-releases/releases/tag/v0.4.4

## Includes (since v0.4.3)

- Phase 25: preview-time resolution of wiki_to_adf and user fields
- Phase 24: copy-time audit loop + 'copied' outcome badge
- Various hardening fixes (Phases 22–25 code review items)
