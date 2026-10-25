'use strict';
/**
 * What the nightly replay should do (replay-nightly.yml), cheaply:
 * - recent: puzzle pages the site added or edited lately (its git log, leaving out the
 *   publish job's own "chore: rebuild feed.json" commits, which touch every page), at
 *   most 10 per type, spread across them: new and regenerated puzzles are checked before
 *   players reach them, and a bulk edit is sampled like a pull request;
 * - full: every puzzle of a type, only when the site's code that type's player was
 *   ported from has changed since the last full pass (its engine, the shared finish
 *   sheet and house chrome, dn-core.js). The last passing hashes are kept between runs
 *   (an Actions cache, replay-verified.json); with none yet, today's are taken as
 *   verified (every type was replayed in full before it was switched on).
 *
 *   node scripts/replay-watch.js --site ../dailynoodle --verified replay-verified.json [--since-hours 26] [--full-all]
 *   → {"full":[{"type":"sweep","shard":"1/4"},…],"recent":[{"type":"mini","only":"2026-11-02-crossword-mini-0113"}],"hashes":{…}}
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SLUG = {
  'crossword-mini': 'mini',
  'logic-doku': 'doku',
  'logic-sweep': 'sweep',
  'logic-path': 'path',
  'word-link': 'link',
  'word-tangle': 'tangle',
  'quiz-reckon': 'reckon',
  'geo-borders': 'borders',
};
/** Shards for a full run, so each job stays well inside GitHub's 6-hour limit. */
const SHARDS = { mini: 2, link: 1, tangle: 2, doku: 2, sweep: 4, path: 3, reckon: 2, borders: 3 };
/** Site code every native player was ported from, besides its own engine. */
const SHARED = ['engines/finish.js', 'engines/house.js', 'dn-core.js'];
/** Most changed pages replayed per type in one night (a spread sample beyond that). */
const RECENT_CAP = 10;

function spread(list, n) {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n)]);
}

function nativeTypes(root = path.join(__dirname, '..')) {
  const dir = path.join(root, 'src/features/puzzles');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'model.ts')))
    .map((d) => d.name)
    .sort();
}

function engineHash(site, type) {
  const h = crypto.createHash('sha256');
  for (const f of [`engines/${type}.js`, ...SHARED]) {
    const p = path.join(site, f);
    h.update(f + '\0' + (fs.existsSync(p) ? fs.readFileSync(p) : 'missing') + '\0');
  }
  return h.digest('hex').slice(0, 16);
}

/** "reports/2026-11-02-crossword-mini-0113.html" → {type:"mini", only:"2026-11-02-crossword-mini-0113"} */
function pageOf(file, types) {
  const m = /^reports\/(\d{4}-\d{2}-\d{2}-([a-z]+-[a-z]+)[\w-]*)\.html$/.exec(file.trim());
  if (!m) return null;
  const type = SLUG[m[2]];
  return type && types.includes(type) ? { type, only: m[1] } : null;
}

function plan({ types, hashes, verified, changedFiles, fullAll = false }) {
  const seed = !verified;
  const full = [];
  for (const t of types) {
    if (fullAll || (!seed && verified[t] !== hashes[t]))
      for (let k = 1; k <= (SHARDS[t] || 2); k++)
        full.push({ type: t, shard: `${k}/${SHARDS[t] || 2}` });
  }
  const fullTypes = new Set(full.map((j) => j.type));
  const byType = new Map();
  for (const f of changedFiles) {
    const pg = pageOf(f, types);
    if (!pg || fullTypes.has(pg.type)) continue;
    const list = byType.get(pg.type) || new Set();
    list.add(pg.only);
    byType.set(pg.type, list);
  }
  const recent = [];
  for (const t of types) {
    const pages = [...(byType.get(t) || [])].sort();
    for (const only of spread(pages, RECENT_CAP)) recent.push({ type: t, only });
  }
  return { full, recent, hashes, seeded: seed };
}

function changedSince(site, hours) {
  const out = execFileSync(
    'git',
    [
      '-C',
      site,
      'log',
      `--since=${hours} hours ago`,
      '--name-only',
      '--pretty=format:',
      '--',
      'reports/',
    ],
    { encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean);
}

module.exports = { plan, pageOf, engineHash, nativeTypes, spread, SLUG, SHARDS, RECENT_CAP };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
  const site = path.resolve(opt('site', '../dailynoodle'));
  const vfile = opt('verified', 'replay-verified.json');
  const types = nativeTypes();
  const hashes = Object.fromEntries(types.map((t) => [t, engineHash(site, t)]));
  let verified = null;
  try {
    verified = JSON.parse(fs.readFileSync(vfile, 'utf8'));
  } catch {
    /* first run: none yet */
  }
  const result = plan({
    types,
    hashes,
    verified,
    changedFiles: changedSince(site, Number(opt('since-hours', 26))),
    fullAll: args.includes('--full-all'),
  });
  process.stdout.write(JSON.stringify(result) + '\n');
}
