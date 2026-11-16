#!/usr/bin/env node
/* Writes src/features/puzzles/reckon/tests/units-fixture.json from the site's Reckon units block, so the
   app's units.ts is checked against the site's own output (16 Nov 2026).
     node scripts/reckon-units-fixture.js ../dailynoodle                                     */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const site = path.resolve(process.argv[2] || '../dailynoodle');
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
const dest = path.join(__dirname, '../src/features/puzzles/reckon/tests/units-fixture.json');
fs.writeFileSync(dest, JSON.stringify(out) + '\n');
console.log(out.length + ' facts → ' + path.relative(process.cwd(), dest));
