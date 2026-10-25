#!/usr/bin/env node
// Prints `export NAME='value'` lines for an eas.json build profile's env (following
// `extends`), for the Release workflow to eval before `eas update`. EAS builds read
// eas.json's env, but `eas update` doesn't, so without this an update ships without
// EXPO_PUBLIC_SUPABASE_* and leagues stop working (25 Oct 2026).
// Usage: node scripts/eas-profile-env.js <profile>
const fs = require('fs');
const path = require('path');

/** The profile's env merged over the profiles it extends (nearest wins). */
function profileEnv(eas, name, seen = new Set()) {
  const profile = eas.build && eas.build[name];
  if (!profile) throw new Error(`No build profile "${name}" in eas.json`);
  if (seen.has(name)) throw new Error(`eas.json build profiles extend in a loop at "${name}"`);
  seen.add(name);
  const base = profile.extends ? profileEnv(eas, profile.extends, seen) : {};
  return { ...base, ...(profile.env || {}) };
}

/** Shell lines that export each variable, single-quoted so nothing in a value expands. */
function exportLines(env) {
  return Object.keys(env)
    .sort()
    .map((k) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) throw new Error(`Bad variable name "${k}"`);
      return `export ${k}='${String(env[k]).replace(/'/g, `'\\''`)}'`;
    })
    .join('\n');
}

if (require.main === module) {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: node scripts/eas-profile-env.js <profile>');
    process.exit(2);
  }
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
  console.log(exportLines(profileEnv(eas, name)));
}

module.exports = { profileEnv, exportLines };
