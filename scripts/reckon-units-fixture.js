#!/usr/bin/env node
/* Writes src/features/puzzles/reckon/tests/units-fixture.json from the site's Reckon units block, so the
   app's units.ts is checked against the site's own output (16 Nov 2026).
     node scripts/reckon-units-fixture.js ../dailynoodle            # write the fixture
     node scripts/reckon-units-fixture.js ../dailynoodle --check    # exit 1 if it's stale
   --check writes nothing: the nightly Site drift job runs it, so a change to the site's
   units block (or to the Reckon quizzes it reads) turns that job red (25 Nov 2026).        */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const DEST = path.join(__dirname, '../src/features/puzzles/reckon/tests/units-fixture.json');

/** The fixture's facts, built from the site clone at `site`. */
function build(site) {
  const E = fs.readFileSync(path.join(site, 'engines/reckon.js'), 'utf8');
  const sl = (f, t) => {
    const a = E.indexOf(f),
      b = E.indexOf(t, a);
    if (a < 0 || b < 0) throw Error('markers ' + f);
    return E.slice(a, b);
  };
  const cx = vm.createContext({});
  vm.runInContext(
    sl('const NQ=10', 'const SQ=') +
      sl('const MANT=', '/* Ballpark') +
      sl('const L10=', 'const W=') +
      sl('/* units:start', '/* units:end */') +
      sl('function grp(', 'function longDate(') +
      ';this.X={dnUnits,ladder};',
    cx,
  );
  const { dnUnits: U, ladder } = cx.X;
  const { read } = require(path.join(site, 'tools/tests/read-puzzle'));
  const facts = new Map();
  for (const f of fs
    .readdirSync(path.join(site, 'reports'))
    .filter((f) => /-quiz-reckon-\d{4}\.html$/.test(f))
    .sort())
    for (const q of read(path.join(site, 'reports', f)).qs)
      if (U.U[q.u] && !facts.has(q.f)) facts.set(q.f, q);
  // the rungs as one number: FNV-1a over their 12-figure values (units.test.ts hashes its own the same way)
  function hash(r) {
    let h = 0x811c9dc5;
    for (const ch of r.map((v) => String(+v.toPrecision(12))).join(',')) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  }
  const out = [...facts.values()].map((q) => {
    const s = U.spec(q),
      x = { q: { q: q.q, u: q.u, a: q.a, n: q.n || '', lo: q.lo } };
    if (!s) return Object.assign(x, { spec: null });
    const r = U.rungs(q.lo, s, ladder);
    return Object.assign(x, {
      spec: JSON.parse(JSON.stringify(s)),
      rungs: { n: r.length, first: r[0], last: r[r.length - 1], hash: hash(r) },
      answer: U.text(q.a * s.f, s.du),
    });
  });
  return out;
}

/** The fixture file's text for these facts. */
const serialise = (facts) => JSON.stringify(facts) + '\n';

/**
 * How the committed fixture text `was` differs from freshly built `facts`: [] when they
 * match, else one line per difference (a fact added, gone or changed, keyed by question).
 */
function differences(was, facts) {
  if (was === serialise(facts)) return [];
  let old;
  try {
    old = JSON.parse(was);
  } catch {
    return ['the committed fixture is not valid JSON'];
  }
  if (!Array.isArray(old)) return ['the committed fixture is not a list of facts'];
  const key = (x) => (x && x.q ? x.q.q : '') + ' [' + (x && x.q ? x.q.u : '') + ']';
  const before = new Map(old.map((x) => [key(x), JSON.stringify(x)]));
  const after = new Map(facts.map((x) => [key(x), JSON.stringify(x)]));
  const out = [];
  for (const [k, v] of after)
    if (!before.has(k)) out.push('new: ' + k);
    else if (before.get(k) !== v) out.push('changed: ' + k);
  for (const k of before.keys()) if (!after.has(k)) out.push('gone: ' + k);
  // same facts, other order or spacing: still stale, as the file is compared byte for byte
  return out.length ? out : ['same facts, written differently'];
}

/** Runs the script; returns the exit code. `opts` lets the tests swap the file, log and build. */
function main(argv, opts = {}) {
  const { dest = DEST, log = console, make = build } = opts;
  const check = argv.includes('--check');
  const site = path.resolve(argv.filter((a) => a !== '--check')[0] || '../dailynoodle');
  const facts = make(site);
  const rel = path.relative(process.cwd(), dest);
  if (!check) {
    fs.writeFileSync(dest, serialise(facts));
    log.log(facts.length + ' facts → ' + rel);
    return 0;
  }
  const was = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
  const diff = was ? differences(was, facts) : [rel + ' is missing'];
  if (!diff.length) {
    log.log(rel + ' is current (' + facts.length + ' facts)');
    return 0;
  }
  const shown = diff.slice(0, 20);
  if (diff.length > shown.length) shown.push('… and ' + (diff.length - shown.length) + ' more');
  log.error(
    rel +
      ' is stale: the site changed its Reckon units or quizzes.\n  ' +
      shown.join('\n  ') +
      '\nRegenerate it in a pull request: node scripts/reckon-units-fixture.js ../dailynoodle',
  );
  return 1;
}

module.exports = { build, serialise, differences, main };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
