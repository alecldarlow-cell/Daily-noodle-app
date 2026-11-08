#!/usr/bin/env node
/**
 * Writes THIRD-PARTY-NOTICES.md: every open-source package the app is built from (the
 * non-dev packages in package-lock.json), each with its licence text as the package ships
 * it, plus the fonts and word lists the app carries. Open-source licences (MIT, BSD,
 * Apache and the rest) ask for their notice to go with copies of the code, and the app
 * bundles these packages, so the Account tab's "Open-source licences" row links here.
 *
 *   node scripts/make-notices.js          writes THIRD-PARTY-NOTICES.md (needs npm ci first)
 *   node scripts/make-notices.js --check  fails if the file is missing a package in the lock
 *
 * Copyright audit, 8 Nov 2026 (project doc claude/ip-audit-2026-11-08.md).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'THIRD-PARTY-NOTICES.md');
const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown|mit|bsd|apache))?$/i;

/** Every package the app is built from: the lock's non-dev, non-workspace entries. */
function shippedPackages(lock) {
  const out = new Map();
  for (const [key, v] of Object.entries(lock.packages || {})) {
    if (!key.startsWith('node_modules/') && !key.includes('/node_modules/')) continue;
    if (v.dev || v.link) continue;
    const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const id = `${name}@${v.version}`;
    if (!out.has(id)) {
      const lic = typeof v.license === 'object' && v.license ? v.license.type : v.license;
      out.set(id, { name, version: v.version, license: lic || 'see package', dir: key });
    }
  }
  return [...out.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );
}

/** The licence text a package ships, or null. */
function licenceText(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return null;
  const f = fs.readdirSync(abs).find((n) => LICENCE_FILE.test(n));
  return f ? fs.readFileSync(path.join(abs, f), 'utf8').trim() : null;
}

const HEAD = `# Third-party notices — Daily Noodle app

The Daily Noodle app and its puzzles are © The Daily Noodle. All rights reserved, apart from
the third-party material below, which is used under its own licence.

## Fonts

Archivo, Inter and Instrument Serif, under the SIL Open Font License 1.1. The full licence
texts are in \`assets/fonts/OFL-*.txt\`.

## Word lists

Some word lists used by the puzzles (Tangle, Doku and Tumbler) were built with SCOWL and the
en-GB Hunspell dictionary derived from it, filtered by frequency with wordfreq
(https://github.com/rspeer/wordfreq). SCOWL's notice:

> Copyright 2000-2018 by Kevin Atkinson
>
> Permission to use, copy, modify, distribute and sell these word lists, the associated
> scripts, the output created from the scripts, and its documentation for any purpose is
> hereby granted without fee, provided that the above copyright notice appears in all copies
> and that both that copyright notice and this permission notice appear in supporting
> documentation. Kevin Atkinson makes no representations about the suitability of this array
> for any purpose. It is provided "as is" without express or implied warranty.

SCOWL's full copyright, sources and credits (including the Ispell and WordNet notices) are in
the website repository at \`licenses/scowl-hunspell-en-GB.txt\`.

## Maps

Country outlines in Borders: Natural Earth (https://www.naturalearthdata.com), public domain.

## Open-source packages

The app is built with the packages below. Each is listed with its licence as published; the
licence text follows where the package ships one.
`;

function render(pkgs) {
  const parts = [HEAD];
  for (const p of pkgs) {
    parts.push(`\n### ${p.name} ${p.version}\n\nLicence: ${p.license}\n`);
    const t = licenceText(p.dir);
    if (t) parts.push('\n```text\n' + t.replace(/```/g, "'''") + '\n```\n');
  }
  return parts.join('');
}

function missing(text, pkgs) {
  return pkgs
    .filter((p) => !text.includes(`\n### ${p.name} ${p.version}\n`))
    .map((p) => `${p.name}@${p.version}`);
}

if (require.main === module) {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const pkgs = shippedPackages(lock);
  if (process.argv.includes('--check')) {
    const gone = fs.existsSync(OUT)
      ? missing(fs.readFileSync(OUT, 'utf8'), pkgs)
      : ['THIRD-PARTY-NOTICES.md'];
    if (gone.length) {
      console.error(
        `THIRD-PARTY-NOTICES.md is missing ${gone.length}: ${gone.slice(0, 10).join(', ')}. Run node scripts/make-notices.js`,
      );
      process.exit(1);
    }
    console.log(`notices cover all ${pkgs.length} packages`);
  } else {
    if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
      console.error('run npm ci first: licence texts are read from node_modules');
      process.exit(2);
    }
    fs.writeFileSync(OUT, render(pkgs));
    console.log(`wrote THIRD-PARTY-NOTICES.md: ${pkgs.length} packages`);
  }
}

module.exports = { shippedPackages, missing };
