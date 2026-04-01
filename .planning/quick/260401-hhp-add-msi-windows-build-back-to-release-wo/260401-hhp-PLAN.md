---
phase: quick
plan: 260401-hhp
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/release-cross-platform.yml
autonomous: true
requirements: [QUICK-MSI]
must_haves:
  truths:
    - "MSI artifacts are collected alongside NSIS artifacts in Windows builds"
    - "workflow_dispatch can trigger only Windows build (no Linux)"
  artifacts:
    - path: ".github/workflows/release-cross-platform.yml"
      provides: "Release workflow with MSI collection and platform-selective dispatch"
      contains: "msi/pmkar_"
  key_links:
    - from: "workflow_dispatch.inputs.platform"
      to: "matrix include filtering"
      via: "if condition on matrix entries"
      pattern: "inputs.platform"
---

<objective>
Add MSI Windows installer artifacts to the release workflow collection step and add a workflow_dispatch input to selectively trigger only the Windows build.

Purpose: Currently the workflow builds MSI (via tauri targets: "all") but never collects MSI files. The user also wants to dispatch only the Windows/MSI build without triggering Linux.
Output: Updated release-cross-platform.yml with MSI collection and platform-selective dispatch.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.github/workflows/release-cross-platform.yml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add platform selector input and MSI artifact collection</name>
  <files>.github/workflows/release-cross-platform.yml</files>
  <action>
Make three changes to the workflow file:

1. **Add platform input to workflow_dispatch** — Add a `platform` input with description "Platform to build (all, linux, windows)", required false, default "all", type choice with options: all, linux, windows.

2. **Add conditional execution to matrix entries** — Each matrix entry in the build job needs a condition so it only runs when selected. Add an `if` condition at the job-step level right after `runs-on`:
   ```yaml
   if: >-
     github.event_name == 'push' ||
     github.event.inputs.platform == 'all' ||
     github.event.inputs.platform == matrix.os_name
   ```
   This means: tag pushes always build everything, but workflow_dispatch respects the platform choice.

   IMPORTANT: The `if` must go on each step is NOT correct. Instead, the approach is to use a job-level `if` that won't work with matrix. The correct approach is to keep the matrix as-is but add an `if` condition on the job steps that do actual work. Actually, the simplest correct approach: keep the single `build` job with its matrix, but wrap ALL steps after "Checkout source" in a conditional. However, GitHub Actions doesn't support per-matrix-entry `if`.

   The cleanest solution: use `exclude` dynamically. But that's also complex. Instead, use this pattern — add an early step that sets an output `should_run` and gate subsequent steps on it:

   After the "Checkout source" step, add:
   ```yaml
   - name: Check if this platform should run
     id: should_run
     shell: bash
     run: |
       PLATFORM="${{ github.event.inputs.platform || 'all' }}"
       OS_NAME="${{ matrix.os_name }}"
       if [ "$PLATFORM" = "all" ] || [ "$PLATFORM" = "$OS_NAME" ]; then
         echo "run=true" >> "$GITHUB_OUTPUT"
       else
         echo "run=false" >> "$GITHUB_OUTPUT"
         echo "Skipping $OS_NAME build (requested: $PLATFORM)"
       fi
   ```

   Then add `if: steps.should_run.outputs.run == 'true'` to EVERY subsequent step (Resolve version, Install Linux deps, Setup Node, Setup Rust, Rust cache, Install frontend deps, Inject version, Build frontend, Build Tauri, Collect Linux artifacts, Collect Windows artifacts, Upload artifacts).

3. **Add MSI file collection** — In the "Collect Windows artifacts" step, add these lines after the NSIS cp commands:
   ```bash
   cp "$BUNDLE/msi/pmkar_${VERSION}_x64_en-US.msi" artifacts/ 2>/dev/null || true
   cp "$BUNDLE/msi/pmkar_${VERSION}_x64_en-US.msi.zip" artifacts/ 2>/dev/null || true
   cp "$BUNDLE/msi/pmkar_${VERSION}_x64_en-US.msi.zip.sig" artifacts/ 2>/dev/null || true
   ```

4. **No changes to latest.json step** — MSI does not participate in the Tauri updater (NSIS handles auto-update). MSI is a standalone installer artifact only.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && grep -c "msi/pmkar_" .github/workflows/release-cross-platform.yml && grep -c "inputs.platform" .github/workflows/release-cross-platform.yml && grep -c "should_run" .github/workflows/release-cross-platform.yml</automated>
  </verify>
  <done>
  - The "Collect Windows artifacts" step copies MSI, MSI.zip, and MSI.zip.sig files alongside NSIS artifacts
  - workflow_dispatch has a `platform` choice input (all/linux/windows) defaulting to "all"
  - Each build step is gated on `should_run` output so only selected platform executes
  - Tag pushes continue to build all platforms as before (no behavioral change for push events)
  </done>
</task>

</tasks>

<verification>
- `grep "msi/pmkar_" .github/workflows/release-cross-platform.yml` shows 3 MSI cp lines
- `grep "platform" .github/workflows/release-cross-platform.yml` shows the new input and conditionals
- YAML syntax valid: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release-cross-platform.yml'))"`
</verification>

<success_criteria>
- MSI artifacts (msi, msi.zip, msi.zip.sig) collected in Windows builds
- Dispatching with platform=windows only runs Windows matrix entry
- Dispatching with platform=all or tag push runs both platforms (backward compatible)
</success_criteria>

<output>
After completion, create `.planning/quick/260401-hhp-add-msi-windows-build-back-to-release-wo/260401-hhp-SUMMARY.md`
</output>
