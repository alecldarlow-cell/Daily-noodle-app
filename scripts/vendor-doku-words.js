#!/usr/bin/env node
/*
 * Copies the Doku engine's word list and ship-gate tables into the app, so the native
 * Doku runs the same ship gate (validateLexi) the page does before it renders a puzzle.
 *
 *   node scripts/vendor-doku-words.js --site ../dailynoodle          # write the file
 *   node scripts/vendor-doku-words.js --site ../dailynoodle --check  # exit 1 if stale
 *
 * Reads `const WORDS=…`, `BLOCKED`, `BANDS` and `DENSITY` from engines/doku.js (each a
 * plain literal on one line), evaluates each in an empty sandbox and writes them to
 * src/features/puzzles/doku/engine-words.json. The differential replay
 * (scripts/replay-doku.js) also compares them with the live page's own globals before
 * it plays anything, so the nightly run fails if the site changes them.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const site = path.resolve(args[args.indexOf('--site') + 1] || '');
const check = args.includes('--check');
const ENGINE = path.join(site, 'engines/doku.js');
if (!fs.existsSync(ENGINE)) {
  console.error('Usage: node scripts/vendor-doku-words.js --site <dailynoodle clone> [--check]');
  process.exit(2);
}
const OUT = path.join(__dirname, '..', 'src/features/puzzles/doku/engine-words.json');
const src = fs.readFileSync(ENGINE, 'utf8');

/** The value of a top-level `const NAME=<literal>;`, to its first ';' outside brackets and strings. */
function literal(name) {
  const m = new RegExp(`^const ${name}=`, 'm').exec(src);
  if (!m) throw new Error(`engines/doku.js: no const ${name}`);
  const start = m.index + m[0].length;
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (c === ';' && depth === 0)
      return vm.runInNewContext(`(${src.slice(start, i)})`, {}, { timeout: 2000 });
  }
  throw new Error(`engines/doku.js: could not find the end of ${name}`);
}

let sha = 'unknown';
try {
  sha = execSync('git rev-parse HEAD', { cwd: site }).toString().trim();
} catch {}

const tables = {
  WORDS: literal('WORDS'),
  BLOCKED: literal('BLOCKED'),
  BANDS: literal('BANDS'),
  DENSITY: literal('DENSITY'),
};
const body = (t) => JSON.stringify(t);

if (check) {
  const cur = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const { source: _s, ...rest } = cur;
  if (body(rest) !== body(tables)) {
    console.log('stale: src/features/puzzles/doku/engine-words.json');
    process.exit(1);
  }
  console.log('engine-words.json matches engines/doku.js');
  process.exit(0);
}
fs.writeFileSync(
  OUT,
  JSON.stringify({ source: `alecldarlow-cell/dailynoodle@${sha} engines/doku.js`, ...tables }) +
    '\n',
);
console.log(`wrote ${path.relative(process.cwd(), OUT)} from ${sha}`);
