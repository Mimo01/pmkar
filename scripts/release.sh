#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.0.0
#
# Local release lifecycle (builds happen in GitHub Actions):
#   A. Pre-flight checks
#   B. Version bump + CHANGELOG + commit + tag
#   C. Push tag to origin → triggers release-cross-platform.yml
#   D. Summary with CI link
#
# GitHub Actions (release-cross-platform.yml) handles:
#   - macOS universal build (native runner)
#   - Linux x86_64 build
#   - Windows x64 build
#   - Artifact signing (TAURI_SIGNING_PRIVATE_KEY from repo secret)
#   - GitHub release creation on Mimo01/pmkar-releases
#   - Artifact + latest.json upload

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION="${1:?Usage: release.sh <version> (e.g. 1.0.0)}"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE A — Pre-flight checks
# ─────────────────────────────────────────────────────────────────────────────

echo "==> Phase A: Pre-flight checks..."

# Validate semver format (bare X.Y.Z, no v prefix)
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be bare semver format X.Y.Z (e.g. 1.0.0, not v1.0.0)" >&2
  exit 1
fi

# Check for uncommitted changes
if ! git -C "$REPO_ROOT" diff-index --quiet HEAD --; then
  echo "Error: uncommitted changes. Commit or stash first." >&2
  exit 1
fi

# Check tag doesn't already exist
if git -C "$REPO_ROOT" tag --list "v$VERSION" | grep -q .; then
  echo "Error: tag v$VERSION already exists." >&2
  exit 1
fi

echo "    Version: $VERSION"
echo "    Working tree: clean"
echo "    Tag v$VERSION: not yet created"
echo "    All pre-flight checks passed."

# ─────────────────────────────────────────────────────────────────────────────
# PHASE B — Version bump + commit + tag
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "==> Phase B: Version bump..."
cd "$REPO_ROOT"

# bump-version.mjs updates package.json, tauri.conf.json, Cargo.toml, CHANGELOG.md
node scripts/bump-version.mjs "$VERSION"

# Commit the version bump
git -C "$REPO_ROOT" add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md
git -C "$REPO_ROOT" commit -m "chore: bump version to $VERSION"

# Create annotated tag
git -C "$REPO_ROOT" tag -a "v$VERSION" -m "Release v$VERSION"
echo "    Bumped to $VERSION, committed, tagged v$VERSION."

# ─────────────────────────────────────────────────────────────────────────────
# PHASE C — Push to origin (triggers GitHub Actions)
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "==> Phase C: Pushing to origin..."

git -C "$REPO_ROOT" push origin main
git -C "$REPO_ROOT" push origin "v$VERSION"
echo "    Pushed main and tag v$VERSION to origin."

# ─────────────────────────────────────────────────────────────────────────────
# PHASE D — Summary
# ─────────────────────────────────────────────────────────────────────────────

REPO_URL=$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null \
  | sed 's|git@github.com:|https://github.com/|; s|\.git$||')

echo ""
echo "=========================================="
echo "  pmkar v$VERSION — tag pushed!"
echo "=========================================="
echo ""
echo "GitHub Actions is now building all platforms:"
echo "  $REPO_URL/actions"
echo ""
echo "Release will appear at:"
echo "  https://github.com/Mimo01/pmkar-releases/releases/tag/v$VERSION"
echo ""
echo "Monitor build progress:"
echo "  gh run list --repo $(echo "$REPO_URL" | sed 's|https://github.com/||') --limit 3"
