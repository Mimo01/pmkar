#!/usr/bin/env node
// bump-version.mjs — Synchronize version across package.json, tauri.conf.json, Cargo.toml
// Usage: node scripts/bump-version.mjs <new-version>
// Example: node scripts/bump-version.mjs 1.0.0

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Usage: node scripts/bump-version.mjs <new-version>');
  console.error('Example: node scripts/bump-version.mjs 1.0.0');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(`Error: Invalid version "${newVersion}". Expected format: X.Y.Z (e.g., 1.0.0)`);
  process.exit(1);
}

console.log(`Bumping version to ${newVersion}`);

let hasError = false;

// --- package.json ---
try {
  const pkgPath = resolve(ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const oldVersion = pkg.version;
  pkg.version = newVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`  package.json: ${oldVersion} -> ${newVersion}`);
} catch (err) {
  console.error(`  package.json: ERROR — ${err.message}`);
  hasError = true;
}

// --- src-tauri/tauri.conf.json ---
try {
  const tauriConfPath = resolve(ROOT, 'src-tauri', 'tauri.conf.json');
  const conf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  const oldVersion = conf.version;
  conf.version = newVersion;
  writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2) + '\n', 'utf8');
  console.log(`  src-tauri/tauri.conf.json: ${oldVersion} -> ${newVersion}`);
} catch (err) {
  console.error(`  src-tauri/tauri.conf.json: ERROR — ${err.message}`);
  hasError = true;
}

// --- src-tauri/Cargo.toml ---
try {
  const cargoPath = resolve(ROOT, 'src-tauri', 'Cargo.toml');
  const cargoContent = readFileSync(cargoPath, 'utf8');

  // Replace the version = "X.Y.Z" line in the [package] section only.
  // The [package] section comes first; match only the first occurrence.
  const packageSectionEnd = cargoContent.indexOf('\n[', cargoContent.indexOf('[package]') + 1);
  const packageSection = packageSectionEnd === -1
    ? cargoContent
    : cargoContent.slice(0, packageSectionEnd);
  const rest = packageSectionEnd === -1 ? '' : cargoContent.slice(packageSectionEnd);

  const versionMatch = packageSection.match(/^version = "(\d+\.\d+\.\d+)"/m);
  if (!versionMatch) {
    throw new Error('Could not find version = "X.Y.Z" in [package] section');
  }
  const oldVersion = versionMatch[1];
  const updatedPackageSection = packageSection.replace(
    /^version = "\d+\.\d+\.\d+"/m,
    `version = "${newVersion}"`
  );
  writeFileSync(cargoPath, updatedPackageSection + rest, 'utf8');
  console.log(`  src-tauri/Cargo.toml: ${oldVersion} -> ${newVersion}`);
} catch (err) {
  console.error(`  src-tauri/Cargo.toml: ERROR — ${err.message}`);
  hasError = true;
}

if (hasError) {
  console.error('\nOne or more files failed to update. Check errors above.');
  process.exit(1);
}

console.log(
  `\nDone. Run: git add -A && git commit -m "chore: bump version to ${newVersion}" && git tag v${newVersion} && git push origin v${newVersion}`
);
