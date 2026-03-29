// @ts-check
'use strict';

// inject-version.cjs — build-time version + env var injection
// Called during release: eval "$(node scripts/inject-version.cjs)"
// Writes version into tauri.conf.json, package.json, Cargo.toml
// Outputs: APP_VERSION, APP_COMMIT_SHA, APP_BUILD_DATE

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read version from latest git tag, fallback to 0.0.0-dev
let version;
try {
  const tag = execSync('git describe --tags --match "v[0-9]*" --abbrev=0', { encoding: 'utf8' }).trim();
  // Normalize to SemVer: v1 -> 1.0.0, v1.5 -> 1.5.0, v1.5.0 -> 1.5.0
  version = tag.replace(/^v/, '').split('.').concat(['0', '0']).slice(0, 3).join('.');
} catch {
  version = '0.0.0-dev';
}

const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const buildDate = new Date().toISOString().substring(0, 10);

// Write version into src-tauri/tauri.conf.json
const confPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
conf.version = version;
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');

// Write version into package.json
const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Write version into src-tauri/Cargo.toml
const cargoPath = path.join(__dirname, '../src-tauri/Cargo.toml');
const cargo = fs.readFileSync(cargoPath, 'utf8');
fs.writeFileSync(cargoPath, cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`));

// Export env vars for shell eval consumption
process.stdout.write(`APP_VERSION=${version}\nAPP_COMMIT_SHA=${sha}\nAPP_BUILD_DATE=${buildDate}\n`);
