---
phase: quick
plan: 260401-hhp
subsystem: ci-release
tags: [github-actions, release, windows, msi, workflow]
dependency_graph:
  requires: []
  provides: [msi-artifacts-in-release, platform-selective-dispatch]
  affects: [.github/workflows/release-cross-platform.yml]
tech_stack:
  added: []
  patterns: [step-output-gating, matrix-platform-filter]
key_files:
  created: []
  modified:
    - .github/workflows/release-cross-platform.yml
decisions:
  - "should_run output step pattern used instead of job-level if — matrix jobs cannot be excluded dynamically at job level in GitHub Actions"
  - "MSI does not participate in latest.json updater — NSIS handles Tauri auto-update, MSI is standalone installer only"
  - "platform input defaults to 'all' — tag pushes always build everything, preserving backward compatibility"
metrics:
  duration: 2 min
  completed: 2026-04-01
  tasks: 1
  files: 1
---

# Quick Task 260401-hhp: Add MSI Windows build artifacts and platform-selective dispatch

MSI artifacts (msi, msi.zip, msi.zip.sig) collected in Windows release builds alongside NSIS, and a platform choice input added to workflow_dispatch to trigger only Windows or Linux selectively.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add platform selector input and MSI artifact collection | b64c8e5 | .github/workflows/release-cross-platform.yml |

## Changes Made

### .github/workflows/release-cross-platform.yml

**1. Added platform input to workflow_dispatch**

New `platform` choice input (all/linux/windows, default: "all") added alongside the existing `version` input. When dispatching manually, the user can now select only the Windows or Linux build runner.

**2. Added `Check if this platform should run` step**

Inserted after "Checkout source" in the build job matrix. Sets a `should_run` output to `true` or `false` based on whether `github.event.inputs.platform` matches the current matrix `os_name`. For push events (tag pushes), `platform` input is empty, so the `|| 'all'` fallback ensures all platforms build.

**3. Gated all subsequent build steps**

All steps from "Resolve version" through "Upload artifacts" now carry `if: steps.should_run.outputs.run == 'true'` (combined with existing `matrix.os_name` conditions where applicable). This means the skipped platform runner still starts and checks out but immediately proceeds to do nothing.

**4. Added MSI artifact collection**

Three new `cp` lines in "Collect Windows artifacts":
```
cp "$BUNDLE/msi/pmkar_${VERSION}_x64_en-US.msi" artifacts/
cp "$BUNDLE/msi/pmkar_${VERSION}_x64_en-US.msi.zip" artifacts/
cp "$BUNDLE/msi/pmkar_${VERSION}_x64_en-US.msi.zip.sig" artifacts/
```
MSI does not update latest.json — auto-update stays NSIS-only per Tauri updater design.

## Verification

- `grep -c "msi/pmkar_"` returns 3 (three MSI cp lines)
- `grep -c "inputs.platform"` returns 1 (new input referenced in should_run step)
- `grep -c "should_run"` returns 13 (1 id definition + 12 if conditions)
- YAML syntax: `python3 -c "import yaml; yaml.safe_load(...)"` passes

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- File exists: `.github/workflows/release-cross-platform.yml` — FOUND
- Commit b64c8e5 exists — FOUND
